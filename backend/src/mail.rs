use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, AsyncSmtpTransport, Tokio1Executor, AsyncTransport};
use lettre::transport::smtp::client::Tls;
use std::env;

pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from_email: String,
}

impl Mailer {
    pub fn new() -> Self {
        let smtp_email = env::var("SMTP_EMAIL").unwrap_or_else(|_| "dandimamonto.tridjaya03@gmail.com".to_string());
        let smtp_password = env::var("SMTP_PASSWORD").unwrap_or_else(|_| "rkhkwoksvubfbbtw".to_string());
        let smtp_server = env::var("SMTP_SERVER").unwrap_or_else(|_| "smtp.gmail.com".to_string());

        let creds = Credentials::new(smtp_email.clone(), smtp_password);

        let transport = AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_server)
            .expect("Failed to create SMTP transport")
            .credentials(creds)
            .tls(Tls::Required(lettre::transport::smtp::client::TlsParameters::new(smtp_server).expect("Failed to create TLS parameters")))
            .build();

        Self {
            transport,
            from_email: smtp_email,
        }
    }

    pub async fn send_verification_email(&self, to_email: &str, name: &str, verification_link: &str) -> Result<(), Box<dyn std::error::Error>> {
        let email = Message::builder()
            .from(self.from_email.parse()?)
            .to(to_email.parse()?)
            .subject("Verifikasi Akun Agent Tridjaya Samrat")
            .body(format!(
                "Halo {},\n\nSelamat! Pendaftaran Anda sebagai Agent Tridjaya Samrat telah disetujui.\n\nSilakan klik tautan di bawah ini untuk memverifikasi akun Anda dan mulai menggunakan dashboard:\n{}\n\nTerima kasih,\nTim Tridjaya Samrat",
                name, verification_link
            ))?;

        self.transport.send(email).await?;
        Ok(())
    }

    pub async fn send_password_reset_email(&self, to_email: &str, name: &str, new_password: &str) -> Result<(), Box<dyn std::error::Error>> {
        let email = Message::builder()
            .from(self.from_email.parse()?)
            .to(to_email.parse()?)
            .subject("Reset Password Akun Tridjaya Samrat")
            .body(format!(
                "Halo {},\n\nAdmin telah mereset password akun Anda. Berikut adalah password baru Anda:\n\nPassword: {}\n\nSilakan segera ganti password Anda setelah login demi keamanan.\n\nTerima kasih,\nTim Tridjaya Samrat",
                name, new_password
            ))?;

        self.transport.send(email).await?;
        Ok(())
    }
}
