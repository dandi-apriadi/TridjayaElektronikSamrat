use sqlx::SqlitePool;
use serde_json::Value;
use std::fs;
use crate::auth::hash_password;

pub async fn seed_database(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    // Check if users table is empty
    let user_count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if user_count.0 > 0 {
        println!("Database already has data, skipping seeding.");
        return Ok(());
    }

    println!("Seeding database from seeds.json...");

    let seeds_raw = fs::read_to_string("seeds.json")?;
    let seeds: Value = serde_json::from_str(&seeds_raw)?;

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

            sqlx::query(
                "INSERT INTO users (id, email, name, role, password_hash, avatar, bank_account) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(email)
            .bind(name)
            .bind(role)
            .bind(password_hash)
            .bind(avatar)
            .bind(bank_account)
            .execute(pool)
            .await?;
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

            sqlx::query("INSERT INTO reward_tiers (id, name, threshold_points, icon, color, benefits, reward_value) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(t["id"].as_str())
                .bind(t["name"].as_str())
                .bind(t["threshold_points"].as_i64())
                .bind(t["icon"].as_str())
                .bind(t["color"].as_str())
                .bind(benefits_json)
                .bind(reward_value)
                .execute(pool)
                .await?;
        }
    }

    // Seed Agent Stats
    if let Some(stats) = seeds["agent_stats"].as_array() {
        for s in stats {
            sqlx::query("INSERT INTO agent_stats (user_id, points, sales_count, monthly_growth, current_tier_id) VALUES (?, ?, ?, ?, ?)")
                .bind(s["user_id"].as_str())
                .bind(s["points"].as_i64())
                .bind(s["sales_count"].as_i64())
                .bind(s["monthly_growth"].as_f64())
                .bind(s["current_tier_id"].as_str())
                .execute(pool)
                .await?;
        }
    }

    // Seed Achievements
    if let Some(achs) = seeds["achievements"].as_array() {
        for a in achs {
            sqlx::query("INSERT INTO achievements (id, name, description, icon, color) VALUES (?, ?, ?, ?, ?)")
                .bind(a["id"].as_str())
                .bind(a["name"].as_str())
                .bind(a["description"].as_str())
                .bind(a["icon"].as_str())
                .bind(a["color"].as_str())
                .execute(pool)
                .await?;
        }
    }

    // Seed Agent Achievements
    if let Some(agent_achs) = seeds["agent_achievements"].as_array() {
        for aa in agent_achs {
            sqlx::query("INSERT INTO agent_achievements (agent_id, achievement_id) VALUES (?, ?)")
                .bind(aa["agent_id"].as_str())
                .bind(aa["achievement_id"].as_str())
                .execute(pool)
                .await?;
        }
    }

    // Seed Reward Claims
    if let Some(claims) = seeds["reward_claims"].as_array() {
        for c in claims {
            sqlx::query("INSERT INTO reward_claims (id, agent_id, tier_id, reward_name, status) VALUES (?, ?, ?, ?, ?)")
                .bind(c["id"].as_str())
                .bind(c["agent_id"].as_str())
                .bind(c["tier_id"].as_str())
                .bind(c["reward_name"].as_str())
                .bind(c["status"].as_str())
                .execute(pool)
                .await?;
        }
    }

    // Seed Products
    if let Some(products) = seeds["products"].as_array() {
        for p in products {
            let specs_json = serde_json::to_string(&p["specs"]).unwrap_or_else(|_| "{}".to_string());
            let images_json = serde_json::to_string(&p["images"]).unwrap_or_else(|_| "[]".to_string());
            let colors_json = serde_json::to_string(&p["colors"]).unwrap_or_else(|_| "[]".to_string());

            sqlx::query(
                "INSERT INTO products (id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, rating, review_count, short_desc, description, specs, stock, colors) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
            .bind(p["rating"].as_f64())
            .bind(p["reviewCount"].as_i64())
            .bind(p["shortDesc"].as_str())
            .bind(p["description"].as_str())
            .bind(specs_json)
            .bind(p["stock"].as_str())
            .bind(colors_json)
            .execute(pool)
            .await?;
        }
    }

    // Seed Promos
    if let Some(promos) = seeds["promos"].as_array() {
        for p in promos {
            let product_ids_json = serde_json::to_string(&p["productIds"]).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                "INSERT INTO promos (id, title, subtitle, description, discount, original_price, promo_price, image, badge, valid_until, category, variant, product_ids) 
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
            .execute(pool)
            .await?;
        }
    }

    // Seed Blog Posts
    if let Some(posts) = seeds["blogPosts"].as_array() {
        for p in posts {
            let tags_json = serde_json::to_string(&p["tags"]).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                "INSERT INTO blog_posts (id, slug, title, excerpt, author, author_role, author_image, hero_image, category, tags, published_at, read_time, featured) 
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
            .execute(pool)
            .await?;
        }
    }

    // Seed Job Listings
    if let Some(jobs) = seeds["jobListings"].as_array() {
        for j in jobs {
            let requirements_json = serde_json::to_string(&j["requirements"]).unwrap_or_else(|_| "[]".to_string());
            let benefits_json = serde_json::to_string(&j["benefits"]).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                "INSERT INTO job_listings (id, title, department, location, type, level, description, requirements, benefits, posted_at) 
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
            .execute(pool)
            .await?;
        }
    }

    println!("Database seeding completed successfully!");
    Ok(())
}
