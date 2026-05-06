import os
import json
from PIL import Image

def convert_to_webp(directory):
    converted_map = {}
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                source_path = os.path.join(root, file)
                # Handle space in filename
                clean_name = os.path.splitext(file)[0].replace(' ', '_')
                dest_name = f"{clean_name}.webp"
                dest_path = os.path.join(root, dest_name)
                
                print(f"Converting {source_path} to {dest_path}...")
                try:
                    with Image.open(source_path) as img:
                        img.save(dest_path, 'WEBP')
                    
                    # Store mapping for updating seeds.json
                    rel_source = os.path.relpath(source_path, 'backend').replace('\\', '/')
                    rel_dest = os.path.relpath(dest_path, 'backend').replace('\\', '/')
                    converted_map[rel_source] = rel_dest
                    
                    os.remove(source_path)
                except Exception as e:
                    print(f"Failed to convert {file}: {e}")
    return converted_map

def update_seeds(converted_map):
    seeds_path = 'backend/seeds.json'
    if not os.path.exists(seeds_path):
        return
        
    with open(seeds_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old_path, new_path in converted_map.items():
        # Handle cases with leading slash in seeds.json
        content = content.replace(f'/{old_path}', f'/{new_path}')
        content = content.replace(f'"{old_path}"', f'"{new_path}"')
        
    with open(seeds_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {len(converted_map)} references in seeds.json")

if __name__ == "__main__":
    uploads_dir = 'backend/uploads'
    mapping = convert_to_webp(uploads_dir)
    update_seeds(mapping)
