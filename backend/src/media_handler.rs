use redis::AsyncCommands;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use thiserror::Error;
use tracing::{debug, error, info, warn};

/// Media types supported by the gateway
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Image,
    Pdf,
    Video,
}

impl MediaType {
    /// Get maximum file size in bytes for this media type
    ///
    /// **Validates: Requirements 7.2**
    pub fn max_size_bytes(&self) -> usize {
        match self {
            MediaType::Image => 16 * 1024 * 1024, // 16MB
            MediaType::Pdf => 100 * 1024 * 1024,  // 100MB
            MediaType::Video => 64 * 1024 * 1024, // 64MB
        }
    }

    /// Get allowed MIME types for this media type
    ///
    /// **Validates: Requirements 7.1**
    pub fn allowed_mime_types(&self) -> &[&str] {
        match self {
            MediaType::Image => &["image/jpeg", "image/png", "image/webp"],
            MediaType::Pdf => &["application/pdf"],
            MediaType::Video => &["video/mp4"],
        }
    }

    /// Get allowed file extensions for this media type
    ///
    /// **Validates: Requirements 7.1**
    pub fn allowed_extensions(&self) -> &[&str] {
        match self {
            MediaType::Image => &["jpg", "jpeg", "png", "webp"],
            MediaType::Pdf => &["pdf"],
            MediaType::Video => &["mp4"],
        }
    }

    /// Detect media type from MIME type
    pub fn from_mime_type(mime: &str) -> Option<Self> {
        if mime.starts_with("image/") {
            Some(MediaType::Image)
        } else if mime == "application/pdf" {
            Some(MediaType::Pdf)
        } else if mime.starts_with("video/") {
            Some(MediaType::Video)
        } else {
            None
        }
    }

    /// Detect media type from file extension
    pub fn from_extension(ext: &str) -> Option<Self> {
        let ext_lower = ext.to_lowercase();
        match ext_lower.as_str() {
            "jpg" | "jpeg" | "png" | "webp" => Some(MediaType::Image),
            "pdf" => Some(MediaType::Pdf),
            "mp4" => Some(MediaType::Video),
            _ => None,
        }
    }
}

/// Errors that can occur during media handling
#[derive(Debug, Error)]
pub enum MediaError {
    #[error("Invalid media type: {0}")]
    InvalidMediaType(String),

    #[error("File size {0} bytes exceeds maximum {1} bytes for {2:?}")]
    FileSizeTooLarge(usize, usize, MediaType),

    #[error("Download failed: {0}")]
    DownloadFailed(String),

    #[error("Corrupt or invalid file: {0}")]
    CorruptFile(String),

    #[error("Thumbnail generation failed: {0}")]
    ThumbnailFailed(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),

    #[error("Image processing error: {0}")]
    ImageError(#[from] image::ImageError),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Downloaded media with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaFile {
    pub media_type: MediaType,
    pub mime_type: String,
    pub size_bytes: usize,
    pub data: Vec<u8>,
    pub thumbnail: Option<Vec<u8>>,
}

/// Media handler for processing and caching media files
pub struct MediaHandler {
    http_client: Client,
    redis: redis::aio::ConnectionManager,
}

impl MediaHandler {
    /// Create a new MediaHandler
    pub fn new(redis: redis::aio::ConnectionManager) -> Self {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { http_client, redis }
    }

    /// Generate Redis cache key for media URL
    fn cache_key(&self, url: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(url.as_bytes());
        let hash = hasher.finalize();
        format!("wa:media:{:x}", hash)
    }

    /// Validate media type based on MIME type and file extension
    ///
    /// **Validates: Requirements 7.1**
    pub fn validate_media_type(&self, mime_type: &str, url: &str) -> Result<MediaType, MediaError> {
        // Try to detect from MIME type first
        if let Some(media_type) = MediaType::from_mime_type(mime_type) {
            // Verify MIME type is in allowed list
            if media_type.allowed_mime_types().contains(&mime_type) {
                return Ok(media_type);
            }
        }

        // Try to detect from file extension
        if let Some(ext) = url.rsplit('.').next() {
            if let Some(media_type) = MediaType::from_extension(ext) {
                // Verify extension is in allowed list
                if media_type
                    .allowed_extensions()
                    .contains(&ext.to_lowercase().as_str())
                {
                    return Ok(media_type);
                }
            }
        }

        Err(MediaError::InvalidMediaType(format!(
            "Unsupported media type: {} (URL: {})",
            mime_type, url
        )))
    }

