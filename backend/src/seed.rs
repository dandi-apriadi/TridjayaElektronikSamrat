use sqlx::SqlitePool;
use serde_json::Value;
use std::fs;
use crate::auth::hash_password;

pub async fn seed_database(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
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

    // Clear existing data for a clean simulation
    println!("Wiping existing data for clean simulation...");
    let mut conn = pool.acquire().await?;
    sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM notifications").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM support_tickets").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM telemetry_events").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM leads").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM agent_registrations").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM reward_claims").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM agent_achievements").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM agent_stats").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM users WHERE email NOT LIKE '%dandi%' AND email NOT LIKE '%admin%'").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM promos").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM products").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM blog_posts").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM job_listings").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM partners").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM reward_tiers").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM achievements").execute(&mut *conn).await?;
    sqlx::query("DELETE FROM product_categories").execute(&mut *conn).await?;
    // We leave foreign_keys OFF for the duration of the seeding to prevent REPLACE INTO constraint issues

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
            let benefits_json = serde_json::to_string(&t["benefits"]).unwrap_or_else(|_| "[]".to_string());
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
            sqlx::query("REPLACE INTO product_categories (id, name, slug, description) VALUES (?, ?, ?, ?)")
                .bind(c["id"].as_str())
                .bind(c["name"].as_str())
                .bind(c["slug"].as_str())
                .bind(c["description"].as_str())
                .execute(&mut *conn)
                .await?;
        }
    }

    // Seed Products
    if let Some(products) = seeds["products"].as_array() {
        for p in products {
            let specs_json = serde_json::to_string(&p["specs"]).unwrap_or_else(|_| "{}".to_string());
            let images_json = serde_json::to_string(&p["images"]).unwrap_or_else(|_| "[]".to_string());
            let colors_json = serde_json::to_string(&p["colors"]).unwrap_or_else(|_| "[]".to_string());
            let highlights_json = serde_json::to_string(&p["highlights"]).unwrap_or_else(|_| "[]".to_string());
            let selling_points_json = serde_json::to_string(&p["sellingPoints"]).unwrap_or_else(|_| "[]".to_string());
            let objections_json = serde_json::to_string(&p["objections"]).unwrap_or_else(|_| "[]".to_string());

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
            let product_ids_json = serde_json::to_string(&p["productIds"]).unwrap_or_else(|_| "[]".to_string());
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
            .bind(p["author_role"].as_str())
            .bind(p["author_image"].as_str())
            .bind(p["hero_image"].as_str())
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
            let requirements_json = serde_json::to_string(&j["requirements"]).unwrap_or_else(|_| "[]".to_string());
            let benefits_json = serde_json::to_string(&j["benefits"]).unwrap_or_else(|_| "[]".to_string());
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
            sqlx::query("REPLACE INTO partners (id, name, logo_url, sort_order) VALUES (?, ?, ?, ?)")
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
            let preferred_json = serde_json::to_string(&r["preferred_products"]).unwrap_or_else(|_| "[]".to_string());
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
            let metadata_json = serde_json::to_string(&e["metadata"]).unwrap_or_else(|_| "{}".to_string());
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
    
    sqlx::query("PRAGMA foreign_keys = ON").execute(&mut *conn).await?;

    println!("Database seeding completed successfully!");
    Ok(())
}
