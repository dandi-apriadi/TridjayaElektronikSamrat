use crate::auth::hash_password;
use serde_json::json;
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

    // Seed standard reward tiers (Master Data)
    let tier_count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM reward_tiers")
        .fetch_one(pool)
        .await?;

    if tier_count.0 == 0 {
        println!("Seeding standard reward tiers...");
        let tiers = vec![
            (
                "silver",
                "Silver Tier",
                0,
                "medal",
                "#94a3b8",
                "[\"Extra commission bonus\"]",
                250000,
            ),
            (
                "gold",
                "Gold Tier",
                10000,
                "trophy",
                "#fbbf24",
                "[\"Premium support\", \"Custom profile badge\"]",
                1200000,
            ),
            (
                "diamond",
                "Diamond Tier",
                50000,
                "crown",
                "#22d3ee",
                "[\"Priority lead access\", \"Exclusive events\"]",
                2400000,
            ),
        ];
        for (id, name, threshold, icon, color, benefits, reward) in tiers {
            sqlx::query("INSERT INTO reward_tiers (id, name, threshold_points, icon, color, benefits, reward_value) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(id)
                .bind(name)
                .bind(threshold)
                .bind(icon)
                .bind(color)
                .bind(benefits)
                .bind(reward)
                .execute(pool)
                .await?;
        }
    }

    // Seed Partners (Master Data)
    let partner_count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM partners")
        .fetch_one(pool)
        .await?;

    if partner_count.0 == 0 {
        println!("Seeding partners...");
        let partners = vec![
            ("p-001", "Saige", "/uploads/landing/partner-saige.webp", 1),
            (
                "p-002",
                "Uwinfly",
                "/uploads/landing/partner-uwinfly.webp",
                2,
            ),
            ("p-003", "Goda", "/uploads/landing/partner-goda.webp", 3),
            ("p-004", "Exotic", "/uploads/landing/partner-exotic.webp", 4),
        ];
        for (id, name, logo, order) in partners {
            sqlx::query(
                "INSERT INTO partners (id, name, logo_url, sort_order) VALUES (?, ?, ?, ?)",
            )
            .bind(id)
            .bind(name)
            .bind(logo)
            .bind(order)
            .execute(pool)
            .await?;
        }
    }

    // Only seed the admin user if no users exist
    let user_count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if user_count.0 == 0 {
        println!("Seeding default admin user...");
        let password_hash = hash_password("admin123");
        sqlx::query(
            "INSERT INTO users (id, email, name, role, password_hash, avatar, is_active, is_verified) \
             VALUES (?, ?, ?, ?, ?, ?, 1, 1)"
        )
        .bind("adm-001")
        .bind("admin@gmail.com")
        .bind("Administrator Tridjaya")
        .bind("admin")
        .bind(password_hash)
        .bind("/avatars/default.webp")
        .execute(pool)
        .await?;
    }

    println!("Database seeding completed (Landing content & basic setup).");
    Ok(())
}
