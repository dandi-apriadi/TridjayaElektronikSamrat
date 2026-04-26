import os
from PIL import Image

def convert_to_webp(directory):
    for filename in os.listdir(directory):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            file_path = os.path.join(directory, filename)
            try:
                with Image.open(file_path) as img:
                    # Remove alpha channel if saving as JPG-like WebP, 
                    # but since WebP supports alpha, we can just save it.
                    # For transparency support in WebP:
                    if img.mode in ("RGBA", "P"):
                        img = img.convert("RGBA")
                    
                    new_filename = os.path.splitext(filename)[0] + '.webp'
                    new_file_path = os.path.join(directory, new_filename)
                    
                    img.save(new_file_path, 'WEBP', quality=85)
                    print(f"Converted {filename} to {new_filename}")
                    
                    # Delete original
                    os.remove(file_path)
            except Exception as e:
                print(f"Error converting {filename}: {e}")

if __name__ == "__main__":
    assets_dir = r"c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\frontend\src\assets\images"
    convert_to_webp(assets_dir)
