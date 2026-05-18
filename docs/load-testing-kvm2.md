# Load Testing KVM 2

Gunakan load test ini setelah deploy ke VPS, bukan dari laptop lokal yang koneksinya tidak stabil.

## Target Awal

- `/health`: harus mampu menerima 1000 concurrent connection dengan error rendah.
- `/api/catalogs?page=1&limit=50`: ukur request DB ringan dengan analytics window 30 hari.
- p95 latency untuk endpoint katalog sebaiknya di bawah 500-1000 ms pada trafik normal.
- Jika error 502/504 muncul, turunkan `CONNECTIONS` dan cek `journalctl`, `docker stats`/`htop`, serta slow query MySQL.

## Jalankan

```bash
sudo apt-get update
sudo apt-get install -y wrk
cd /var/www/tridjaya
BASE_URL=http://127.0.0.1:8081 THREADS=2 CONNECTIONS=1000 DURATION=60s ./scripts/load_test_kvm2.sh
```

## Parameter KVM 2 Yang Disarankan

```bash
MYSQL_MAX_CONNECTIONS=25
MYSQL_ACQUIRE_TIMEOUT_SECS=5
MAX_IN_FLIGHT_REQUESTS=300
REQUEST_TIMEOUT_SECS=30
TELEMETRY_ANALYTICS_WINDOW_DAYS=30
WA_ENQUEUE_BATCH_SIZE=1000
```

Naikkan `MYSQL_MAX_CONNECTIONS` bertahap hanya jika CPU MySQL masih longgar dan latency pool terlihat antre. Untuk 2 vCPU, terlalu banyak koneksi aktif biasanya membuat latency lebih buruk.
`MAX_IN_FLIGHT_REQUESTS` adalah katup pengaman backend. Jika penuh, backend mengembalikan `503` cepat agar request tidak menumpuk sampai database atau RAM habis.
Saat benchmark dari satu mesin/IP, set sementara `PUBLIC_READ_MAX_PER_MINUTE=5000` dan naikkan Nginx `api_per_ip` hanya untuk sesi benchmark agar hasil tidak didominasi respons `429`.
