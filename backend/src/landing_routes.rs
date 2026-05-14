use crate::{
    auth::{authorize, Role},
    response::{json_ok, AppError, ResponseBody},
    state::AppState,
};
use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
    http::HeaderMap,
    routing::{get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LandingHeroSlide {
    id: String,
    eyebrow: String,
    title: String,
    accent: String,
    copy: String,
    href: String,
    cta: String,
    bg_image_url: String,
    product_image_url: String,
    product_alt: String,
    icon_key: String,
    price: String,
    old_price: String,
    detail_line: String,
    metrics: Value,
    specs: Value,
    sort_order: i64,
    is_active: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct LandingHeroSlideRow {
    id: String,
    eyebrow: String,
    title: String,
    accent: String,
    copy: String,
    href: String,
    cta: String,
    bg_image_url: String,
    product_image_url: String,
    product_alt: String,
    icon_key: String,
    price: String,
    old_price: String,
    detail_line: String,
    metrics: String,
    specs: String,
    sort_order: i64,
    is_active: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LandingCategoryPanel {
    id: String,
    label: String,
    copy: String,
    href: String,
    image_url: String,
    tags: Value,
    tone: String,
    icon_key: String,
    sort_order: i64,
    is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LandingSmartRide {
    id: String,
    eyebrow: String,
    title: String,
    copy: String,
    main_image_url: String,
    main_image_alt: String,
    overlay_title: String,
    overlay_copy: String,
    stats: Value,
    is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LandingSmartRideFeature {
    id: String,
    title: String,
    description: String,
    image_url: String,
    sort_order: i64,
    is_active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LandingSlidePayload {
    eyebrow: Option<String>,
    title: Option<String>,
    accent: Option<String>,
    copy: Option<String>,
    href: Option<String>,
    cta: Option<String>,
    bg_image_url: Option<String>,
    product_image_url: Option<String>,
    product_alt: Option<String>,
    icon_key: Option<String>,
    price: Option<String>,
    old_price: Option<String>,
    detail_line: Option<String>,
    metrics: Option<Value>,
    specs: Option<Value>,
    sort_order: Option<i64>,
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlideOrderItem {
    id: String,
    sort_order: i64,
}

pub fn router() -> Router<AppState> {
    let upload_routes = Router::new()
        .route(
            "/api/admin/landing/slides/upload",
            post(upload_landing_slide_image),
        )
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024));

    Router::new()
        .route("/api/landing/home", get(get_landing_home))
        .route(
            "/api/admin/landing/slides",
            get(list_admin_landing_slides).post(create_landing_slide),
        )
        .route(
            "/api/admin/landing/slides/order",
            patch(update_landing_slide_order),
        )
        .route(
            "/api/admin/landing/slides/{id}",
            patch(update_landing_slide).delete(delete_landing_slide),
        )
        .merge(upload_routes)
}

fn parse_json_value(raw: String, fallback: Value) -> Value {
    serde_json::from_str(&raw).unwrap_or(fallback)
}

fn row_to_slide(row: LandingHeroSlideRow) -> LandingHeroSlide {
    LandingHeroSlide {
        id: row.id,
        eyebrow: row.eyebrow,
        title: row.title,
        accent: row.accent,
        copy: row.copy,
        href: row.href,
        cta: row.cta,
        bg_image_url: row.bg_image_url,
        product_image_url: row.product_image_url,
        product_alt: row.product_alt,
        icon_key: row.icon_key,
        price: row.price,
        old_price: row.old_price,
        detail_line: row.detail_line,
        metrics: parse_json_value(row.metrics, json!([])),
        specs: parse_json_value(row.specs, json!([])),
        sort_order: row.sort_order,
        is_active: row.is_active != 0,
    }
}

async fn fetch_slide(state: &AppState, id: &str) -> Result<LandingHeroSlide, AppError> {
    let row = sqlx::query_as::<_, LandingHeroSlideRow>(
        "SELECT id, eyebrow, title, accent, copy, href, cta, bg_image_url, product_image_url,
                product_alt, icon_key, price, old_price, detail_line, metrics, specs, sort_order, is_active
         FROM landing_hero_slides WHERE id = ? LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching landing slide: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    Ok(row_to_slide(row))
}

async fn get_landing_home(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let slides = sqlx::query_as::<_, LandingHeroSlideRow>(
        "SELECT id, eyebrow, title, accent, copy, href, cta, bg_image_url, product_image_url,
                product_alt, icon_key, price, old_price, detail_line, metrics, specs, sort_order, is_active
         FROM landing_hero_slides WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching landing hero slides: {}", e);
        AppError::Internal
    })?
    .into_iter()
    .map(row_to_slide)
    .collect::<Vec<_>>();

    let category_panels = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            i64,
            i64,
        ),
    >(
        "SELECT id, label, copy, href, image_url, tags, tone, icon_key, sort_order, is_active
         FROM landing_category_panels WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching landing categories: {}", e);
        AppError::Internal
    })?
    .into_iter()
    .map(|row| LandingCategoryPanel {
        id: row.0,
        label: row.1,
        copy: row.2,
        href: row.3,
        image_url: row.4,
        tags: parse_json_value(row.5, json!([])),
        tone: row.6,
        icon_key: row.7,
        sort_order: row.8,
        is_active: row.9 != 0,
    })
    .collect::<Vec<_>>();

    let smart_ride = sqlx::query_as::<_, (String, String, String, String, String, String, String, String, String, i64)>(
        "SELECT id, eyebrow, title, copy, main_image_url, main_image_alt, overlay_title, overlay_copy, stats, is_active
         FROM landing_smart_ride WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching smart ride section: {}", e);
        AppError::Internal
    })?
    .map(|row| LandingSmartRide {
        id: row.0,
        eyebrow: row.1,
        title: row.2,
        copy: row.3,
        main_image_url: row.4,
        main_image_alt: row.5,
        overlay_title: row.6,
        overlay_copy: row.7,
        stats: parse_json_value(row.8, json!([])),
        is_active: row.9 != 0,
    });

    let smart_ride_features = sqlx::query_as::<_, (String, String, String, String, i64, i64)>(
        "SELECT id, title, description, image_url, sort_order, is_active
         FROM landing_smart_ride_features WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching smart ride features: {}", e);
        AppError::Internal
    })?
    .into_iter()
    .map(|row| LandingSmartRideFeature {
        id: row.0,
        title: row.1,
        description: row.2,
        image_url: row.3,
        sort_order: row.4,
        is_active: row.5 != 0,
    })
    .collect::<Vec<_>>();

    Ok(json_ok(
        "Landing home fetched",
        json!({
            "heroSlides": slides,
            "categoryPanels": category_panels,
            "smartRide": smart_ride,
            "smartRideFeatures": smart_ride_features,
        }),
    ))
}

async fn list_admin_landing_slides(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let items = sqlx::query_as::<_, LandingHeroSlideRow>(
        "SELECT id, eyebrow, title, accent, copy, href, cta, bg_image_url, product_image_url,
                product_alt, icon_key, price, old_price, detail_line, metrics, specs, sort_order, is_active
         FROM landing_hero_slides ORDER BY sort_order ASC, created_at ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching admin landing slides: {}", e);
        AppError::Internal
    })?
    .into_iter()
    .map(row_to_slide)
    .collect::<Vec<_>>();

    Ok(json_ok("Landing slides fetched", json!({ "items": items })))
}

