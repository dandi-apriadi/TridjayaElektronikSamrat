#!/bin/bash
# Script to reset catalog data
# Usage: ./reset_catalog.sh

export ALLOW_DESTRUCTIVE="yes-i-mean-it"
echo "Sedang menghapus data produk, kategori, dan promo..."
cargo run --bin clear_catalog --features dev-tools
echo "Proses selesai."
