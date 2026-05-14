# Panduan Akses Per Role - Testing Guide

## Login URL
```
http://localhost:5173/login
```

## Akun Test Per Role

| Role | Email | Password | Redirect Setelah Login |
|------|-------|----------|----------------------|
| **Admin** | `admin@gmail.com` | `123` | `/dashboard/admin` |
| **Operator** | `operator@gmail.com` | `123` | `/dashboard/admin` |
| **Sales** | `sales@gmail.com` | `123` | `/dashboard/sales` |
| **Agent** | `agent@gmail.com` | `123` | `/dashboard/agent` |

## Role Aktif

Sistem sekarang hanya memakai empat role: `admin`, `operator`, `sales`, dan `agent`.

### Admin

Admin memiliki akses penuh ke dashboard internal, termasuk users, finance, agen, katalog, konten, WA Blast, dan Pixel Campaign.

### Operator

Operator memiliki akses operasional untuk:
- WA Blast
- Katalog produk
- Konten dan landing slides
- Promo dan partner brand
- Pixel Campaign, Pixel Analytics, dan Pixel Tester

Operator tidak mengelola user, finance, agen, lead, career, atau support ticket.

### Sales

Sales memakai dashboard sales untuk product knowledge, jadwal pengiriman, referral link, pixel analytics, pengaturan, dan support.

### Agent

Agent memakai dashboard agent untuk product knowledge, pipeline prospek, push prospek, leaderboard, komisi, pixel analytics, pengaturan, dan support.

## Cara Testing

1. Buka `/login`.
2. Masukkan email dan password dari tabel di atas.
3. Pastikan redirect sesuai role.
4. Cek sidebar hanya menampilkan menu sesuai role.
5. Akses URL yang tidak diizinkan harus redirect ke `/dashboard` atau mendapat 403 dari API.

## Test Negatif

| Skenario | Expected |
|----------|----------|
| Operator akses `/dashboard/admin/users` | Redirect ke `/dashboard` |
| Operator akses `/dashboard/admin/finance` | Redirect ke `/dashboard` |
| Sales akses `/dashboard/admin` | Redirect ke `/dashboard` |
| Agent akses `/dashboard/sales/delivery` | Redirect ke `/dashboard` |
| Tanpa login akses `/dashboard/*` | Redirect ke `/login` |