    /// Validate file size against media type limits
    ///
    /// **Validates: Requirements 7.2**
    pub fn validate_file_size(
        &self,
        size_bytes: usize,
        media_type: MediaType,
    ) -> Result<(), MediaError> {
        let max_size = media_type.max_size_bytes();
        if size_bytes > max_size {
            return Err(MediaError::FileSizeTooLarge(
                size_bytes, max_size, media_type,
            ));
        }
        Ok(())
    }

    /// Download media from URL with optional authentication headers
    ///
    /// **Validates: Requirements 7.3, 7.8**
    pub async fn download_media(
        &self,
        url: &str,
        auth_headers: Option<HashMap<String, String>>,
    ) -> Result<(Vec<u8>, String), MediaError> {
        debug!("Downloading media from URL: {}", url);

        // Validate URL
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(MediaError::InvalidUrl(format!(
                "URL must start with http:// or https://: {}",
                url
            )));
        }

        // Build request with optional auth headers
        let mut request = self.http_client.get(url);
        if let Some(headers) = auth_headers {
            for (key, value) in headers {
                request = request.header(key, value);
            }
        }

        // Execute request
        let response = request.send().await.map_err(|e| {
            error!("Failed to download media from {}: {}", url, e);
            MediaError::DownloadFailed(e.to_string())
        })?;

        // Check status code
        if !response.status().is_success() {
            return Err(MediaError::DownloadFailed(format!(
                "HTTP {} from {}",
                response.status(),
                url
            )));
        }

        // Get MIME type from Content-Type header
        let mime_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/octet-stream")
            .split(';')
            .next()
            .unwrap_or("application/octet-stream")
            .to_string();

        // Download bytes
        let bytes = response.bytes().await.map_err(|e| {
            error!("Failed to read media bytes from {}: {}", url, e);
            MediaError::DownloadFailed(e.to_string())
        })?;

        info!(
            "Downloaded {} bytes from {} (MIME: {})",
            bytes.len(),
            url,
            mime_type
        );

        Ok((bytes.to_vec(), mime_type))
    }

    /// Generate thumbnail for video file
    ///
    /// **Validates: Requirements 7.4**
    ///
    /// Note: This is a simplified implementation that generates a placeholder thumbnail.
    /// For production, you would use a video processing library like ffmpeg to extract
    /// a frame from the video. Since the `image` crate doesn't support video decoding,
    /// we create a simple placeholder image.
    pub fn generate_video_thumbnail(&self, _video_data: &[u8]) -> Result<Vec<u8>, MediaError> {
        debug!("Generating video thumbnail");

        // Create a simple placeholder thumbnail (200x150 gray image)
        // In production, you would use ffmpeg or similar to extract a frame
        let width = 200u32;
        let height = 150u32;

        let img = image::ImageBuffer::from_fn(width, height, |x, y| {
            // Create a gradient pattern
            let gray = ((x + y) % 256) as u8;
            image::Rgb([gray, gray, gray])
        });

        // Encode as JPEG
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);

        img.write_to(&mut cursor, image::ImageFormat::Jpeg)
            .map_err(|e| {
                error!("Failed to encode thumbnail: {}", e);
                MediaError::ThumbnailFailed(e.to_string())
            })?;

