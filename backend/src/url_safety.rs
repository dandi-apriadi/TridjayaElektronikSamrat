//! Defense-in-depth helpers for outbound HTTP requests originating from the
//! backend (webhook delivery, media download, etc.).
//!
//! The primary goal is to **prevent Server-Side Request Forgery (SSRF)**:
//! a malicious or compromised operator must not be able to coerce the server
//! into fetching internal resources such as
//!   - the cloud metadata service (`169.254.169.254` on AWS / GCP / Azure),
//!   - loopback services (`127.0.0.1:6379`, `localhost:3306`, …),
//!   - private RFC1918 / RFC4193 networks,
//!   - or other link-local / multicast / broadcast destinations.
//!
//! Use [`ensure_safe_external_url`] before issuing any HTTP request whose URL
//! came from a user-controlled input.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use tokio::net::lookup_host;
use url::Url;

/// All-purpose error type returned by [`ensure_safe_external_url`].
#[derive(Debug, thiserror::Error)]
pub enum UrlSafetyError {
    #[error("URL kosong")]
    Empty,
    #[error("Format URL tidak valid: {0}")]
    Parse(String),
    #[error("Skema URL tidak diizinkan (hanya http/https)")]
    BadScheme,
    #[error("Host URL kosong")]
    MissingHost,
    #[error("Host '{0}' diblokir karena merujuk ke alamat internal/private")]
    BlockedHost(String),
    #[error("Gagal resolve DNS untuk host '{0}': {1}")]
    DnsResolution(String, String),
    #[error("Tidak ada alamat IP yang dapat dipakai untuk host '{0}'")]
    NoUsableAddress(String),
}

/// Reject loopback / private / link-local / multicast / broadcast IPv4
/// addresses, plus the IPv4 cloud-metadata address `169.254.169.254`.
fn is_blocked_ipv4(ip: &Ipv4Addr) -> bool {
    if ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_private()
        || ip.is_multicast()
        || ip.is_broadcast()
        || ip.is_documentation()
    {
        return true;
    }

    let octets = ip.octets();

    // 169.254.0.0/16 — link-local (already covered above, kept for clarity).
    // 100.64.0.0/10 — Carrier-grade NAT (RFC 6598). Treated as private.
    if octets[0] == 100 && (octets[1] & 0b1100_0000) == 0b0100_0000 {
        return true;
    }
    // 0.0.0.0/8 — "this network" (RFC 6890).
    if octets[0] == 0 {
        return true;
    }
    // 192.0.0.0/24 — IETF protocol assignments.
    if octets[0] == 192 && octets[1] == 0 && octets[2] == 0 {
        return true;
    }
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 — TEST-NETs.
    if (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
        || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
        || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
    {
        return true;
    }
    // 198.18.0.0/15 — benchmark testing.
    if octets[0] == 198 && (octets[1] == 18 || octets[1] == 19) {
        return true;
    }
    // 240.0.0.0/4 — reserved for future use.
    if octets[0] >= 240 {
        return true;
    }

    false
}

/// Reject loopback / link-local / unique-local / multicast IPv6 addresses, plus
/// IPv4-mapped IPv6 addresses pointing at the blocked IPv4 ranges.
fn is_blocked_ipv6(ip: &Ipv6Addr) -> bool {
    if ip.is_unspecified() || ip.is_loopback() || ip.is_multicast() {
        return true;
    }

    let segments = ip.segments();

    // fe80::/10 — link-local.
    if segments[0] & 0xffc0 == 0xfe80 {
        return true;
    }
    // fc00::/7 — unique local addresses (RFC 4193).
    if segments[0] & 0xfe00 == 0xfc00 {
        return true;
    }
    // ::ffff:0:0/96 — IPv4-mapped IPv6. Check underlying IPv4.
    if let Some(v4) = ip.to_ipv4_mapped() {
        return is_blocked_ipv4(&v4);
    }
    // ::/96 — IPv4-compatible IPv6 (deprecated but still possible).
    if segments[0..6].iter().all(|seg| *seg == 0) {
        let v4 = Ipv4Addr::new(
            (segments[6] >> 8) as u8,
            (segments[6] & 0xff) as u8,
            (segments[7] >> 8) as u8,
            (segments[7] & 0xff) as u8,
        );
        return is_blocked_ipv4(&v4);
    }

    false
}

/// Returns `true` when the IP address should not be reachable from the backend
/// for SSRF defence.
pub fn is_blocked_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_blocked_ipv4(v4),
        IpAddr::V6(v6) => is_blocked_ipv6(v6),
    }
}

