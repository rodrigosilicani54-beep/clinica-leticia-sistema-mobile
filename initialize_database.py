import sys

from app import initialize_database


if __name__ == "__main__":
    force = any(arg.lower() in ("--force", "-f") for arg in sys.argv[1:])
    try:
        result = initialize_database(force=force)
    except Exception as exc:
        print("Erro ao inicializar o banco.")
        print(str(exc))
        sys.exit(1)

    if result.get("skipped"):
        print("Banco ja inicializado nesta sessao.")
    else:
        print("Banco inicializado com sucesso.")
    print("Usuario admin padrao: admin")
    print("Senha admin padrao: admin123")
