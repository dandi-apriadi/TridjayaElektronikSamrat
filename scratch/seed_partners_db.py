import sqlite3
import uuid
import datetime
import os

db_path = r"c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\backend\tridjaya.db"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Clear existing partners
cursor.execute("DELETE FROM partners")

partners = [
    ("Tridjaya Handphone", "/uploads/partners/logo-handphone.webp", "https://wa.me/6285161542103", 10),
    ("Tridjaya Meubel", "/uploads/partners/logo-meubel.webp", "https://wa.me/6285161542103", 20),
    ("Aqua", "/uploads/partners/Aqua.webp", None, 30),
    ("Polytron", "/uploads/partners/polytron.webp", None, 40),
    ("Sharp", "/uploads/partners/sharp.webp", None, 50),
    ("Goda", "/uploads/partners/goda.webp", None, 60),
    ("Saige", "/uploads/partners/saige.webp", None, 70),
    ("U-Winfly", "/uploads/partners/uwinfly-partner.webp", None, 80),
]

now = datetime.datetime.now().isoformat()

for name, logo, website, order in partners:
    partner_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO partners (id, name, logo_url, website_url, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (partner_id, name, logo, website, order, 1, now, now)
    )

conn.commit()
conn.close()
print("Partners seeded successfully into tridjaya.db!")
