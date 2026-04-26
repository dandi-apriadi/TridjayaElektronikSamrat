import sqlite3

db_path = 'backend/tridjaya.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List semua tabel
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("=== TABEL DI DATABASE ===")
for table in tables:
    print(f"  {table[0]}")

# Cek struktur users table
print("\n=== STRUKTUR USERS TABLE ===")
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]}: {col[2]}")

# Cek jumlah users
cursor.execute("SELECT id, email, role FROM users LIMIT 10")
users = cursor.fetchall()
print(f"\n=== USERS (max 10) ===")
for user in users:
    print(f"  ID: {user[0]}, Email: {user[1]}, Role: {user[2]}")

# Cek total records per table
print("\n=== TOTAL RECORDS PER TABLE ===")
for table in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
    count = cursor.fetchone()[0]
    print(f"  {table[0]}: {count} records")

conn.close()
