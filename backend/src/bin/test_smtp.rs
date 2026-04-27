use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use std::env;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let smtp_email = env::var("SMTP_EMAIL").unwrap_or_default();
    let smtp_password = env::var("SMTP_PASSWORD").unwrap_or_default();
    let smtp_server = env::var("SMTP_SERVER").unwrap_or_else(|_| "smtp.gmail.com".to_string());

    // Optional recipient: arg #1, fallback to SMTP_EMAIL itself.
    let recipient = env::args().nth(1).unwrap_or_else(|| smtp_email.clone());

    println!("=== SMTP End-to-End Test ===");
    println!("SMTP_SERVER: {}", smtp_server);
    println!(
        "SMTP_EMAIL configured: {}",
        if smtp_email.is_empty() { "no" } else { "yes" }
    );
    println!(
        "SMTP_PASSWORD configured: {}",
        if smtp_password.is_empty() { "no" } else { "yes" }
    );
    println!("Recipient: {}", recipient);

    if smtp_email.is_empty() || smtp_password.is_empty() {
        eprintln!("ERROR: SMTP_EMAIL or SMTP_PASSWORD is empty.");
        std::process::exit(2);
    }

    let creds = Credentials::new(smtp_email.clone(), smtp_password);

    let transport = match AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_server) {
        Ok(builder) => builder.credentials(creds).build(),
        Err(error) => {
            eprintln!("ERROR: failed to create SMTP relay: {}", error);
            std::process::exit(3);
        }
    };

    let from = match smtp_email.parse() {
        Ok(value) => value,
        Err(error) => {
            eprintln!("ERROR: invalid SMTP_EMAIL address: {}", error);
            std::process::exit(4);
        }
    };
    let to = match recipient.parse() {
        Ok(value) => value,
        Err(error) => {
            eprintln!("ERROR: invalid recipient address: {}", error);
            std::process::exit(5);
        }
    };

    let body = "Ini email uji SMTP dari Tridjaya backend. Jika Anda menerima ini, SMTP berfungsi.";
    let message = match Message::builder()
        .from(from)
        .to(to)
        .subject("[SMTP TEST] Tridjaya Backend")
        .body(body.to_string())
    {
        Ok(msg) => msg,
        Err(error) => {
            eprintln!("ERROR: failed to build test message: {}", error);
            std::process::exit(6);
        }
    };

    match transport.send(message).await {
        Ok(response) => {
            println!("SUCCESS: SMTP send completed.");
            println!("Server response: {:?}", response);
            std::process::exit(0);
        }
        Err(error) => {
            eprintln!("ERROR: SMTP send failed: {}", error);
            std::process::exit(7);
        }
    }
}
