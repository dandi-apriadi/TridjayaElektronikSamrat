use crate::{
    auth::{authorize, login_with_request, logout_with_headers, refresh_with_request, LoginRequest, RefreshRequest, Role},
    response::{json_ok, AppError},
    state::{AppState, UserPublic},
};
use axum::{extract::{Path, State}, http::HeaderMap, routing::{get, post, patch}, Json, Router};
use serde_json::{json, Value};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/refresh", post(refresh))
        .route("/api/auth/forgot-password", post(forgot_password))
        .route("/api/auth/reset-password", post(reset_password))
        .route("/api/users", get(list_users).post(create_user))
        .route("/api/users/{id}", get(get_user).patch(update_user).delete(delete_user))
        .route("/api/catalogs", get(list_catalogs).post(create_catalog))
        .route("/api/catalogs/{id}", get(get_catalog).patch(update_catalog).delete(delete_catalog))
        .route("/api/promotions", get(list_promotions).post(create_promotion))
        .route("/api/promotions/{id}", patch(update_promotion).delete(delete_promotion))
        .route("/api/referrals/generate", post(generate_referral))
        .route("/api/referrals", get(list_referrals))
        .route("/api/referrals/{slug}", get(get_referral))
        .route("/api/referrals/{slug}/stats", get(get_referral_stats))
        .route("/api/telemetry/page-view", post(page_view))
        .route("/api/telemetry/click", post(click))
        .route("/api/telemetry/whatsapp-click", post(whatsapp_click))
        .route("/api/telemetry/pixel-event", post(pixel_event))
        .route("/api/jobs", get(list_jobs).post(create_job))
        .route("/api/jobs/{id}", patch(update_job))
        .route("/api/articles", get(list_articles).post(create_article))
        .route("/api/articles/{id}", patch(update_article))
        .with_state(state)
}

async fn health() -> ResponseBody {
    json_ok("OK", json!({ "status": "healthy" }))
}

async fn login(State(state): State<AppState>, Json(payload): Json<LoginRequest>) -> Result<ResponseBody, AppError> {
    let auth = login_with_request(&state, payload).await?;
    Ok(json_ok("Login successful", auth))
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    logout_with_headers(&state, &headers).await?;
    Ok(json_ok("Logout successful", json!({ "logged_out": true })))
}

async fn refresh(State(state): State<AppState>, Json(payload): Json<RefreshRequest>) -> Result<ResponseBody, AppError> {
    let auth = refresh_with_request(&state, payload).await?;
    Ok(json_ok("Token refreshed", auth))
}

async fn forgot_password() -> ResponseBody {
    json_ok("If the account exists, reset instructions will be sent", json!({ "accepted": true }))
}

async fn reset_password() -> ResponseBody {
    json_ok("Password reset completed", json!({ "reset": true }))
}

async fn list_users(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    let users: Vec<UserPublic> = sqlx::query_as("SELECT id, email, name, role, avatar, is_active FROM users")
        .fetch_all(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;
        
    Ok(json_ok(format!("Users fetched by {}", user.email), json!({ "items": users })))
}

async fn create_user(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    Ok(json_ok(format!("User created by {}", user.email), json!({ "received": payload })))
}

async fn get_user(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    Ok(json_ok(format!("User {} fetched by {}", id, user.email), json!({ "id": id })))
}

async fn update_user(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    Ok(json_ok(format!("User {} updated by {}", id, user.email), json!({ "id": id, "received": payload })))
}

async fn delete_user(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    Ok(json_ok(format!("User {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
}

async fn list_catalogs(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let products: Vec<Value> = sqlx::query("SELECT * FROM products")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<String, _>("id"),
                "slug": row.get::<String, _>("slug"),
                "name": row.get::<String, _>("name"),
                "category": row.get::<String, _>("category"),
                "subcategory": row.get::<Option<String>, _>("subcategory"),
                "price": row.get::<f64, _>("price"),
                "priceInstallment": row.get::<Option<f64>, _>("price_installment"),
                "dpMin": row.get::<Option<f64>, _>("dp_min"),
                "image": row.get::<String, _>("image"),
                "images": serde_json::from_str::<Value>(&row.get::<String, _>("images")).unwrap_or(json!([])),
                "badge": row.get::<Option<String>, _>("badge"),
                "badgeText": row.get::<Option<String>, _>("badge_text"),
                "rating": row.get::<f64, _>("rating"),
                "reviewCount": row.get::<i64, _>("review_count"),
                "shortDesc": row.get::<Option<String>, _>("short_desc"),
                "description": row.get::<Option<String>, _>("description"),
                "specs": serde_json::from_str::<Value>(&row.get::<String, _>("specs")).unwrap_or(json!({})),
                "stock": row.get::<String, _>("stock"),
                "colors": serde_json::from_str::<Value>(&row.get::<String, _>("colors")).unwrap_or(json!([])),
            })
        })
        .collect();

    Ok(json_ok("Catalogs fetched", json!({ "items": products })))
}

async fn create_catalog(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    Ok(json_ok(format!("Catalog created by {}", user.email), json!({ "received": payload })))
}

async fn get_catalog() -> ResponseBody {
    json_ok("Catalog fetched", json!({ "id": "demo" }))
}

async fn update_catalog(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    Ok(json_ok(format!("Catalog {} updated by {}", id, user.email), json!({ "id": id, "received": payload })))
}

