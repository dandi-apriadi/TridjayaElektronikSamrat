import os
import sqlite3

# Paths
UPLOADS_DIR = r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\backend\uploads'
DB_PATH = r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\backend\tridjaya.db'
DOCS_IMAGES_DIR = r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\docs\gambar produk'

def get_referenced_files(db_path):
    refs = set()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    queries = [
        ("products", "image"),
        ("promos", "image"),
        ("partners", "logo_url"),
        ("blog_posts", "author_image"),
        ("blog_posts", "hero_image")
    ]
    for table, col in queries:
        try:
            cursor.execute(f"SELECT {col} FROM {table} WHERE {col} IS NOT NULL AND {col} != ''")
            for row in cursor.fetchall():
                path = row[0]
                if path.startswith('/uploads/'):
                    rel_path = path[len('/uploads/'):].replace('/', os.sep)
                    refs.add(rel_path.lower())
        except sqlite3.OperationalError:
            pass
    conn.close()
    return refs

def main():
    referenced_files = get_referenced_files(DB_PATH)
    for root, dirs, files in os.walk(UPLOADS_DIR):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, UPLOADS_DIR).lower()
            if rel_path.startswith('placeholders'):
                continue
            if rel_path not in referenced_files:
                try:
                    os.remove(full_path)
                except:
                    pass

    if os.path.exists(DOCS_IMAGES_DIR):
        for file in os.listdir(DOCS_IMAGES_DIR):
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                try:
                    os.remove(os.path.join(DOCS_IMAGES_DIR, file))
                except:
                    pass

if __name__ == "__main__":
    main()