fn validate_slide(slide: &LandingHeroSlide) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if slide.title.trim().is_empty() {
        errors.push("Judul slide wajib diisi".to_string());
    }
    if slide.eyebrow.trim().is_empty() {
        errors.push("Eyebrow slide wajib diisi".to_string());
    }
    if slide.bg_image_url.trim().is_empty() {
        errors.push("Background image wajib diisi".to_string());
    }
    if slide.product_image_url.trim().is_empty() {
        errors.push("Product image wajib diisi".to_string());
    }
    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
    }
    Ok(())
}

async fn upsert_slide(state: &AppState, slide: &LandingHeroSlide) -> Result<(), AppError> {
    validate_slide(slide)?;
    sqlx::query(
        "INSERT INTO landing_hero_slides
         (id, eyebrow, title, accent, copy, href, cta, bg_image_url, product_image_url, product_alt, icon_key, price, old_price, detail_line, metrics, specs, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
           is_active = excluded.is_active,
           updated_at = CURRENT_TIMESTAMP",
    )
    .bind(&slide.id)
    .bind(slide.eyebrow.trim())
    .bind(slide.title.trim())
    .bind(slide.accent.trim())
    .bind(slide.copy.trim())
    .bind(slide.href.trim())
    .bind(slide.cta.trim())
    .bind(slide.bg_image_url.trim())
    .bind(slide.product_image_url.trim())
    .bind(slide.product_alt.trim())
    .bind(slide.icon_key.trim())
    .bind(slide.price.trim())
    .bind(slide.old_price.trim())
    .bind(slide.detail_line.trim())
    .bind(serde_json::to_string(&slide.metrics).map_err(|_| AppError::Internal)?)
    .bind(serde_json::to_string(&slide.specs).map_err(|_| AppError::Internal)?)
    .bind(slide.sort_order)
    .bind(if slide.is_active { 1 } else { 0 })
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error saving landing slide: {}", e);
        AppError::Internal
    })?;
    Ok(())
}