async fn delete_catalog(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    Ok(json_ok(format!("Catalog {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
}

async fn list_promotions(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let promos: Vec<Value> = sqlx::query("SELECT * FROM promos")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<String, _>("id"),
                "title": row.get::<String, _>("title"),
                "subtitle": row.get::<Option<String>, _>("subtitle"),
                "description": row.get::<Option<String>, _>("description"),
                "discount": row.get::<Option<i64>, _>("discount"),
                "originalPrice": row.get::<Option<f64>, _>("original_price"),
                "promoPrice": row.get::<Option<f64>, _>("promo_price"),
                "image": row.get::<String, _>("image"),
                "badge": row.get::<Option<String>, _>("badge"),
                "validUntil": row.get::<Option<String>, _>("valid_until"),
                "category": row.get::<Option<String>, _>("category"),
                "variant": row.get::<Option<String>, _>("variant"),
                "productIds": serde_json::from_str::<Value>(&row.get::<String, _>("product_ids")).unwrap_or(json!([])),
            })
        })
        .collect();
    Ok(json_ok("Promotions fetched", json!({ "items": promos })))
}

async fn create_promotion(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
    Ok(json_ok(format!("Promotion created by {}", user.email), json!({ "received": payload })))
}

async fn update_promotion(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
    Ok(json_ok(format!("Promotion {} updated by {}", id, user.email), json!({ "id": id, "received": payload })))
}

async fn delete_promotion(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    Ok(json_ok(format!("Promotion {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
}

async fn generate_referral(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    Ok(json_ok(
        format!("Referral generated by {}", user.email),
        json!({ "slug": format!("ref-{}", uuid::Uuid::new_v4().simple()), "received": payload }),
    ))
}

async fn list_referrals(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    Ok(json_ok(format!("Referrals fetched by {}", user.email), json!({ "items": [] })))
}

async fn get_referral(State(state): State<AppState>, headers: HeaderMap, Path(slug): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    Ok(json_ok(format!("Referral {} fetched by {}", slug, user.email), json!({ "slug": slug })))
}

async fn get_referral_stats(State(state): State<AppState>, headers: HeaderMap, Path(slug): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    Ok(json_ok(format!("Referral {} stats fetched by {}", slug, user.email), json!({ "slug": slug, "clicks": 0, "leads": 0 })))
}

async fn page_view(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    state.audit("telemetry.page_view", None).await;
    json_ok("Page view recorded", json!({ "received": payload }))
}

async fn click(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    state.audit("telemetry.click", None).await;
    json_ok("Click recorded", json!({ "received": payload }))
}

async fn whatsapp_click(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    state.audit("telemetry.whatsapp_click", None).await;
    json_ok("WhatsApp click recorded", json!({ "received": payload }))
}

async fn pixel_event(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    state.audit("telemetry.pixel_event", None).await;
    json_ok("Pixel event recorded", json!({ "received": payload }))
}

async fn list_jobs(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    let jobs: Vec<Value> = sqlx::query("SELECT * FROM job_listings")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<String, _>("id"),
                "title": row.get::<String, _>("title"),
                "department": row.get::<Option<String>, _>("department"),
                "location": row.get::<Option<String>, _>("location"),
                "type": row.get::<Option<String>, _>("type"),
                "level": row.get::<Option<String>, _>("level"),
                "description": row.get::<Option<String>, _>("description"),
                "requirements": serde_json::from_str::<Value>(&row.get::<String, _>("requirements")).unwrap_or(json!([])),
                "benefits": serde_json::from_str::<Value>(&row.get::<String, _>("benefits")).unwrap_or(json!([])),
                "postedAt": row.get::<Option<String>, _>("posted_at"),
            })
        })
        .collect();
    Ok(json_ok(format!("Jobs fetched by {}", user.email), json!({ "items": jobs })))
}

async fn create_job(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    Ok(json_ok(format!("Job created by {}", user.email), json!({ "received": payload })))
}

async fn update_job(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    Ok(json_ok(format!("Job {} updated by {}", id, user.email), json!({ "id": id, "received": payload })))
}

async fn list_articles(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    let articles: Vec<Value> = sqlx::query("SELECT * FROM blog_posts")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<String, _>("id"),
                "slug": row.get::<String, _>("slug"),
                "title": row.get::<String, _>("title"),
                "excerpt": row.get::<Option<String>, _>("excerpt"),
                "author": row.get::<Option<String>, _>("author"),
                "authorRole": row.get::<Option<String>, _>("author_role"),
                "authorImage": row.get::<Option<String>, _>("author_image"),
                "heroImage": row.get::<Option<String>, _>("hero_image"),
                "category": row.get::<Option<String>, _>("category"),
                "tags": serde_json::from_str::<Value>(&row.get::<String, _>("tags")).unwrap_or(json!([])),
                "publishedAt": row.get::<Option<String>, _>("published_at"),
                "readTime": row.get::<Option<i64>, _>("read_time"),
                "featured": row.get::<bool, _>("featured"),
            })
        })
        .collect();
    Ok(json_ok(format!("Articles fetched by {}", user.email), json!({ "items": articles })))
}

async fn create_article(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
    Ok(json_ok(format!("Article created by {}", user.email), json!({ "received": payload })))
}

async fn update_article(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
    Ok(json_ok(format!("Article {} updated by {}", id, user.email), json!({ "id": id, "received": payload })))
}

type ResponseBody = axum::response::Response;
