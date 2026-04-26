import sqlite3

db_path = 'backend/tridjaya.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Mulai transaksi
    cursor.execute("BEGIN TRANSACTION")
    
    print("=== MULAI WIPE DATABASE ===\n")
    
    # Tabel-tabel yang akan di-wipe (kecuali admin)
    data_tables = [
        'users',
        'products', 
        'promos',
        'blog_posts',
        'job_listings',
        'agent_registrations',
        'reward_tiers',
        'agent_stats',
        'achievements',
        'agent_achievements',
        'reward_claims',
        'site_content',
        'leads',
        'telemetry_events',
        'referrals',
        'support_tickets'
    ]
    
    # Wipe data
    for table in data_tables:
        if table == 'users':
            # Untuk users, hapus semua kecuali admin
            cursor.execute("DELETE FROM users WHERE id != 'adm-001'")
            deleted = cursor.rowcount
            print(f"[{table}] Deleted {deleted} non-admin users, kept admin user")
        else:
            # Untuk tabel lain, hapus semua
            cursor.execute(f"DELETE FROM {table}")
            deleted = cursor.rowcount
            print(f"[{table}] Deleted {deleted} records")
    
    # Commit transaksi
    conn.commit()
    print("\n=== WIPE BERHASIL (COMMITTED) ===\n")
    
    # Verifikasi hasil
    print("=== VERIFIKASI HASIL ===")
    for table in data_tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  {table}: {count} records")
    
    # Verifikasi admin masih ada
    print("\n=== VERIFIKASI ADMIN ===")
    cursor.execute("SELECT id, email, role FROM users WHERE id = 'adm-001'")
    admin = cursor.fetchone()
    if admin:
        print(f"  ✓ Admin preserved: ID={admin[0]}, Email={admin[1]}, Role={admin[2]}")
    else:
        print(f"  ✗ ERROR: Admin user not found!")
        
except Exception as e:
    print(f"ERROR: {e}")
    conn.rollback()
    print("Transaksi di-rollback, database tidak berubah")
finally:
    conn.close()