async fn create_landing_slide(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<LandingSlidePayload>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let max_order: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM landing_hero_slides")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let id = uuid::Uuid::new_v4().to_string();
    let slide = LandingHeroSlide {
        id: id.clone(),
        eyebrow: payload.eyebrow.unwrap_or_default(),
        title: payload.title.unwrap_or_default(),
        accent: payload.accent.unwrap_or_default(),
        copy: payload.copy.unwrap_or_default(),
        href: payload.href.unwrap_or_else(|| "/produk".to_string()),
        cta: payload.cta.unwrap_or_else(|| "Lihat Produk".to_string()),
        bg_image_url: payload.bg_image_url.unwrap_or_default(),
        product_image_url: payload.product_image_url.unwrap_or_default(),
        product_alt: payload.product_alt.unwrap_or_default(),
        icon_key: payload.icon_key.unwrap_or_else(|| "bike".to_string()),
        price: payload.price.unwrap_or_default(),
        old_price: payload.old_price.unwrap_or_default(),
        detail_line: payload.detail_line.unwrap_or_default(),
        metrics: payload.metrics.unwrap_or_else(|| json!([])),
        specs: payload.specs.unwrap_or_else(|| json!([])),
        sort_order: payload.sort_order.unwrap_or(max_order),
        is_active: payload.is_active.unwrap_or(true),
    };

    upsert_slide(&state, &slide).await?;
    Ok(json_ok(
        "Landing slide created",
        json!({ "item": fetch_slide(&state, &id).await? }),
    ))
}

