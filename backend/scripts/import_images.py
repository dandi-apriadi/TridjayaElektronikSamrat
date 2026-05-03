import os
import sqlite3
from PIL import Image
import shutil

# Paths
SOURCE_DIR = r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\docs\gambar produk'
DEST_DIR = r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\backend\uploads\products'
DB_PATH = r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\backend\tridjaya.db'

# Mapping: Filename -> Type Keyword
MAPPING = {
    '1.png': 'WS80SK10',
    '2.png': 'QW-9031HT',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (1).png': 'WSHS1013UB',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (2).png': 'ES-T1290WA',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (3).png': 'P-1200RT',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (4).png': 'P-1200RT',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (5).png': 'P7000N',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (6).png': 'P8000N',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (7).png': 'P8000N',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (8).png': 'P9050RTB',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (9).png': 'WS90SK10',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (10).png': 'QW-8031',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (11).png': 'PWM-1076',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (12).png': 'PWM-1076',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (13).png': 'PWM-7073-P',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (14).png': 'PWM-8072',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (15).png': 'PWM-9076',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (16).png': 'WM-TT100',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (17).png': 'WM-TT70',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (18).png': 'WM-TT80',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (19).png': 'ES-T1090',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (20).png': 'ES-T70MW',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (21).png': 'ES-T80MW',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (22).png': 'ES-T90MW',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel) (23).png': 'P1000RT',
    'Salinan dari MESIN CUCI UPDATE (1200 x 900 piksel).png': 'WSHS1213UB'
}

def main():
    if not os.path.exists(DEST_DIR):
        os.makedirs(DEST_DIR)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for filename, keyword in MAPPING.items():
        src_path = os.path.join(SOURCE_DIR, filename)
        if not os.path.exists(src_path):
            continue

        search_keyword = f"%{keyword}%"
        cursor.execute("SELECT id, name, slug FROM products WHERE (name LIKE ? OR name LIKE ?) AND (category = 'MESIN CUCI' OR category = 'MC')", 
                       (search_keyword, search_keyword.replace('-', ' ')))
        products = cursor.fetchall()

        for pid, name, slug in products:
            output_filename = f"{slug}.webp"
            dest_path = os.path.join(DEST_DIR, output_filename)
            try:
                with Image.open(src_path) as img:
                    img.save(dest_path, 'WEBP', quality=85)
                db_url = f"/uploads/products/{output_filename}"
                cursor.execute("UPDATE products SET image = ? WHERE id = ?", (db_url, pid))
            except Exception as e:
                print(f"Error processing {filename}: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
