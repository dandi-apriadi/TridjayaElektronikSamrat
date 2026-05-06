import json
import os

seeds_path = 'backend/seeds.json'
uploads_dir = 'backend/uploads/products'

# Load seeds
with open(seeds_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Get available images
available_images = os.listdir(uploads_dir)
image_map = {name.lower(): name for name in available_images}

updated_count = 0

if 'products' in data:
    for product in data['products']:
        if not product.get('image'):
            slug = product.get('slug')
            if slug:
                webp_name = f"{slug}.webp"
                if webp_name in image_map:
                    product['image'] = f"uploads/products/{image_map[webp_name]}"
                    updated_count += 1
                elif f"{slug.replace('-', '_')}.webp" in image_map:
                     product['image'] = f"uploads/products/{image_map[f'{slug.replace('-', '_')}.webp']}"
                     updated_count += 1

# Save updated seeds
with open(seeds_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Updated {updated_count} product images in 'products' key.")
