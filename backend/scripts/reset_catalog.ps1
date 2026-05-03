# Script to reset catalog data
# Usage: ./reset_catalog.ps1

$env:ALLOW_DESTRUCTIVE="yes-i-mean-it"
Write-Host "Sedang menghapus data produk, kategori, dan promo..." -ForegroundColor Yellow
cargo run --bin clear_catalog --features dev-tools
Write-Host "Proses selesai." -ForegroundColor Green