/// Returns `Err` if the URL is malformed, uses a disallowed scheme, points at
/// a hostname literal that resolves only to blocked IPs, or directly embeds a
/// blocked IP literal.
///
/// On success returns the parsed [`url::Url`] so the caller does not need to
/// re-parse.
pub async fn ensure_safe_external_url(raw: &str) -> Result<Url, UrlSafetyError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(UrlSafetyError::Empty);
    }

    let parsed = Url::parse(trimmed).map_err(|err| UrlSafetyError::Parse(err.to_string()))?;

    // Only http(s) allowed.
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err(UrlSafetyError::BadScheme),
    }

    let host = parsed.host_str().ok_or(UrlSafetyError::MissingHost)?;

    // Block obvious literal hostnames quickly.
    let host_lower = host.to_ascii_lowercase();
    if matches!(
        host_lower.as_str(),
        "localhost"
            | "ip6-localhost"
            | "ip6-loopback"
            | "broadcasthost"
            | "metadata"
            | "metadata.google.internal"
    ) {
        return Err(UrlSafetyError::BlockedHost(host.to_string()));
    }

    // If the URL host is already an IP literal, validate it directly.
    if let Some(ip) = parsed.host().and_then(|host| match host {
        url::Host::Ipv4(addr) => Some(IpAddr::V4(addr)),
        url::Host::Ipv6(addr) => Some(IpAddr::V6(addr)),
        url::Host::Domain(_) => None,
    }) {
        if is_blocked_ip(&ip) {
            return Err(UrlSafetyError::BlockedHost(ip.to_string()));
        }
        return Ok(parsed);
    }

    // Otherwise resolve DNS and ensure **all** resolved addresses are safe.
    // Rejecting on a single blocked answer prevents DNS-rebinding / multi-A
    // attacks where the attacker returns a public IP first and a private IP
    // second.
    let port = parsed.port_or_known_default().unwrap_or(0);
    let lookup_target = format!("{}:{}", host, port);

    let addrs = lookup_host(&lookup_target)
        .await
        .map_err(|err| UrlSafetyError::DnsResolution(host.to_string(), err.to_string()))?
        .map(|sock| sock.ip())
        .collect::<Vec<_>>();

    if addrs.is_empty() {
        return Err(UrlSafetyError::NoUsableAddress(host.to_string()));
    }

    if let Some(blocked) = addrs.iter().find(|ip| is_blocked_ip(ip)) {
        return Err(UrlSafetyError::BlockedHost(blocked.to_string()));
    }

    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_loopback_v4() {
        assert!(is_blocked_ip(&"127.0.0.1".parse().unwrap()));
        assert!(is_blocked_ip(&"127.255.255.254".parse().unwrap()));
    }

    #[test]
    fn blocks_private_v4() {
        assert!(is_blocked_ip(&"10.0.0.1".parse().unwrap()));
        assert!(is_blocked_ip(&"172.16.0.1".parse().unwrap()));
        assert!(is_blocked_ip(&"172.31.255.255".parse().unwrap()));
        assert!(is_blocked_ip(&"192.168.1.1".parse().unwrap()));
    }

    #[test]
    fn blocks_metadata_v4() {
        // 169.254.0.0/16 link-local, includes the cloud metadata service.
        assert!(is_blocked_ip(&"169.254.169.254".parse().unwrap()));
    }

    #[test]
    fn blocks_carrier_grade_nat() {
        assert!(is_blocked_ip(&"100.64.0.1".parse().unwrap()));
        assert!(is_blocked_ip(&"100.127.255.254".parse().unwrap()));
        assert!(!is_blocked_ip(&"100.63.255.255".parse().unwrap()));
        assert!(!is_blocked_ip(&"100.128.0.0".parse().unwrap()));
    }

    #[test]
    fn allows_public_v4() {
        assert!(!is_blocked_ip(&"8.8.8.8".parse().unwrap()));
        assert!(!is_blocked_ip(&"1.1.1.1".parse().unwrap()));
        assert!(!is_blocked_ip(&"172.32.0.1".parse().unwrap()));
    }

    #[test]
    fn blocks_loopback_v6() {
        assert!(is_blocked_ip(&"::1".parse().unwrap()));
    }

    #[test]
    fn blocks_unique_local_v6() {
        assert!(is_blocked_ip(&"fc00::1".parse().unwrap()));
        assert!(is_blocked_ip(&"fd00::1".parse().unwrap()));
    }

    #[test]
    fn blocks_link_local_v6() {
        assert!(is_blocked_ip(&"fe80::1".parse().unwrap()));
    }

    #[test]
    fn blocks_ipv4_mapped_v6() {
        let mapped: Ipv6Addr = "::ffff:127.0.0.1".parse().unwrap();
        assert!(is_blocked_ipv6(&mapped));
    }

    #[tokio::test]
    async fn rejects_localhost_literal() {
        let err = ensure_safe_external_url("http://localhost:6379/")
            .await
            .unwrap_err();
        assert!(matches!(err, UrlSafetyError::BlockedHost(_)));
    }

    #[tokio::test]
    async fn rejects_metadata_literal() {
        let err = ensure_safe_external_url("http://169.254.169.254/latest/meta-data")
            .await
            .unwrap_err();
        assert!(matches!(err, UrlSafetyError::BlockedHost(_)));
    }

    #[tokio::test]
    async fn rejects_private_ip_literal() {
        let err = ensure_safe_external_url("http://10.0.0.1/")
            .await
            .unwrap_err();
        assert!(matches!(err, UrlSafetyError::BlockedHost(_)));
    }

    #[tokio::test]
    async fn rejects_ftp_scheme() {
        let err = ensure_safe_external_url("ftp://example.com/")
            .await
            .unwrap_err();
        assert!(matches!(err, UrlSafetyError::BadScheme));
    }

    #[tokio::test]
    async fn rejects_file_scheme() {
        let err = ensure_safe_external_url("file:///etc/passwd")
            .await
            .unwrap_err();
        assert!(matches!(err, UrlSafetyError::BadScheme));
    }

    #[tokio::test]
    async fn rejects_empty() {
        let err = ensure_safe_external_url("   ").await.unwrap_err();
        assert!(matches!(err, UrlSafetyError::Empty));
    }
}
