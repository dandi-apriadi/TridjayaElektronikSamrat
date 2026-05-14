use crate::auth::hash_password;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::fs;
use std::path::Path;

fn landing_asset_url(
    source_rel: &str,
    dest_file: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let upload_dir = Path::new("uploads").join("landing");
    fs::create_dir_all(&upload_dir)?;

    let dest_path = upload_dir.join(dest_file);
    if !dest_path.exists() {
        let candidates = [
            Path::new("..")
                .join("frontend")
                .join("src")
                .join(source_rel),
            Path::new("frontend").join("src").join(source_rel),
        ];

        if let Some(source_path) = candidates.iter().find(|path| path.exists()) {
            if source_path
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("webp"))
            {
                fs::copy(source_path, &dest_path)?;
            } else {
                let image = image::open(source_path)?;
                image.save_with_format(&dest_path, image::ImageFormat::WebP)?;
            }
        } else {
            tracing::warn!(
                source = source_rel,
                dest = %dest_path.display(),
                "Landing seed asset source not found; database URL will still be seeded"
            );
        }
    }

    Ok(format!("/uploads/landing/{}", dest_file))
}

async fn seed_landing_content(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = pool.acquire().await?;

    let hero_assets = [
        (
            "latte",
            "assets/images/landing/generated-pro/hero-products/hero-bg-latte.webp",
            "assets/images/landing/hero-custom/hero-latte-red.webp",
        ),
        (
            "cappuccino",
            "assets/images/landing/generated-pro/hero-products/hero-bg-cappuccino.webp",
            "assets/images/landing/hero-custom/hero-cappuccino-green.webp",
        ),
        (
            "polaris",
            "assets/images/landing/generated-pro/hero-products/hero-bg-polaris.webp",
            "assets/images/landing/hero-custom/hero-polaris-family.webp",
        ),
        (
            "kingkong",
            "assets/images/landing/generated-pro/hero-products/hero-bg-kingkong.webp",
            "assets/images/landing/hero-custom/hero-kingkong-white.webp",
        ),
        (
            "d66b",
            "assets/images/landing/generated-pro/hero-products/hero-bg-d66b.webp",
            "assets/images/landing/hero-custom/hero-uwinfly-d66b-pink.webp",
        ),
    ];

    let mut hero_urls = std::collections::HashMap::new();
    for (id, bg, product) in hero_assets {
        hero_urls.insert(
            id,
            (
                landing_asset_url(bg, &format!("hero-bg-{}.webp", id))?,
                landing_asset_url(product, &format!("hero-product-{}.webp", id))?,
            ),
        );
    }

    let hero_slides = vec![
        json!({
            "id": "latte",
            "eyebrow": "Saige Latte",
            "title": "Latte merah premium untuk mobilitas harian.",
            "accent": "Desain modern, cicilan ringan, siap pakai.",
            "copy": "Skuter listrik bergaya urban dengan bodi kompak, warna merah berani, dan pilihan kredit yang mudah untuk dipakai harian.",
            "href": "/produk?kategori=Sepeda+Listrik",
            "cta": "Lihat Saige Latte",
            "productAlt": "Saige Latte merah",
            "iconKey": "bike",
            "price": "Rp 4.700.000",
            "oldPrice": "Rp 5.200.000",
            "detailLine": "Motor 60V 800W | Baterai lithium 60V 20Ah | Ban tubeless 2.75-10",
            "metrics": [{"iconKey":"zap","value":"800W","label":"motor"},{"iconKey":"battery","value":"50-70 km","label":"jarak tempuh"},{"iconKey":"gauge","value":"45 km/jam","label":"kecepatan maks."}],
            "specs": [{"iconKey":"zap","value":"800W","label":"motor"},{"iconKey":"battery","value":"60V 20Ah","label":"lithium"},{"iconKey":"mapPin","value":"50-70 km","label":"jarak tempuh"},{"iconKey":"gauge","value":"45 km/jam","label":"kecepatan"},{"iconKey":"wrench","value":"6-8 jam","label":"pengisian"},{"iconKey":"shield","value":"170 kg","label":"beban maks."}]
        }),
        json!({
            "id": "cappuccino",
            "eyebrow": "Saige Cappuccino",
            "title": "Cappuccino tampil retro, tetap bertenaga.",
            "accent": "Baterai lithium, warna kalem, gaya premium.",
            "copy": "Pilihan retro-premium untuk perjalanan santai, dengan posisi berkendara nyaman dan detail warna yang terlihat rapi di showroom.",
            "href": "/produk?kategori=Sepeda+Listrik",
            "cta": "Lihat Cappuccino",
            "productAlt": "Saige Cappuccino hijau krem",
            "iconKey": "bike",
            "price": "Rp 8.000.000",
            "oldPrice": "Rp 8.700.000",
            "detailLine": "Motor 48/60V 800W | Baterai 48/60V 20Ah | Rem disc/drum",
            "metrics": [{"iconKey":"zap","value":"800W","label":"motor"},{"iconKey":"battery","value":"60-80 km","label":"jarak tempuh"},{"iconKey":"shield","value":"48/60V","label":"sistem"}],
            "specs": [{"iconKey":"zap","value":"800W","label":"motor"},{"iconKey":"battery","value":"48/60V 20Ah","label":"baterai"},{"iconKey":"mapPin","value":"60-80 km","label":"jarak tempuh"},{"iconKey":"gauge","value":"25/33 km/jam","label":"kecepatan"},{"iconKey":"wrench","value":"6-8 jam","label":"pengisian"},{"iconKey":"shield","value":"170 kg","label":"beban maks."}]
        }),
        json!({
            "id": "polaris",
            "eyebrow": "Saige Polaris",
            "title": "Polaris nyaman untuk keluarga dan usaha.",
            "accent": "Tiga roda stabil, jok lebar, kapasitas besar.",
            "copy": "Tiga roda yang stabil untuk belanja, antar-jemput, dan kebutuhan usaha ringan dengan ruang duduk yang lega.",
            "href": "/produk?kategori=Sepeda+Listrik",
            "cta": "Lihat Saige Polaris",
            "productAlt": "Saige Polaris tiga roda",
            "iconKey": "bike",
            "price": "Rp 12.700.000",
            "oldPrice": "Rp 13.200.000",
            "detailLine": "Motor 800W 48/60V | Baterai 60V 20Ah | Drum brake | Ban vacuum 300-8",
            "metrics": [{"iconKey":"zap","value":"800W","label":"motor"},{"iconKey":"battery","value":"60 km","label":"jarak tempuh"},{"iconKey":"shield","value":"3 roda","label":"stabil"}],
            "specs": [{"iconKey":"zap","value":"800W","label":"motor"},{"iconKey":"battery","value":"60V 20Ah","label":"baterai"},{"iconKey":"mapPin","value":"60 km","label":"jarak tempuh"},{"iconKey":"gauge","value":"3 mode","label":"controller"},{"iconKey":"wrench","value":"6-8 jam","label":"pengisian"},{"iconKey":"shield","value":"300-8","label":"ban vacuum"}]
        }),
        json!({
            "id": "kingkong",
            "eyebrow": "Goda Mecha Kingkong",
            "title": "Mecha Kingkong 199 Max bertenaga tinggi.",
            "accent": "72V 20Ah, motor 1500W, suspensi siap jalan jauh.",
            "copy": "Model Goda dengan motor high-torque, dual disc brake, dan fitur Auto-P untuk pengendara yang butuh tenaga lebih dari sepeda listrik biasa.",
            "href": "/produk?kategori=Sepeda+Listrik",
            "cta": "Lihat Mecha Kingkong",
            "productAlt": "Goda Mecha Kingkong Blue Saber",
            "iconKey": "bike",
            "price": "Cek Promo",
            "oldPrice": "Harga mengikuti varian dan stok toko",
            "detailLine": "72V 20Ah battery + 1500W motor | 220mm dual disc brake | 3 power modes",
            "metrics": [{"iconKey":"zap","value":"1500W","label":"motor"},{"iconKey":"battery","value":"72V 20Ah","label":"baterai"},{"iconKey":"shield","value":"Dual disc","label":"rem"}],
            "specs": [{"iconKey":"zap","value":"1500W","label":"motor"},{"iconKey":"battery","value":"72V 20Ah","label":"baterai"},{"iconKey":"shield","value":"220mm","label":"dual disc"},{"iconKey":"wrench","value":"USD fork","label":"suspensi"},{"iconKey":"gauge","value":"LCD","label":"panel"},{"iconKey":"sparkles","value":"Auto-P","label":"smart tech"}]
        }),
        json!({
            "id": "d66b",
            "eyebrow": "Uwinfly D66B",
            "title": "Uwinfly D66B modern untuk perjalanan dekat.",
            "accent": "Smart key, jok sofa, bagasi 13 liter.",
            "copy": "Smart e-bike Uwinfly dengan motor BLDC 600W, baterai SLA 48V 12Ah, dan desain kompak yang cocok untuk mobilitas harian jarak dekat.",
            "href": "/produk?kategori=Sepeda+Listrik",
            "cta": "Lihat Uwinfly D66B",
            "productAlt": "Uwinfly D66B pink",
            "iconKey": "bike",
            "price": "Cek Promo",
            "oldPrice": "Tanyakan harga terbaru ke sales",
            "detailLine": "600W BLDC | 48V 12Ah SLA | +/- 42 km | disc brake | bagasi 13L",
            "metrics": [{"iconKey":"zap","value":"600W","label":"motor"},{"iconKey":"battery","value":"42 km","label":"jarak tempuh"},{"iconKey":"gauge","value":"33 km/jam","label":"kecepatan"}],
            "specs": [{"iconKey":"zap","value":"600W","label":"BLDC"},{"iconKey":"battery","value":"48V 12Ah","label":"SLA"},{"iconKey":"mapPin","value":"+/- 42 km","label":"jarak tempuh"},{"iconKey":"gauge","value":"+/- 33 km/jam","label":"kecepatan"},{"iconKey":"shield","value":"150 kg","label":"beban maks."},{"iconKey":"sparkles","value":"U-Connect","label":"smart key"}]
        }),
    ];

    for (idx, slide) in hero_slides.iter().enumerate() {
        let id = slide["id"].as_str().unwrap_or_default();
        let (bg_url, product_url) = hero_urls.get(id).cloned().unwrap_or_default();
        sqlx::query(
            "INSERT INTO landing_hero_slides
             (id, eyebrow, title, accent, copy, href, cta, bg_image_url, product_image_url, product_alt, icon_key, price, old_price, detail_line, metrics, specs, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(id) DO UPDATE SET
               eyebrow = excluded.eyebrow,
               title = excluded.title,
               accent = excluded.accent,
               copy = excluded.copy,
               href = excluded.href,
               cta = excluded.cta,
               bg_image_url = excluded.bg_image_url,
               product_image_url = excluded.product_image_url,
               product_alt = excluded.product_alt,
               icon_key = excluded.icon_key,
               price = excluded.price,
               old_price = excluded.old_price,
               detail_line = excluded.detail_line,
               metrics = excluded.metrics,
               specs = excluded.specs,
               sort_order = excluded.sort_order,
               updated_at = CURRENT_TIMESTAMP",
        )
        .bind(id)
        .bind(slide["eyebrow"].as_str())
        .bind(slide["title"].as_str())
        .bind(slide["accent"].as_str())
        .bind(slide["copy"].as_str())
        .bind(slide["href"].as_str())
        .bind(slide["cta"].as_str())
        .bind(bg_url)
        .bind(product_url)
        .bind(slide["productAlt"].as_str())
        .bind(slide["iconKey"].as_str())
        .bind(slide["price"].as_str())
        .bind(slide["oldPrice"].as_str())
        .bind(slide["detailLine"].as_str())
        .bind(serde_json::to_string(&slide["metrics"])?)
        .bind(serde_json::to_string(&slide["specs"])?)
        .bind(idx as i64)
        .execute(&mut *conn)
        .await?;
    }

    let categories = vec![
        (
            "sepeda-listrik",
            "Sepeda Listrik",
            "Solusi mobilitas cerdas dengan performa tinggi dan desain futuristik untuk gaya hidup modern.",
            "/produk?kategori=Sepeda+Listrik",
            landing_asset_url("assets/images/landing/categories/cat-mobility.webp", "category-mobility.webp")?,
            json!(["Eco Performance", "800W Power", "Smart Tech"]),
            "cyan",
            "bike",
        ),
        (
            "elektronik",
            "Elektronik",
            "Lengkapi rumah Anda dengan teknologi visual dan audio tercanggih dari brand ternama dunia.",
            "/produk?kategori=AC",
            landing_asset_url("assets/images/landing/categories/cat-electronics.webp", "category-electronics.webp")?,
            json!(["4K Ultra HD", "Smart Home", "Energy Efficient"]),
            "lime",
            "smartphone",
        ),
        (
            "furniture",
            "Furniture",
            "Ciptakan kenyamanan maksimal di setiap sudut ruangan dengan koleksi furniture eksklusif kami.",
            "/produk?kategori=SOPA",
            landing_asset_url("assets/images/landing/categories/cat-furniture.webp", "category-furniture.webp")?,
            json!(["Premium Fabric", "Ergonomic", "Elegant Design"]),
            "pink",
            "sofa",
        ),
        (
            "dining-set",
            "Dining Set",
            "Hadirkan kehangatan di ruang makan dengan set furnitur berkualitas yang dirancang dengan presisi.",
            "/produk?kategori=Meja",
            landing_asset_url("assets/images/landing/categories/cat-dining.webp", "category-dining.webp")?,
            json!(["Luxury Dining", "Craftsmanship", "Durable"]),
            "amber",
            "utensils",
        ),
    ];

    for (idx, (id, label, copy, href, image_url, tags, tone, icon_key)) in
        categories.iter().enumerate()
    {
        sqlx::query(
            "INSERT INTO landing_category_panels
             (id, label, copy, href, image_url, tags, tone, icon_key, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(id) DO UPDATE SET
               label = excluded.label,
               copy = excluded.copy,
               href = excluded.href,
               image_url = excluded.image_url,
               tags = excluded.tags,
               tone = excluded.tone,
               icon_key = excluded.icon_key,
               sort_order = excluded.sort_order,
               updated_at = CURRENT_TIMESTAMP",
        )
        .bind(id)
        .bind(label)
        .bind(copy)
        .bind(href)
        .bind(image_url)
        .bind(serde_json::to_string(tags)?)
        .bind(tone)
        .bind(icon_key)
        .bind(idx as i64)
        .execute(&mut *conn)
        .await?;
    }

    let smart_main = landing_asset_url(
        "assets/images/landing/smart-ride/smart-ride-main.png",
        "smart-ride-main.webp",
    )?;

    sqlx::query(
        "INSERT INTO landing_smart_ride
         (id, eyebrow, title, copy, main_image_url, main_image_alt, overlay_title, overlay_copy, stats, is_active)
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           eyebrow = excluded.eyebrow,
           title = excluded.title,
           copy = excluded.copy,
           main_image_url = excluded.main_image_url,
           main_image_alt = excluded.main_image_alt,
           overlay_title = excluded.overlay_title,
           overlay_copy = excluded.overlay_copy,
           stats = excluded.stats,
           updated_at = CURRENT_TIMESTAMP",
    )
    .bind("Smart Ride System")
    .bind("Detail produk dibuat seperti microsite, bukan katalog biasa.")
    .bind("Bagian ini cocok untuk sepeda listrik unggulan: ada highlight performa, kartu fitur, dan animasi scanning yang terasa elektronik tanpa mengganggu keterbacaan.")
    .bind(smart_main)
    .bind("Showcase teknologi sepeda listrik")
    .bind("Eco mode active")
    .bind("Baterai, rem, suspensi, dan jarak tempuh lebih gampang dipahami.")
    .bind(serde_json::to_string(&json!([
        {"value": "800W", "label": "Motor"},
        {"value": "60 km", "label": "Jarak"},
        {"value": "4-6 jam", "label": "Charging"},
        {"value": "150 kg", "label": "Beban"}
    ]))?)
    .execute(&mut *conn)
    .await?;

    let smart_features = vec![
        (
            "lampu-led-modern",
            "Lampu LED Modern",
            "Tampilan tajam, terang, dan hemat energi.",
            "assets/images/landing/smart-ride/smart-ride-lamp.png",
            "smart-ride-lamp.webp",
        ),
        (
            "baterai-efisien",
            "Baterai Efisien",
            "Dirancang untuk mobilitas harian yang lebih hemat.",
            "assets/images/landing/smart-ride/smart-ride-battery.png",
            "smart-ride-battery.webp",
        ),
        (
            "jok-nyaman",
            "Jok Nyaman",
            "Posisi duduk ergonomis untuk pengendara dan penumpang.",
            "assets/images/landing/smart-ride/smart-ride-seat.png",
            "smart-ride-seat.webp",
        ),
        (
            "body-futuristik",
            "Body Futuristik",
            "Finishing glossy dengan detail produk yang terasa premium.",
            "assets/images/landing/smart-ride/smart-ride-body.png",
            "smart-ride-body.webp",
        ),
    ];

    for (idx, (id, title, description, source, dest)) in smart_features.iter().enumerate() {
        sqlx::query(
            "INSERT INTO landing_smart_ride_features
             (id, title, description, image_url, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, 1)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               description = excluded.description,
               image_url = excluded.image_url,
               sort_order = excluded.sort_order,
               updated_at = CURRENT_TIMESTAMP",
        )
        .bind(id)
        .bind(title)
        .bind(description)
        .bind(landing_asset_url(source, dest)?)
        .bind(idx as i64)
        .execute(&mut *conn)
        .await?;
    }

    Ok(())
}

pub async fn seed_database(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    seed_landing_content(pool).await?;

    // Keep existing catalog data intact; only seed on an empty database.
    let product_count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM products")
        .fetch_one(pool)
        .await?;

    if product_count.0 > 0 {
        println!("Skipping seed: products already exist in database.");
        return Ok(());
    }

    println!("Checking seed data from seeds.json...");

    println!("Seeding database from seeds.json...");

    let seeds_raw = fs::read_to_string("seeds.json")?;
    let seeds: Value = serde_json::from_str(&seeds_raw)?;
    let is_full_seed_object = seeds.is_object();

    if !is_full_seed_object {
        println!(
            "Seed file format is not an object; skipping destructive cleanup and applying safe product-only seed mode."
        );
    }

    let products_seed = if is_full_seed_object {
        seeds["products"].as_array()
    } else {
        seeds.as_array()
    };

    // Clear existing data for a clean simulation
    let mut conn = pool.acquire().await?;
    if is_full_seed_object {
        println!("Wiping existing data for clean simulation...");
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM notifications")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM support_tickets")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM telemetry_events")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM leads").execute(&mut *conn).await?;
        sqlx::query("DELETE FROM agent_registrations")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM reward_claims")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM agent_achievements")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM agent_stats")
            .execute(&mut *conn)
            .await?;
        sqlx::query(
            "DELETE FROM users WHERE email NOT LIKE '%dandi%' AND email NOT LIKE '%admin%'",
        )
        .execute(&mut *conn)
        .await?;
        sqlx::query("DELETE FROM promos")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM products")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM blog_posts")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM job_listings")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM partners")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM reward_tiers")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM achievements")
            .execute(&mut *conn)
            .await?;
        sqlx::query("DELETE FROM product_categories")
            .execute(&mut *conn)
            .await?;
        // We leave foreign_keys OFF for the duration of the seeding to prevent REPLACE INTO constraint issues
    }

    // Seed Users
    if let Some(users) = seeds["users"].as_array() {
        for u in users {
            let id = u["id"].as_str().unwrap();
            let email = u["email"].as_str().unwrap();
            let name = u["name"].as_str().unwrap();
            let role = u["role"].as_str().unwrap();
            let password = u["password"].as_str().unwrap();
            let password_hash = hash_password(password);
            let avatar = u["avatar"].as_str().unwrap();
            let bank_account = u["bank_account"].as_str().unwrap_or("");

            let res = sqlx::query(
                "INSERT INTO users (id, email, name, role, password_hash, avatar, bank_account, is_active, is_verified) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1) \
                 ON CONFLICT(id) DO UPDATE SET \
                   email = excluded.email, \
                   name = excluded.name, \
                   role = excluded.role, \
                   password_hash = excluded.password_hash, \
                   avatar = excluded.avatar, \
                   bank_account = excluded.bank_account, \
                   is_active = 1, \
                   is_verified = 1"
            )
            .bind(id)
            .bind(email)
            .bind(name)
            .bind(role)
            .bind(password_hash)
            .bind(avatar)
            .bind(bank_account)
            .execute(&mut *conn)
            .await?;

            if res.rows_affected() > 0 {
                tracing::info!("Seeded user: {} (ID: {}, Role: {})", email, id, role);
            }
        }
    }

    // Seed Reward Tiers
    if let Some(tiers) = seeds["reward_tiers"].as_array() {
        for t in tiers {
            let benefits_json =
                serde_json::to_string(&t["benefits"]).unwrap_or_else(|_| "[]".to_string());
            let default_reward = match t["id"].as_str().unwrap_or_default() {
                "diamond" => 2_400_000,
                "gold" => 1_200_000,
                "silver" => 650_000,
                _ => 250_000,
            };
            let reward_value = t["reward_value"].as_i64().unwrap_or(default_reward);

            sqlx::query("REPLACE INTO reward_tiers (id, name, threshold_points, icon, color, benefits, reward_value) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(t["id"].as_str())
                .bind(t["name"].as_str())
                .bind(t["threshold_points"].as_i64())
                .bind(t["icon"].as_str())
                .bind(t["color"].as_str())
                .bind(benefits_json)
                .bind(reward_value)
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Agent Stats
    if let Some(stats) = seeds["agent_stats"].as_array() {
        for s in stats {
            sqlx::query("REPLACE INTO agent_stats (user_id, points, sales_count, monthly_growth, current_tier_id) VALUES (?, ?, ?, ?, ?)")
                .bind(s["user_id"].as_str())
                .bind(s["points"].as_i64())
                .bind(s["sales_count"].as_i64())
                .bind(s["monthly_growth"].as_f64())
                .bind(s["current_tier_id"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Achievements
    if let Some(achs) = seeds["achievements"].as_array() {
        for a in achs {
            sqlx::query("REPLACE INTO achievements (id, name, description, icon, color) VALUES (?, ?, ?, ?, ?)")
                .bind(a["id"].as_str())
                .bind(a["name"].as_str())
                .bind(a["description"].as_str())
                .bind(a["icon"].as_str())
                .bind(a["color"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Agent Achievements
    if let Some(agent_achs) = seeds["agent_achievements"].as_array() {
        for aa in agent_achs {
            sqlx::query("REPLACE INTO agent_achievements (agent_id, achievement_id) VALUES (?, ?)")
                .bind(aa["agent_id"].as_str())
                .bind(aa["achievement_id"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Reward Claims
    if let Some(claims) = seeds["reward_claims"].as_array() {
        for c in claims {
            sqlx::query("REPLACE INTO reward_claims (id, agent_id, tier_id, reward_name, status) VALUES (?, ?, ?, ?, ?)")
                .bind(c["id"].as_str())
                .bind(c["agent_id"].as_str())
                .bind(c["tier_id"].as_str())
                .bind(c["reward_name"].as_str())
                .bind(c["status"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Product Categories
    if let Some(categories) = seeds["product_categories"].as_array() {
        for c in categories {
            sqlx::query(
                "REPLACE INTO product_categories (id, name, slug, description) VALUES (?, ?, ?, ?)",
            )
            .bind(c["id"].as_str())
            .bind(c["name"].as_str())
            .bind(c["slug"].as_str())
            .bind(c["description"].as_str())
            .execute(&mut *conn)
            .await?;
        }
    }

    // Seed Products
    if let Some(products) = products_seed {
        for p in products {
            let specs_json =
                serde_json::to_string(&p["specs"]).unwrap_or_else(|_| "{}".to_string());
            let images_json =
                serde_json::to_string(&p["images"]).unwrap_or_else(|_| "[]".to_string());
            let colors_json =
                serde_json::to_string(&p["colors"]).unwrap_or_else(|_| "[]".to_string());
            let highlights_json =
                serde_json::to_string(&p["highlights"]).unwrap_or_else(|_| "[]".to_string());
            let selling_points_json =
                serde_json::to_string(&p["sellingPoints"]).unwrap_or_else(|_| "[]".to_string());
            let objections_json =
                serde_json::to_string(&p["objections"]).unwrap_or_else(|_| "[]".to_string());

            sqlx::query(
                 "REPLACE INTO products (id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, colors, highlights, selling_points, objections) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(p["id"].as_str())
            .bind(p["slug"].as_str())
            .bind(p["name"].as_str())
            .bind(p["category"].as_str())
            .bind(p["subcategory"].as_str())
            .bind(p["price"].as_f64())
            .bind(p["priceInstallment"].as_f64())
            .bind(p["dpMin"].as_f64())
            .bind(p["image"].as_str())
            .bind(images_json)
            .bind(p["badge"].as_str())
            .bind(p["badgeText"].as_str())
            .bind(p["shortDesc"].as_str())
            .bind(p["description"].as_str())
            .bind(specs_json)
            .bind(p["stock"].as_str())
            .bind(colors_json)
            .bind(highlights_json)
            .bind(selling_points_json)
            .bind(objections_json)
            .execute(&mut *conn)
            .await?;
        }
    }

    // Seed Promos
    if let Some(promos) = seeds["promos"].as_array() {
        for p in promos {
            let product_ids_json =
                serde_json::to_string(&p["productIds"]).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                "REPLACE INTO promos (id, title, subtitle, description, discount, original_price, promo_price, image, badge, valid_until, category, variant, product_ids) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(p["id"].as_str())
            .bind(p["title"].as_str())
            .bind(p["subtitle"].as_str())
            .bind(p["description"].as_str())
            .bind(p["discount"].as_i64())
            .bind(p["originalPrice"].as_f64())
            .bind(p["promoPrice"].as_f64())
            .bind(p["image"].as_str())
            .bind(p["badge"].as_str())
            .bind(p["validUntil"].as_str())
            .bind(p["category"].as_str())
            .bind(p["variant"].as_str())
            .bind(product_ids_json)
            .execute(&mut *conn)
            .await?;
        }
    }

    // Seed Blog Posts
    if let Some(posts) = seeds["blogPosts"].as_array() {
        for p in posts {
            let tags_json = serde_json::to_string(&p["tags"]).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                "REPLACE INTO blog_posts (id, slug, title, excerpt, author, author_role, author_image, hero_image, category, tags, published_at, read_time, featured) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(p["id"].as_str())
            .bind(p["slug"].as_str())
            .bind(p["title"].as_str())
            .bind(p["excerpt"].as_str())
            .bind(p["author"].as_str())
            .bind(p["authorRole"].as_str())
            .bind(p["authorImage"].as_str())
            .bind(p["heroImage"].as_str())
            .bind(p["category"].as_str())
            .bind(tags_json)
            .bind(p["publishedAt"].as_str())
            .bind(p["readTime"].as_i64())
            .bind(p["featured"].as_bool())
            .execute(&mut *conn)
            .await?;
        }
    }

    // Seed Job Listings
    if let Some(jobs) = seeds["jobListings"].as_array() {
        for j in jobs {
            let requirements_json =
                serde_json::to_string(&j["requirements"]).unwrap_or_else(|_| "[]".to_string());
            let benefits_json =
                serde_json::to_string(&j["benefits"]).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                "REPLACE INTO job_listings (id, title, department, location, type, level, description, requirements, benefits, posted_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(j["id"].as_str())
            .bind(j["title"].as_str())
            .bind(j["department"].as_str())
            .bind(j["location"].as_str())
            .bind(j["type"].as_str())
            .bind(j["level"].as_str())
            .bind(j["description"].as_str())
            .bind(requirements_json)
            .bind(benefits_json)
            .bind(j["postedAt"].as_str())
            .execute(&mut *conn)
            .await?;
        }
    }

    // Seed Partners
    if let Some(partners) = seeds["partners"].as_array() {
        for p in partners {
            sqlx::query(
                "REPLACE INTO partners (id, name, logo_url, sort_order) VALUES (?, ?, ?, ?)",
            )
            .bind(p["id"].as_str())
            .bind(p["name"].as_str())
            .bind(p["logo_url"].as_str())
            .bind(p["sort_order"].as_i64().unwrap_or(0))
            .execute(&mut *conn)
            .await?;
        }
    }

    // Seed Agent Registrations
    if let Some(regs) = seeds["agent_registrations"].as_array() {
        for r in regs {
            let preferred_json = serde_json::to_string(&r["preferred_products"])
                .unwrap_or_else(|_| "[]".to_string());
            sqlx::query("REPLACE INTO agent_registrations (id, full_name, email, whatsapp, province, city, address, preferred_products, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(r["id"].as_str())
                .bind(r["full_name"].as_str())
                .bind(r["email"].as_str())
                .bind(r["whatsapp"].as_str())
                .bind(r["province"].as_str())
                .bind(r["city"].as_str())
                .bind(r["address"].as_str())
                .bind(preferred_json)
                .bind(r["status"].as_str())
                .bind(r["submitted_at"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Leads
    if let Some(leads) = seeds["leads"].as_array() {
        for l in leads {
            sqlx::query("REPLACE INTO leads (id, agent_id, customer_name, phone_number, interested_product, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(l["id"].as_str())
                .bind(l["agent_id"].as_str())
                .bind(l["customer_name"].as_str())
                .bind(l["phone_number"].as_str())
                .bind(l["interested_product"].as_str())
                .bind(l["status"].as_str())
                .bind(l["notes"].as_str())
                .bind(l["created_at"].as_str())
                .bind(l["updated_at"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Telemetry Events
    if let Some(events) = seeds["telemetry_events"].as_array() {
        for e in events {
            let metadata_json =
                serde_json::to_string(&e["metadata"]).unwrap_or_else(|_| "{}".to_string());
            sqlx::query("REPLACE INTO telemetry_events (id, event_type, path, source, session_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(e["id"].as_str())
                .bind(e["event_type"].as_str())
                .bind(e["path"].as_str())
                .bind(e["source"].as_str())
                .bind(e["session_id"].as_str())
                .bind(metadata_json)
                .bind(e["created_at"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Referrals
    if let Some(referrals) = seeds["referrals"].as_array() {
        for r in referrals {
            sqlx::query("REPLACE INTO referrals (id, slug, owner_user_id, label, target_path, clicks, leads, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(r["id"].as_str())
                .bind(r["slug"].as_str())
                .bind(r["owner_user_id"].as_str())
                .bind(r["label"].as_str())
                .bind(r["target_path"].as_str())
                .bind(r["clicks"].as_i64())
                .bind(r["leads"].as_i64())
                .bind(r["is_active"].as_bool())
                .bind(r["created_at"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Notifications
    if let Some(notifs) = seeds["notifications"].as_array() {
        for n in notifs {
            sqlx::query("REPLACE INTO notifications (id, recipient_user_id, type, title, message, action_path, entity_id, is_read, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(n["id"].as_str())
                .bind(n["recipient_user_id"].as_str())
                .bind(n["type"].as_str())
                .bind(n["title"].as_str())
                .bind(n["message"].as_str())
                .bind(n["action_path"].as_str())
                .bind(n["entity_id"].as_str())
                .bind(n["is_read"].as_bool())
                .bind(n["created_at"].as_str())
                .bind(n["read_at"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    if is_full_seed_object {
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&mut *conn)
            .await?;
    }

    println!("Database seeding completed successfully!");
    Ok(())
}