async fn update_landing_slide(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<LandingSlidePayload>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let mut slide = fetch_slide(&state, &id).await?;

    if let Some(value) = payload.eyebrow {
        slide.eyebrow = value;
    }
    if let Some(value) = payload.title {
        slide.title = value;
    }
    if let Some(value) = payload.accent {
        slide.accent = value;
    }
    if let Some(value) = payload.copy {
        slide.copy = value;
    }
    if let Some(value) = payload.href {
        slide.href = value;
    }
    if let Some(value) = payload.cta {
        slide.cta = value;
    }
    if let Some(value) = payload.bg_image_url {
        slide.bg_image_url = value;
    }
    if let Some(value) = payload.product_image_url {
        slide.product_image_url = value;
    }
    if let Some(value) = payload.product_alt {
        slide.product_alt = value;
    }
    if let Some(value) = payload.icon_key {
        slide.icon_key = value;
    }
    if let Some(value) = payload.price {
        slide.price = value;
    }
    if let Some(value) = payload.old_price {
        slide.old_price = value;
    }
    if let Some(value) = payload.detail_line {
        slide.detail_line = value;
    }
    if let Some(value) = payload.metrics {
        slide.metrics = value;
    }
    if let Some(value) = payload.specs {
        slide.specs = value;
    }
    if let Some(value) = payload.sort_order {
        slide.sort_order = value;
    }
    if let Some(value) = payload.is_active {
        slide.is_active = value;
    }

    upsert_slide(&state, &slide).await?;
    Ok(json_ok(
        "Landing slide updated",
        json!({ "item": fetch_slide(&state, &id).await? }),
    ))
}

async fn update_landing_slide_order(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(items): Json<Vec<SlideOrderItem>>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("DB transaction error updating slide order: {}", e);
        AppError::Internal
    })?;

    for item in items {
        sqlx::query(
            "UPDATE landing_hero_slides SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(item.sort_order)
        .bind(item.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("DB error updating slide order: {}", e);
            AppError::Internal
        })?;
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("DB commit error updating slide order: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "Landing slide order updated",
        json!({ "updated": true }),
    ))
}

async fn delete_landing_slide(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let result = sqlx::query("DELETE FROM landing_hero_slides WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error deleting landing slide: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok("Landing slide deleted", json!({ "id": id })))
}

fn image_decode_limits() -> image::Limits {
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(8000);
    limits.max_image_height = Some(8000);
    limits.max_alloc = Some(64 * 1024 * 1024);
    limits
}

fn decode_uploaded_image(data: &[u8]) -> Result<image::DynamicImage, AppError> {
    let cursor = std::io::Cursor::new(data);
    let format = image::guess_format(data).map_err(|e| {
        tracing::warn!("Failed to guess landing image format: {}", e);
        AppError::Validation {
            errors: vec!["Format file gambar tidak didukung".to_string()],
        }
    })?;
    let mut reader = image::ImageReader::with_format(cursor, format);
    reader.limits(image_decode_limits());
    reader.decode().map_err(|e| {
        tracing::warn!("Failed to decode landing image: {}", e);
        AppError::Validation {
            errors: vec!["Format file gambar tidak didukung atau ukuran terlalu besar".to_string()],
        }
    })
}

fn save_landing_image_as_webp(image: image::DynamicImage) -> Result<String, AppError> {
    std::fs::create_dir_all("uploads/landing").map_err(|e| {
        tracing::error!("Failed to create landing upload dir: {}", e);
        AppError::Internal
    })?;
    let file_name = format!("slide_{}.webp", uuid::Uuid::new_v4());
    let file_path = format!("uploads/landing/{}", file_name);
    image
        .save_with_format(&file_path, image::ImageFormat::WebP)
        .map_err(|e| {
            tracing::error!("Failed to save landing image as webp: {}", e);
            AppError::Internal
        })?;
    Ok(format!("/uploads/landing/{}", file_name))
}

async fn upload_landing_slide_image(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let mut uploaded_url: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error uploading landing image: {}", e);
        AppError::Internal
    })? {
        if field.name().unwrap_or_default() != "file" {
            continue;
        }
        let data = field.bytes().await.map_err(|e| {
            tracing::error!("Failed to read landing upload bytes: {}", e);
            AppError::Internal
        })?;
        if data.is_empty() {
            continue;
        }
        uploaded_url = Some(save_landing_image_as_webp(decode_uploaded_image(&data)?)?);
        break;
    }

    let url = uploaded_url.ok_or(AppError::Validation {
        errors: vec!["File gambar wajib diunggah".to_string()],
    })?;

    Ok(json_ok("Landing image uploaded", json!({ "url": url })))
}
