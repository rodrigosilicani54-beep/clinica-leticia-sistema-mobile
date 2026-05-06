import os
import json
import sys
import threading
from pathlib import Path

import psycopg2
from psycopg2.extensions import TRANSACTION_STATUS_IDLE
from psycopg2.pool import ThreadedConnectionPool


def _config_paths():
    paths = []
    explicit_path = os.environ.get("CLINICA_DB_CONFIG") or os.environ.get("DB_CONFIG_FILE")
    if explicit_path:
        paths.append(Path(explicit_path))

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        paths.append(Path(local_app_data) / "ClinicaLeticiaSegretti" / "db_config.json")

    if getattr(sys, "frozen", False):
        paths.append(Path(sys.executable).resolve().parent / "db_config.local.json")
        bundle_dir = getattr(sys, "_MEIPASS", None)
        if bundle_dir:
            paths.append(Path(bundle_dir) / "db_config.local.json")

    paths.append(Path(__file__).resolve().with_name("db_config.local.json"))
    return paths


def _read_db_config_file():
    for path in _config_paths():
        try:
            if path and path.is_file():
                with path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            continue
    return {}


def _get_config_value(config, env_name, *config_names, default=None):
    env_value = os.environ.get(env_name)
    if env_value not in (None, ""):
        return env_value
    for name in config_names:
        value = config.get(name)
        if value not in (None, ""):
            return value
    return default


_FILE_DB_CONFIG = _read_db_config_file()

DB_CONFIG = {
    "user": _get_config_value(_FILE_DB_CONFIG, "DB_USER", "user", "username"),
    "password": _get_config_value(_FILE_DB_CONFIG, "DB_PASSWORD", "password"),
    "host": _get_config_value(_FILE_DB_CONFIG, "DB_HOST", "host"),
    "port": int(_get_config_value(_FILE_DB_CONFIG, "DB_PORT", "port", default="6543")),
    "dbname": _get_config_value(_FILE_DB_CONFIG, "DB_NAME", "dbname", "database", default="postgres"),
    "connect_timeout": int(_get_config_value(_FILE_DB_CONFIG, "DB_CONNECT_TIMEOUT", "connect_timeout", default="10")),
}

_missing_db_config = [key for key in ("user", "password", "host") if not DB_CONFIG.get(key)]
if _missing_db_config:
    raise RuntimeError(
        "Configuracao do banco incompleta. Defina variaveis DB_USER/DB_PASSWORD/DB_HOST "
        "ou crie um db_config.local.json ao lado do sistema."
    )

DB_POOL_MINCONN = int(os.environ.get("DB_POOL_MINCONN", "1"))
DB_POOL_MAXCONN = int(os.environ.get("DB_POOL_MAXCONN", "8"))

_POOL = None
_POOL_LOCK = threading.Lock()


class PooledConnection:
    def __init__(self, pool, conn):
        self._pool = pool
        self._conn = conn
        self._returned = False

    def __getattr__(self, name):
        return getattr(self._conn, name)

    @property
    def closed(self):
        return self._conn.closed

    def close(self):
        if self._returned:
            return
        self._returned = True

        try:
            if self._conn.closed:
                self._pool.putconn(self._conn, close=True)
                return

            if self._conn.get_transaction_status() != TRANSACTION_STATUS_IDLE:
                self._conn.rollback()

            self._pool.putconn(self._conn)
        except Exception:
            try:
                self._conn.close()
            except Exception:
                pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type:
            try:
                self._conn.rollback()
            except Exception:
                pass
        self.close()


def _get_pool():
    global _POOL
    if _POOL is not None:
        return _POOL

    with _POOL_LOCK:
        if _POOL is None:
            _POOL = ThreadedConnectionPool(
                DB_POOL_MINCONN,
                DB_POOL_MAXCONN,
                **DB_CONFIG
            )
    return _POOL


def get_connection():
    pool = _get_pool()
    conn = pool.getconn()

    try:
        if conn.closed:
            pool.putconn(conn, close=True)
            conn = pool.getconn()

        if conn.get_transaction_status() != TRANSACTION_STATUS_IDLE:
            conn.rollback()
    except Exception:
        try:
            pool.putconn(conn, close=True)
        except Exception:
            pass
        raise

    return PooledConnection(pool, conn)
