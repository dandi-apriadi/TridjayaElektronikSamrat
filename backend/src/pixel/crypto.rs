use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};

/// Errors that can occur during cryptographic operations.
#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("invalid key")]
    InvalidKey,
    #[error("encryption failed")]
    EncryptionFailed,
    #[error("decryption failed")]
    DecryptionFailed,
    #[error("invalid base64")]
    InvalidBase64,
    #[error("invalid nonce")]
    InvalidNonce,
}

/// Decodes a hex string into bytes. Returns `None` if the string is not valid hex.
fn decode_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    let mut bytes = Vec::with_capacity(s.len() / 2);
    let mut chars = s.chars();
    while let (Some(hi), Some(lo)) = (chars.next(), chars.next()) {
        let hi = hi.to_digit(16)?;
        let lo = lo.to_digit(16)?;
        bytes.push(((hi << 4) | lo) as u8);
    }
    Some(bytes)
}

/// Reads the `PIXEL_ENCRYPTION_KEY` environment variable (32-byte hex string)
/// and returns the decoded key bytes. Falls back to a dev-only default key
/// (32 zero bytes) if the variable is missing or invalid, logging a warning.
pub fn get_encryption_key() -> [u8; 32] {
    match std::env::var("PIXEL_ENCRYPTION_KEY") {
        Ok(hex_str) => {
            let hex_str = hex_str.trim();
            if hex_str.len() != 64 {
                tracing::warn!(
                    "PIXEL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). \
                     Falling back to dev-only default key — DO NOT use in production!"
                );
                return [0u8; 32];
            }
            match decode_hex(hex_str) {
                Some(bytes) if bytes.len() == 32 => {
                    let mut key = [0u8; 32];
                    key.copy_from_slice(&bytes);
                    key
                }
                _ => {
                    tracing::warn!(
                        "PIXEL_ENCRYPTION_KEY is not valid hex. \
                         Falling back to dev-only default key — DO NOT use in production!"
                    );
                    [0u8; 32]
                }
            }
        }
        Err(_) => {
            tracing::warn!(
                "PIXEL_ENCRYPTION_KEY is not set. \
                 Falling back to dev-only default key — DO NOT use in production!"
            );
            [0u8; 32]
        }
    }
}

/// Encrypts `plaintext` using AES-256-GCM with a random 96-bit nonce.
/// Returns `base64(nonce || ciphertext)`.
pub fn encrypt_token(plaintext: &str, key: &[u8; 32]) -> Result<String, CryptoError> {
    let key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Concatenate nonce (12 bytes) || ciphertext, then base64-encode
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce);
    combined.extend_from_slice(&ciphertext);

    Ok(STANDARD.encode(&combined))
}

/// Decrypts a token previously encrypted with `encrypt_token`.
/// Expects `base64(nonce || ciphertext)` as input.
pub fn decrypt_token(encoded: &str, key: &[u8; 32]) -> Result<String, CryptoError> {
    let combined = STANDARD.decode(encoded).map_err(|_| CryptoError::InvalidBase64)?;

    if combined.len() < 12 {
        return Err(CryptoError::InvalidNonce);
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    String::from_utf8(plaintext_bytes).map_err(|_| CryptoError::DecryptionFailed)
}

/// Hashes a PII value (e.g. IP address, email, phone) using SHA-256.
/// Returns a lowercase hex digest.
pub fn hash_pii(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> [u8; 32] {
        [42u8; 32]
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = test_key();
        let plaintext = "my-secret-access-token";
        let encrypted = encrypt_token(plaintext, &key).expect("encryption should succeed");
        let decrypted = decrypt_token(&encrypted, &key).expect("decryption should succeed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_produces_different_ciphertext_each_time() {
        let key = test_key();
        let plaintext = "same-token";
        let enc1 = encrypt_token(plaintext, &key).unwrap();
        let enc2 = encrypt_token(plaintext, &key).unwrap();
        // Different nonces → different ciphertexts
        assert_ne!(enc1, enc2);
    }

    #[test]
    fn test_decrypt_with_wrong_key_fails() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];
        let encrypted = encrypt_token("secret", &key1).unwrap();
        let result = decrypt_token(&encrypted, &key2);
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_invalid_base64_fails() {
        let key = test_key();
        let result = decrypt_token("not-valid-base64!!!", &key);
        assert!(matches!(result, Err(CryptoError::InvalidBase64)));
    }

    #[test]
    fn test_decrypt_too_short_fails() {
        let key = test_key();
        // Base64 of only 5 bytes (less than 12-byte nonce)
        let short = STANDARD.encode(&[0u8; 5]);
        let result = decrypt_token(&short, &key);
        assert!(matches!(result, Err(CryptoError::InvalidNonce)));
    }

    #[test]
    fn test_hash_pii_is_deterministic() {
        let hash1 = hash_pii("192.168.1.1");
        let hash2 = hash_pii("192.168.1.1");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_hash_pii_is_lowercase_hex() {
        let hash = hash_pii("test@example.com");
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit() && !c.is_uppercase()));
        assert_eq!(hash.len(), 64); // SHA-256 = 32 bytes = 64 hex chars
    }

    #[test]
    fn test_hash_pii_different_inputs_produce_different_hashes() {
        let h1 = hash_pii("user@example.com");
        let h2 = hash_pii("other@example.com");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_hash_pii_not_equal_to_plaintext() {
        let value = "192.168.0.1";
        let hash = hash_pii(value);
        assert_ne!(hash, value);
    }
}
