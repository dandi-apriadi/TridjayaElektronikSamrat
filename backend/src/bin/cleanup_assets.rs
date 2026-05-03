use sqlx::sqlite::SqlitePoolOptions;
use std::env;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

/**
 * Utilitas untuk menganalisa database dan menghapus file (aset) yang tidak direferensikan.
 */
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tridjaya.db".to_string());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    let mut used_assets = HashSet::new();

    // 1. Koleksi dari products (image, images)
    println!("Menganalisa tabel products...");
    let rows: Vec<(Option<String>, Option<String>)> = sqlx::query_as("SELECT image, images FROM products").fetch_all(&pool).await?;
    for (img, imgs) in rows { 
        if let Some(path) = img { used_assets.insert(normalize_path(&path)); } 
        if let Some(json_str) = imgs {
            if let Ok(paths) = serde_json::from_str::<Vec<String>>(&json_str) {
                for path in paths { used_assets.insert(normalize_path(&path)); }
            }
        }
    }

    // 2. Koleksi dari blog_posts (author_image, hero_image)
    println!("Menganalisa tabel blog_posts...");
    let rows: Vec<(Option<String>, Option<String>)> = sqlx::query_as("SELECT author_image, hero_image FROM blog_posts").fetch_all(&pool).await?;
    for (a, h) in rows { 
        if let Some(path) = a { used_assets.insert(normalize_path(&path)); }
        if let Some(path) = h { used_assets.insert(normalize_path(&path)); }
    }

    // 3. Koleksi dari promos (image)
    println!("Menganalisa tabel promos...");
    let rows: Vec<(Option<String>,)> = sqlx::query_as("SELECT image FROM promos").fetch_all(&pool).await?;
    for (img,) in rows { if let Some(path) = img { used_assets.insert(normalize_path(&path)); } }

    // 4. Koleksi dari users (avatar)
    println!("Menganalisa tabel users...");
    let rows: Vec<(Option<String>,)> = sqlx::query_as("SELECT avatar FROM users").fetch_all(&pool).await?;
    for (img,) in rows { if let Some(path) = img { used_assets.insert(normalize_path(&path)); } }

    // 5. Koleksi dari partners (logo_url)
    println!("Menganalisa tabel partners...");
    let rows: Vec<(Option<String>,)> = sqlx::query_as("SELECT logo_url FROM partners").fetch_all(&pool).await?;
    for (img,) in rows { if let Some(path) = img { used_assets.insert(normalize_path(&path)); } }
    
    // 6. Koleksi dari agent_registrations (profile_photo, ktp_photo)
    println!("Menganalisa tabel agent_registrations...");
    let rows: Vec<(Option<String>, Option<String>)> = sqlx::query_as("SELECT profile_photo, ktp_photo FROM agent_registrations").fetch_all(&pool).await?;
    for (p, k) in rows { 
        if let Some(path) = p { used_assets.insert(normalize_path(&path)); } 
        if let Some(path) = k { used_assets.insert(normalize_path(&path)); }
    }

    println!("Total aset unik yang direferensikan di database: {}", used_assets.len());

    // Scan uploads directory
    let uploads_dir = Path::new("uploads");
    if !uploads_dir.exists() {
        println!("Folder uploads tidak ditemukan.");
    } else {
        let mut all_files = Vec::new();
        collect_files(uploads_dir, &mut all_files)?;
        println!("Total file fisik di folder uploads: {}", all_files.len());

        let mut orphans = Vec::new();
        for file_path in all_files {
            let path_str = normalize_path(&file_path.to_string_lossy());
            
            let mut is_used = false;
            
            // Cek apakah ada referensi di database yang mengandung path ini
            for used in &used_assets {
                if used == &path_str || used.contains(&path_str) || path_str.contains(used) {
                    is_used = true;
                    break;
                }
            }
            
            // PENGECUALIAN: Folder placeholders dan file sistem penting
            if path_str.contains("placeholders/") || path_str.ends_with(".gitkeep") {
                is_used = true;
            }

            if !is_used {
                orphans.push(file_path);
            }
        }

        println!("Ditemukan {} file aset yang tidak digunakan.", orphans.len());
        
        let do_cleanup = env::var("ALLOW_CLEANUP").unwrap_or_default() == "yes";
        
        for orphan in orphans {
            if do_cleanup {
                match fs::remove_file(&orphan) {
                    Ok(_) => println!("Dihapus: {:?}", orphan),
                    Err(e) => eprintln!("Gagal menghapus {:?}: {}", orphan, e),
                }
            } else {
                println!("Dapat dihapus (ORPHAN): {:?}", orphan);
            }
        }
        
        if !do_cleanup {
            println!("\nTip: Jalankan dengan ALLOW_CLEANUP=yes untuk menghapus file-file di atas.");
        }
    }

    Ok(())
}

fn normalize_path(path: &str) -> String {
    path.replace("\\", "/").trim_start_matches("./").trim_start_matches("/").to_string()
}

fn collect_files(dir: &Path, files: &mut Vec<PathBuf>) -> std::io::Result<()> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                collect_files(&path, files)?;
            } else {
                files.push(path);
            }
        }
    }
    Ok(())
}
