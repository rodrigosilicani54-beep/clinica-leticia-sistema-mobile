from db import get_connection

conn = get_connection()
cur = conn.cursor()

cur.execute("SELECT NOW();")
print(cur.fetchone())

conn.close()
