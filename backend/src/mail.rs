use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, AsyncSmtpTransport, Tokio1Executor, AsyncTransport};
use lettre::transport::smtp::client::Tls;
use std::env;

pub struct Mailer {
    transport: Option<AsyncSmtpTransport<Tokio1Executor>>,
    from_email: String,
    enabled: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum MailerError {
    #[error("mailer disabled (SMTP env vars missing)")]
    Disabled,
    #[error("mail error: {0}")]
    Other(#[from] Box<dyn std::error::Error + Send + Sync>),
}

impl Mailer {
    pub fn new() -> Self {
        let smtp_email = env::var("SMTP_EMAIL").ok();
        let smtp_password = env::var("SMTP_PASSWORD").ok();
        let smtp_server = env::var("SMTP_SERVER").unwrap_or_else(|_| "smtp.gmail.com".to_string());

        match (smtp_email, smtp_password) {
            (Some(email), Some(password)) if !email.trim().is_empty() && !password.trim().is_empty() => {
                let creds = Credentials::new(email.clone(), password);
                let tls = match lettre::transport::smtp::client::TlsParameters::new(smtp_server.clone()) {
                    Ok(params) => params,
                    Err(error) => {
                        tracing::warn!("Failed to build TLS params for SMTP: {}", error);
                        return Self { transport: None, from_email: email, enabled: false };
                    }
                };
                let transport = AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_server)
                    .map(|builder| builder.credentials(creds).tls(Tls::Required(tls)).build());

                match transport {
                    Ok(t) => Self {
                        transport: Some(t),
                        from_email: email,
                        enabled: true,
                    },
                    Err(error) => {
                        tracing::warn!("Failed to build SMTP transport: {}", error);
                        Self { transport: None, from_email: email, enabled: false }
                    }
                }
            }
            _ => {
                tracing::warn!("SMTP credentials not configured (SMTP_EMAIL/SMTP_PASSWORD); outgoing emails are disabled.");
                Self {
                    transport: None,
                    from_email: String::new(),
                    enabled: false,
                }
            }
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    async fn send(&self, message: Message) -> Result<(), MailerError> {
        let transport = self.transport.as_ref().ok_or(MailerError::Disabled)?;
        transport
            .send(message)
            .await
            .map_err(|e| MailerError::Other(Box::new(e)))?;
        Ok(())
    }

    pub async fn send_verification_email(
        &self,
        to_email: &str,
        name: &str,
        verification_link: &str,
        temp_password: &str,
    ) -> Result<(), MailerError> {
        let from = self.from_email.parse().map_err(|e: lettre::address::AddressError| {
            MailerError::Other(Box::new(e))
        })?;
        let to = to_email.parse().map_err(|e: lettre::address::AddressError| {
            MailerError::Other(Box::new(e))
        })?;
        let body = format!(
            "Halo {},\n\n\
            Selamat! Pendaftaran Anda sebagai Agent Tridjaya Samrat telah disetujui.\n\n\
            Berikut detail akun Anda:\n\
            - Email: {}\n\
            - Password Sementara: {}\n\n\
            Silakan klik tautan di bawah ini untuk memverifikasi akun Anda:\n{}\n\n\
            Catatan: Anda akan diminta mengganti password pada login pertama demi keamanan.\n\n\
            Terima kasih,\nTim Tridjaya Samrat",
            name, to_email, temp_password, verification_link
        );
        let email = Message::builder()
            .from(from)
            .to(to)
            .subject("Verifikasi Akun Agent Tridjaya Samrat")
            .body(body)
            .map_err(|e| MailerError::Other(Box::new(e)))?;
        self.send(email).await
    }

    pub async fn send_password_reset_email(
        &self,
        to_email: &str,
        name: &str,
        new_password: &str,
    ) -> Result<(), MailerError> {
        let from = self.from_email.parse().map_err(|e: lettre::address::AddressError| {
            MailerError::Other(Box::new(e))
        })?;
        let to = to_email.parse().map_err(|e: lettre::address::AddressError| {
            MailerError::Other(Box::new(e))
        })?;
        let body = format!(
            "Halo {},\n\n\
            Admin telah mereset password akun Anda. Berikut adalah password baru Anda:\n\n\
            Password: {}\n\n\
            Anda akan diminta mengganti password ini pada login berikutnya demi keamanan.\n\n\
            Terima kasih,\nTim Tridjaya Samrat",
            name, new_password
        );
        let email = Message::builder()
            .from(from)
            .to(to)
            .subject("Reset Password Akun Tridjaya Samrat")
            .body(body)
            .map_err(|e| MailerError::Other(Box::new(e)))?;
        self.send(email).await
    }

    pub async fn send_password_reset_link_email(
        &self,
        to_email: &str,
        name: &str,
        reset_link: &str,
    ) -> Result<(), MailerError> {
        let from = self.from_email.parse().map_err(|e: lettre::address::AddressError| {
            MailerError::Other(Box::new(e))
        })?;
        let to = to_email.parse().map_err(|e: lettre::address::AddressError| {
            MailerError::Other(Box::new(e))
        })?;
        let body = format!(
            "Halo {},\n\n\
            Kami menerima permintaan reset password untuk akun Anda di Tridjaya Samrat.\n\n\
            Silakan klik tautan berikut untuk mengatur password baru. Tautan ini berlaku selama 30 menit dan hanya dapat digunakan sekali:\n\n\
            {}\n\n\
            Jika Anda tidak meminta reset password, abaikan email ini. Akun Anda tetap aman.\n\n\
            Terima kasih,\nTim Tridjaya Samrat",
            name, reset_link
        );
        let email = Message::builder()
            .from(from)
            .to(to)
            .subject("Reset Password Tridjaya Samrat")
            .body(body)
            .map_err(|e| MailerError::Other(Box::new(e)))?;
        self.send(email).await
    }
}