        debug!("Generated thumbnail: {} bytes", buffer.len());
        Ok(buffer)
    }

    /// Validate media file integrity
    ///
    /// **Validates: Requirements 7.7**
    pub fn validate_media_integrity(
        &self,
        data: &[u8],
        media_type: MediaType,
    ) -> Result<(), MediaError> {
        match media_type {
            MediaType::Image => {
                // Try to load image to verify it's not corrupt
                image::load_from_memory(data).map_err(|e| {
                    error!("Corrupt image file: {}", e);
                    MediaError::CorruptFile(format!("Invalid image data: {}", e))
                })?;
            }
            MediaType::Pdf => {
                // Basic PDF validation: check for PDF header
                if data.len() < 5 || &data[0..5] != b"%PDF-" {
                    return Err(MediaError::CorruptFile(
                        "Invalid PDF file: missing PDF header".to_string(),
                    ));
                }
            }
            MediaType::Video => {
                // Basic MP4 validation: check for ftyp box
                if data.len() < 12 {
                    return Err(MediaError::CorruptFile(
                        "Invalid MP4 file: file too small".to_string(),
                    ));
                }
                // MP4 files should have 'ftyp' box near the beginning
                let has_ftyp = data.windows(4).take(100).any(|window| window == b"ftyp");
                if !has_ftyp {
                    return Err(MediaError::CorruptFile(
                        "Invalid MP4 file: missing ftyp box".to_string(),
                    ));
                }
            }
        }
        Ok(())
    }

    /// Process media file: download, validate, generate thumbnail if needed
    ///
    /// **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.7, 7.8**
    pub async fn process_media(
        &self,
        url: &str,
        auth_headers: Option<HashMap<String, String>>,
    ) -> Result<MediaFile, MediaError> {
        // Download media
        let (data, mime_type) = self.download_media(url, auth_headers).await?;

        // Validate media type
        let media_type = self.validate_media_type(&mime_type, url)?;

        // Validate file size
        self.validate_file_size(data.len(), media_type)?;

        // Validate file integrity
        self.validate_media_integrity(&data, media_type)?;

        // Generate thumbnail for video
        let thumbnail = if media_type == MediaType::Video {
            match self.generate_video_thumbnail(&data) {
                Ok(thumb) => Some(thumb),
                Err(e) => {
                    warn!("Failed to generate thumbnail: {}", e);
                    None
                }
            }
        } else {
            None
        };

        Ok(MediaFile {
            media_type,
            mime_type,
            size_bytes: data.len(),
            data,
            thumbnail,
        })
    }

    /// Cache media file in Redis with 1 hour TTL
    ///
    /// **Validates: Requirements 7.6**
    pub async fn cache_media(&mut self, url: &str, media: &MediaFile) -> Result<(), MediaError> {
        let cache_key = self.cache_key(url);
        let ttl_seconds = 3600; // 1 hour

        // Serialize media file
        let media_json = serde_json::to_string(media).map_err(|e| {
            error!("Failed to serialize media for caching: {}", e);
            MediaError::CacheError(e.to_string())
        })?;

        // Store in Redis with TTL
        self.redis
            .set_ex::<_, _, ()>(&cache_key, media_json, ttl_seconds)
            .await
            .map_err(|e| {
                error!("Failed to cache media in Redis: {}", e);
                MediaError::CacheError(e.to_string())
            })?;

        debug!("Cached media for URL {} (TTL: {}s)", url, ttl_seconds);
        Ok(())
    }

    /// Get media from cache
    ///
    /// **Validates: Requirements 7.6**
    pub async fn get_cached_media(&mut self, url: &str) -> Result<Option<MediaFile>, MediaError> {
        let cache_key = self.cache_key(url);

        let cached: Option<String> = self
            .redis
            .get(&cache_key)
            .await
            .map_err(|e| MediaError::CacheError(e.to_string()))?;

        match cached {
            Some(json) => {
                let media: MediaFile = serde_json::from_str(&json).map_err(|e| {
                    error!("Failed to deserialize cached media: {}", e);
                    MediaError::CacheError(e.to_string())
                })?;
                debug!("Cache hit for URL: {}", url);
                Ok(Some(media))
            }
            None => {
                debug!("Cache miss for URL: {}", url);
                Ok(None)
            }
        }
    }

    /// Download and cache media (with cache check)
    ///
    /// **Validates: Requirements 7.3, 7.6, 7.7, 7.8**
    ///
    /// This is the main entry point for media handling. It checks cache first,
    /// then downloads and caches if not found.
    pub async fn download_and_cache_media(
        &mut self,
        url: &str,
        auth_headers: Option<HashMap<String, String>>,
    ) -> Result<MediaFile, MediaError> {
        // Check cache first
        if let Some(cached_media) = self.get_cached_media(url).await? {
            info!("Using cached media for URL: {}", url);
            return Ok(cached_media);
        }

        // Download and process media
        info!("Downloading and processing media from URL: {}", url);
        let media = self.process_media(url, auth_headers).await?;

        // Cache for future use
        self.cache_media(url, &media).await?;

        Ok(media)
    }

    /// Clear media cache for a specific URL
    pub async fn clear_cache(&mut self, url: &str) -> Result<(), MediaError> {
        let cache_key = self.cache_key(url);
        self.redis
            .del::<_, ()>(&cache_key)
            .await
            .map_err(|e| MediaError::CacheError(e.to_string()))?;
        debug!("Cleared cache for URL: {}", url);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **Validates: Requirements 7.1**
    /// Test media type detection from MIME types
    #[test]
    fn test_media_type_from_mime() {
        assert_eq!(
            MediaType::from_mime_type("image/jpeg"),
            Some(MediaType::Image)
        );
        assert_eq!(
            MediaType::from_mime_type("image/png"),
            Some(MediaType::Image)
        );
        assert_eq!(
            MediaType::from_mime_type("image/webp"),
            Some(MediaType::Image)
        );
        assert_eq!(
            MediaType::from_mime_type("application/pdf"),
            Some(MediaType::Pdf)
        );
        assert_eq!(
            MediaType::from_mime_type("video/mp4"),
            Some(MediaType::Video)
        );
        assert_eq!(MediaType::from_mime_type("text/plain"), None);
    }

    /// **Validates: Requirements 7.1**
    /// Test media type detection from file extensions
    #[test]
    fn test_media_type_from_extension() {
        assert_eq!(MediaType::from_extension("jpg"), Some(MediaType::Image));
        assert_eq!(MediaType::from_extension("jpeg"), Some(MediaType::Image));
        assert_eq!(MediaType::from_extension("png"), Some(MediaType::Image));
        assert_eq!(MediaType::from_extension("webp"), Some(MediaType::Image));
        assert_eq!(MediaType::from_extension("pdf"), Some(MediaType::Pdf));
        assert_eq!(MediaType::from_extension("mp4"), Some(MediaType::Video));
        assert_eq!(MediaType::from_extension("txt"), None);
        assert_eq!(MediaType::from_extension("JPG"), Some(MediaType::Image)); // Case insensitive
    }

    /// **Validates: Requirements 7.2**
    /// Test file size limits for different media types
    #[test]
    fn test_media_type_size_limits() {
        assert_eq!(MediaType::Image.max_size_bytes(), 16 * 1024 * 1024);
        assert_eq!(MediaType::Pdf.max_size_bytes(), 100 * 1024 * 1024);
        assert_eq!(MediaType::Video.max_size_bytes(), 64 * 1024 * 1024);
    }

    /// **Validates: Requirements 7.1**
    /// Test allowed MIME types for each media type
    #[test]
    fn test_allowed_mime_types() {
        assert!(MediaType::Image
            .allowed_mime_types()
            .contains(&"image/jpeg"));
        assert!(MediaType::Image.allowed_mime_types().contains(&"image/png"));
        assert!(MediaType::Image
            .allowed_mime_types()
            .contains(&"image/webp"));
        assert!(MediaType::Pdf
            .allowed_mime_types()
            .contains(&"application/pdf"));
        assert!(MediaType::Video.allowed_mime_types().contains(&"video/mp4"));
    }

    /// **Validates: Requirements 7.1**
    /// Test allowed file extensions for each media type
    #[test]
    fn test_allowed_extensions() {
        assert!(MediaType::Image.allowed_extensions().contains(&"jpg"));
        assert!(MediaType::Image.allowed_extensions().contains(&"jpeg"));
        assert!(MediaType::Image.allowed_extensions().contains(&"png"));
        assert!(MediaType::Image.allowed_extensions().contains(&"webp"));
        assert!(MediaType::Pdf.allowed_extensions().contains(&"pdf"));
        assert!(MediaType::Video.allowed_extensions().contains(&"mp4"));
    }

    /// **Validates: Requirements 7.2**
    /// Test file size validation
    #[tokio::test]
    async fn test_file_size_validation() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        // Valid sizes
        assert!(handler.validate_file_size(1024, MediaType::Image).is_ok());
        assert!(handler
            .validate_file_size(16 * 1024 * 1024, MediaType::Image)
            .is_ok());
        assert!(handler
            .validate_file_size(100 * 1024 * 1024, MediaType::Pdf)
            .is_ok());
        assert!(handler
            .validate_file_size(64 * 1024 * 1024, MediaType::Video)
            .is_ok());

        // Invalid sizes (too large)
        assert!(handler
            .validate_file_size(17 * 1024 * 1024, MediaType::Image)
            .is_err());
        assert!(handler
            .validate_file_size(101 * 1024 * 1024, MediaType::Pdf)
            .is_err());
        assert!(handler
            .validate_file_size(65 * 1024 * 1024, MediaType::Video)
            .is_err());
    }

    /// **Validates: Requirements 7.7**
    /// Test media integrity validation for images
    #[tokio::test]
    async fn test_image_integrity_validation() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        // Create a valid 1x1 PNG image using the image crate
        let img = image::ImageBuffer::from_fn(1u32, 1u32, |_, _| image::Rgb([255u8, 0u8, 0u8]));
        let mut valid_png = Vec::new();
        let mut cursor = Cursor::new(&mut valid_png);
        img.write_to(&mut cursor, image::ImageFormat::Png).unwrap();

        assert!(handler
            .validate_media_integrity(&valid_png, MediaType::Image)
            .is_ok());

        // Invalid image data
        let invalid_data = vec![0x00, 0x01, 0x02, 0x03];
        assert!(handler
            .validate_media_integrity(&invalid_data, MediaType::Image)
            .is_err());
    }

    /// **Validates: Requirements 7.7**
    /// Test media integrity validation for PDFs
    #[tokio::test]
    async fn test_pdf_integrity_validation() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        // Valid PDF header
        let valid_pdf = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
        assert!(handler
            .validate_media_integrity(&valid_pdf, MediaType::Pdf)
            .is_ok());

        // Invalid PDF (missing header)
        let invalid_pdf = b"Not a PDF file".to_vec();
        assert!(handler
            .validate_media_integrity(&invalid_pdf, MediaType::Pdf)
            .is_err());
    }

    /// **Validates: Requirements 7.7**
    /// Test media integrity validation for videos
    #[tokio::test]
    async fn test_video_integrity_validation() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        // Valid MP4 with ftyp box
        let mut valid_mp4 = vec![0x00; 100];
        valid_mp4[4..8].copy_from_slice(b"ftyp");
        assert!(handler
            .validate_media_integrity(&valid_mp4, MediaType::Video)
            .is_ok());

        // Invalid MP4 (missing ftyp)
        let invalid_mp4 = vec![0x00; 100];
        assert!(handler
            .validate_media_integrity(&invalid_mp4, MediaType::Video)
            .is_err());

        // Too small
        let too_small = vec![0x00; 5];
        assert!(handler
            .validate_media_integrity(&too_small, MediaType::Video)
            .is_err());
    }

    /// **Validates: Requirements 7.4**
    /// Test video thumbnail generation
    #[tokio::test]
    async fn test_video_thumbnail_generation() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        let video_data = vec![0x00; 1024]; // Dummy video data
        let thumbnail = handler.generate_video_thumbnail(&video_data);

        assert!(thumbnail.is_ok());
        let thumb_data = thumbnail.unwrap();
        assert!(!thumb_data.is_empty());

        // Verify it's a valid JPEG
        assert!(image::load_from_memory(&thumb_data).is_ok());
    }

    /// **Validates: Requirements 7.1**
    /// Test media type validation with valid types
    #[tokio::test]
    async fn test_validate_media_type_valid() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        assert!(handler
            .validate_media_type("image/jpeg", "test.jpg")
            .is_ok());
        assert!(handler.validate_media_type("image/png", "test.png").is_ok());
        assert!(handler
            .validate_media_type("image/webp", "test.webp")
            .is_ok());
        assert!(handler
            .validate_media_type("application/pdf", "test.pdf")
            .is_ok());
        assert!(handler.validate_media_type("video/mp4", "test.mp4").is_ok());
    }

    /// **Validates: Requirements 7.1**
    /// Test media type validation with invalid types
    #[tokio::test]
    async fn test_validate_media_type_invalid() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        assert!(handler
            .validate_media_type("text/plain", "test.txt")
            .is_err());
        assert!(handler
            .validate_media_type("video/avi", "test.avi")
            .is_err());
        assert!(handler
            .validate_media_type("application/zip", "test.zip")
            .is_err());
    }

    /// **Validates: Requirements 7.8**
    /// Test URL validation
    #[tokio::test]
    async fn test_url_validation() {
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
        let redis_conn = redis::aio::ConnectionManager::new(redis_client)
            .await
            .unwrap();
        let handler = MediaHandler::new(redis_conn);

        // Invalid URL (not HTTP/HTTPS)
        let result = handler
            .download_media("ftp://example.com/file.jpg", None)
            .await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), MediaError::InvalidUrl(_)));
    }
}
