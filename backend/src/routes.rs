use crate::{
    auth::{authorize, login_with_request, logout_with_headers, refresh_with_request, LoginRequest, RefreshRequest, Role},
    response::{json_ok, AppError},
    state::AppState,
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
    let users = state.users.read().await.values().map(|record| record.public()).collect::<Vec<_>>();
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

async fn list_catalogs() -> ResponseBody {
    json_ok("Catalogs fetched", json!({ "items": [] }))
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

async fn list_promotions() -> ResponseBody {
    json_ok("Promotions fetched", json!({ "items": [] }))
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
    Ok(json_ok(format!("Jobs fetched by {}", user.email), json!({ "items": [] })))
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
    Ok(json_ok(format!("Articles fetched by {}", user.email), json!({ "items": [] })))
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
