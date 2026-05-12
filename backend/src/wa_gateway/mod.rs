/**
 * WA Gateway - Self-Hosted WhatsApp Gateway
 * 
 * Module structure:
 * - models: Request/response types
 * - handlers: API endpoint handlers
 * - routes: Route definitions
 */

pub mod handlers;
pub mod models;
pub mod routes;

pub use routes::router;
