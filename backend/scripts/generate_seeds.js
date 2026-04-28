const fs = require('fs');
const crypto = require('crypto');

const AGENTS_COUNT = 15;
const ADMINS_COUNT = 3;
const LEADS_PER_AGENT_AVG = 40;
const DAYS_SIMULATION = 365;

const NOW = new Date('2026-04-28T00:00:00Z');
const START_DATE = new Date(NOW.getTime() - DAYS_SIMULATION * 24 * 60 * 60 * 1000);

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
    return date.toISOString();
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

const firstNames = ['Budi', 'Siti', 'Andi', 'Dewi', 'Joko', 'Rina', 'Agus', 'Maya', 'Eko', 'Sari', 'Dani', 'Lia', 'Heri', 'Wati', 'Tono'];
const lastNames = ['Santoso', 'Wijaya', 'Pratama', 'Sari', 'Kurniawan', 'Hidayat', 'Susanto', 'Putri', 'Saputra', 'Lestari'];
const cities = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Bekasi', 'Depok'];
const provinces = ['DKI Jakarta', 'Jawa Timur', 'Jawa Barat', 'Sumatera Utara', 'Jawa Tengah', 'Sulawesi Selatan', 'Sumatera Selatan', 'Banten', 'Jawa Barat', 'Jawa Barat'];

const products = [
    {
        id: "p1",
        name: "COMFORTA SET KASUR + DIVAN SUPER ONE 180",
        category: "KASUR",
        price: 3200000,
        image: "",
        shortDesc: "Set Kasur Comforta 180x200cm, Nyaman dan Tahan Lama.",
        description: "Tidur lebih berkualitas dengan Comforta Super One. Menggunakan busa kepadatan tinggi dan sistem pegas yang didesain untuk menopang tulang belakang dengan sempurna.",
        specs: {
            "Ukuran": "180 x 200 cm (King Size)",
            "Tipe": "Innerspring / Pegas",
            "Fitur": "Flip-Free (Tidak Perlu Dibalik), High Density Foam"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p2",
        name: "Set sofa minimalis + meja abu corak",
        category: "SOPA",
        price: 2800000,
        image: "",
        shortDesc: "SOPA Set sofa minimalis + meja abu corak berkualitas tinggi untuk kebutuhan Anda.",
        description: "Set sofa minimalis + meja abu corak adalah produk pilihan di kategori SOPA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "Set sofa minimalis + meja abu corak",
            "Kategori": "SOPA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p3",
        name: "AC LG STANDARD 1/2 PK K05NSA",
        category: "AC",
        price: 2750000,
        image: "",
        shortDesc: "AC AC LG STANDARD 1/2 PK K05NSA berkualitas tinggi untuk kebutuhan Anda.",
        description: "AC LG STANDARD 1/2 PK K05NSA adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "AC LG STANDARD 1/2 PK K05NSA",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p4",
        name: "AC SHARP 1 PK AH-A9ZCY+AU-A9ZCY",
        category: "AC",
        price: 3350000,
        image: "",
        shortDesc: "AC AC SHARP 1 PK AH-A9ZCY+AU-A9ZCY berkualitas tinggi untuk kebutuhan Anda.",
        description: "AC SHARP 1 PK AH-A9ZCY+AU-A9ZCY adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "AC SHARP 1 PK AH-A9ZCY+AU-A9ZCY",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p5",
        name: "AC SHARP 1/2 PK AH-A5ZCY+AU-A5ZCY",
        category: "AC",
        price: 2850000,
        image: "",
        shortDesc: "AC AC SHARP 1/2 PK AH-A5ZCY+AU-A5ZCY berkualitas tinggi untuk kebutuhan Anda.",
        description: "AC SHARP 1/2 PK AH-A5ZCY+AU-A5ZCY adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "AC SHARP 1/2 PK AH-A5ZCY+AU-A5ZCY",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p6",
        name: "AQUA KULKAS AQR-DTM245CBP",
        category: "KULKAS",
        price: 2850000,
        image: "",
        shortDesc: "KULKAS AQUA KULKAS AQR-DTM245CBP berkualitas tinggi untuk kebutuhan Anda.",
        description: "AQUA KULKAS AQR-DTM245CBP adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "AQUA KULKAS AQR-DTM245CBP",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p7",
        name: "BAN AURORA",
        category: "BAN",
        price: 200000,
        image: "",
        shortDesc: "BAN BAN AURORA berkualitas tinggi untuk kebutuhan Anda.",
        description: "BAN AURORA adalah produk pilihan di kategori BAN yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BAN AURORA",
            "Kategori": "BAN",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p8",
        name: "BAN LUAR SAIGE EGO PLUS",
        category: "SPAREPART SELIS",
        price: 150000,
        image: "",
        shortDesc: "SPAREPART SELIS BAN LUAR SAIGE EGO PLUS berkualitas tinggi untuk kebutuhan Anda.",
        description: "BAN LUAR SAIGE EGO PLUS adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BAN LUAR SAIGE EGO PLUS",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p9",
        name: "BAN POLARIS",
        category: "BAN",
        price: 200000,
        image: "",
        shortDesc: "BAN BAN POLARIS berkualitas tinggi untuk kebutuhan Anda.",
        description: "BAN POLARIS adalah produk pilihan di kategori BAN yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BAN POLARIS",
            "Kategori": "BAN",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p10",
        name: "BATERAI GODA 48V/12AH",
        category: "BATERAI",
        price: 0,
        image: "",
        shortDesc: "BATERAI BATERAI GODA 48V/12AH berkualitas tinggi untuk kebutuhan Anda.",
        description: "BATERAI GODA 48V/12AH adalah produk pilihan di kategori BATERAI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BATERAI GODA 48V/12AH",
            "Kategori": "BATERAI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p11",
        name: "BATERAI GODA 48V/20AH",
        category: "BATERAI",
        price: 0,
        image: "",
        shortDesc: "BATERAI BATERAI GODA 48V/20AH berkualitas tinggi untuk kebutuhan Anda.",
        description: "BATERAI GODA 48V/20AH adalah produk pilihan di kategori BATERAI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BATERAI GODA 48V/20AH",
            "Kategori": "BATERAI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p12",
        name: "BATERAI SAIGE 48V/20AH",
        category: "BATERAI",
        price: 0,
        image: "",
        shortDesc: "BATERAI BATERAI SAIGE 48V/20AH berkualitas tinggi untuk kebutuhan Anda.",
        description: "BATERAI SAIGE 48V/20AH adalah produk pilihan di kategori BATERAI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BATERAI SAIGE 48V/20AH",
            "Kategori": "BATERAI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p13",
        name: "BATERAI SAIGE LITHIUM 48V/20AH",
        category: "BATERAI",
        price: 0,
        image: "",
        shortDesc: "BATERAI BATERAI SAIGE LITHIUM 48V/20AH berkualitas tinggi untuk kebutuhan Anda.",
        description: "BATERAI SAIGE LITHIUM 48V/20AH adalah produk pilihan di kategori BATERAI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BATERAI SAIGE LITHIUM 48V/20AH",
            "Kategori": "BATERAI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p14",
        name: "BATERAI U-WINFLY 48V/12AH",
        category: "BATERAI",
        price: 0,
        image: "",
        shortDesc: "BATERAI BATERAI U-WINFLY 48V/12AH berkualitas tinggi untuk kebutuhan Anda.",
        description: "BATERAI U-WINFLY 48V/12AH adalah produk pilihan di kategori BATERAI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BATERAI U-WINFLY 48V/12AH",
            "Kategori": "BATERAI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p15",
        name: "BLENDER COSMOS CB-171-AP",
        category: "BLENDER",
        price: 260000,
        image: "",
        shortDesc: "Blender Cosmos 2 in 1 dengan Pisau Stainless Steel.",
        description: "Blender Cosmos CB-171-AP sangat handal untuk menghaluskan bumbu maupun buah. Dilengkapi dengan dry mill untuk menghaluskan biji-bijian.",
        specs: {
            "Kapasitas": "1 Liter",
            "Daya": "200-380 Watt",
            "Bahan": "Plastik Food Grade"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p16",
        name: "BRACKET AC 1 PK",
        category: "BRAKET",
        price: 70000,
        image: "",
        shortDesc: "BRAKET BRACKET AC 1 PK berkualitas tinggi untuk kebutuhan Anda.",
        description: "BRACKET AC 1 PK adalah produk pilihan di kategori BRAKET yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BRACKET AC 1 PK",
            "Kategori": "BRAKET",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p17",
        name: "BRACKET TV QUALITY 50-100",
        category: "BRAKET",
        price: 385000,
        image: "",
        shortDesc: "BRAKET BRACKET TV QUALITY 50-100 berkualitas tinggi untuk kebutuhan Anda.",
        description: "BRACKET TV QUALITY 50-100 adalah produk pilihan di kategori BRAKET yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BRACKET TV QUALITY 50-100",
            "Kategori": "BRAKET",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p18",
        name: "BRAKET TV BERVIN BWBA-1940M",
        category: "BRAKET",
        price: 110000,
        image: "",
        shortDesc: "BRAKET BRAKET TV BERVIN BWBA-1940M berkualitas tinggi untuk kebutuhan Anda.",
        description: "BRAKET TV BERVIN BWBA-1940M adalah produk pilihan di kategori BRAKET yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "BRAKET TV BERVIN BWBA-1940M",
            "Kategori": "BRAKET",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p19",
        name: "CHARGER SAIGE 48V-12AH",
        category: "SPAREPART SELIS",
        price: 160000,
        image: "",
        shortDesc: "SPAREPART SELIS CHARGER SAIGE 48V-12AH berkualitas tinggi untuk kebutuhan Anda.",
        description: "CHARGER SAIGE 48V-12AH adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "CHARGER SAIGE 48V-12AH",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p20",
        name: "CHARGER SAIGE 48V-20AH",
        category: "SPAREPART SELIS",
        price: 230000,
        image: "",
        shortDesc: "SPAREPART SELIS CHARGER SAIGE 48V-20AH berkualitas tinggi untuk kebutuhan Anda.",
        description: "CHARGER SAIGE 48V-20AH adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "CHARGER SAIGE 48V-20AH",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p21",
        name: "COSMOS AIR COOLER CAC 005-ABW",
        category: "AC",
        price: 1350000,
        image: "",
        shortDesc: "AC COSMOS AIR COOLER CAC 005-ABW berkualitas tinggi untuk kebutuhan Anda.",
        description: "COSMOS AIR COOLER CAC 005-ABW adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "COSMOS AIR COOLER CAC 005-ABW",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p22",
        name: "DENPO PIPA ECONOMY 1/4 + 3/8",
        category: "AC",
        price: 0,
        image: "",
        shortDesc: "AC DENPO PIPA ECONOMY 1/4 + 3/8 berkualitas tinggi untuk kebutuhan Anda.",
        description: "DENPO PIPA ECONOMY 1/4 + 3/8 adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "DENPO PIPA ECONOMY 1/4 + 3/8",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p23",
        name: "DENPOO PIPA AC PLATINUM 1/4+1/2 x 0.6",
        category: "AC",
        price: 130000,
        image: "",
        shortDesc: "AC DENPOO PIPA AC PLATINUM 1/4+1/2 x 0.6 berkualitas tinggi untuk kebutuhan Anda.",
        description: "DENPOO PIPA AC PLATINUM 1/4+1/2 x 0.6 adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "DENPOO PIPA AC PLATINUM 1/4+1/2 x 0.6",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p24",
        name: "DISPENSER COSMOS CWD-113",
        category: "DISPENSER",
        price: 200000,
        image: "",
        shortDesc: "DISPENSER DISPENSER COSMOS CWD-113 berkualitas tinggi untuk kebutuhan Anda.",
        description: "DISPENSER COSMOS CWD-113 adalah produk pilihan di kategori DISPENSER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "DISPENSER COSMOS CWD-113",
            "Kategori": "DISPENSER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p25",
        name: "DISPENSER COSMOS CWD-115",
        category: "DISPENSER",
        price: 250000,
        image: "",
        shortDesc: "DISPENSER DISPENSER COSMOS CWD-115 berkualitas tinggi untuk kebutuhan Anda.",
        description: "DISPENSER COSMOS CWD-115 adalah produk pilihan di kategori DISPENSER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "DISPENSER COSMOS CWD-115",
            "Kategori": "DISPENSER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p26",
        name: "DISPENSER COSMOS CWD-1170",
        category: "DISPENSER",
        price: 200000,
        image: "",
        shortDesc: "DISPENSER DISPENSER COSMOS CWD-1170 berkualitas tinggi untuk kebutuhan Anda.",
        description: "DISPENSER COSMOS CWD-1170 adalah produk pilihan di kategori DISPENSER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "DISPENSER COSMOS CWD-1170",
            "Kategori": "DISPENSER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p27",
        name: "ELECTRIC OVEN COSMOS CO-9919 R",
        category: "OVEN",
        price: 690000,
        image: "",
        shortDesc: "OVEN ELECTRIC OVEN COSMOS CO-9919 R berkualitas tinggi untuk kebutuhan Anda.",
        description: "ELECTRIC OVEN COSMOS CO-9919 R adalah produk pilihan di kategori OVEN yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "ELECTRIC OVEN COSMOS CO-9919 R",
            "Kategori": "OVEN",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p28",
        name: "FAN COSMOS 16 SDB",
        category: "KIPAS",
        price: 265000,
        image: "",
        shortDesc: "KIPAS FAN COSMOS 16 SDB berkualitas tinggi untuk kebutuhan Anda.",
        description: "FAN COSMOS 16 SDB adalah produk pilihan di kategori KIPAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FAN COSMOS 16 SDB",
            "Kategori": "KIPAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p29",
        name: "FREEZER BOX GEA AB-108 R",
        category: "FREEZER",
        price: 2300000,
        image: "",
        shortDesc: "FREEZER FREEZER BOX GEA AB-108 R berkualitas tinggi untuk kebutuhan Anda.",
        description: "FREEZER BOX GEA AB-108 R adalah produk pilihan di kategori FREEZER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FREEZER BOX GEA AB-108 R",
            "Kategori": "FREEZER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p30",
        name: "FREEZER BOX GEA AB-208-R",
        category: "FREEZER",
        price: 3000000,
        image: "",
        shortDesc: "FREEZER FREEZER BOX GEA AB-208-R berkualitas tinggi untuk kebutuhan Anda.",
        description: "FREEZER BOX GEA AB-208-R adalah produk pilihan di kategori FREEZER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FREEZER BOX GEA AB-208-R",
            "Kategori": "FREEZER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p31",
        name: "FREEZER BOX RSA CF-210",
        category: "FREEZER",
        price: 2600000,
        image: "",
        shortDesc: "Chest Freezer 199 Liter untuk kebutuhan bisnis dan rumah tangga.",
        description: "RSA CF-210 adalah freezer box yang handal untuk menyimpan stok makanan beku dalam jumlah besar. Sangat hemat energi dan memiliki fitur kunci untuk keamanan.",
        specs: {
            "Volume": "199 Liter",
            "Daya": "125 Watt",
            "Dimensi": "802 x 559 x 854 mm",
            "Temp": "-15°C s/d -25°C",
            "Fitur": "Digital Thermometer, Key Lock, Hemat Listrik"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p32",
        name: "FREEZER BOX RSA CF-310Q",
        category: "FREEZER",
        price: 3300000,
        image: "",
        shortDesc: "FREEZER FREEZER BOX RSA CF-310Q berkualitas tinggi untuk kebutuhan Anda.",
        description: "FREEZER BOX RSA CF-310Q adalah produk pilihan di kategori FREEZER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FREEZER BOX RSA CF-310Q",
            "Kategori": "FREEZER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p33",
        name: "FREZEER AQUA AQF-460MG",
        category: "FREEZER",
        price: 4600000,
        image: "",
        shortDesc: "FREEZER FREZEER AQUA AQF-460MG berkualitas tinggi untuk kebutuhan Anda.",
        description: "FREZEER AQUA AQF-460MG adalah produk pilihan di kategori FREEZER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FREZEER AQUA AQF-460MG",
            "Kategori": "FREEZER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p34",
        name: "FREZER AQUA AQF-120MC",
        category: "FREEZER",
        price: 2050000,
        image: "",
        shortDesc: "FREEZER FREZER AQUA AQF-120MC berkualitas tinggi untuk kebutuhan Anda.",
        description: "FREZER AQUA AQF-120MC adalah produk pilihan di kategori FREEZER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FREZER AQUA AQF-120MC",
            "Kategori": "FREEZER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p35",
        name: "FREZER RSA CF-110",
        category: "FREEZER",
        price: 2000000,
        image: "",
        shortDesc: "FREEZER FREZER RSA CF-110 berkualitas tinggi untuk kebutuhan Anda.",
        description: "FREZER RSA CF-110 adalah produk pilihan di kategori FREEZER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FREZER RSA CF-110",
            "Kategori": "FREEZER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p36",
        name: "FREZER RSA CF-310",
        category: "KULKAS",
        price: 3500000,
        image: "",
        shortDesc: "KULKAS FREZER RSA CF-310 berkualitas tinggi untuk kebutuhan Anda.",
        description: "FREZER RSA CF-310 adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FREZER RSA CF-310",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p37",
        name: "FRIZER BOX RSA XS-110",
        category: "KULKAS",
        price: 2750000,
        image: "",
        shortDesc: "KULKAS FRIZER BOX RSA XS-110 berkualitas tinggi untuk kebutuhan Anda.",
        description: "FRIZER BOX RSA XS-110 adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "FRIZER BOX RSA XS-110",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p38",
        name: "HANDLE REM KANAN SAIGE M35",
        category: "SPAREPART SELIS",
        price: 30000,
        image: "",
        shortDesc: "SPAREPART SELIS HANDLE REM KANAN SAIGE M35 berkualitas tinggi untuk kebutuhan Anda.",
        description: "HANDLE REM KANAN SAIGE M35 adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "HANDLE REM KANAN SAIGE M35",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p39",
        name: "HANDLE REM KIRI SAIGE LUNA",
        category: "SPAREPART SELIS",
        price: 85000,
        image: "",
        shortDesc: "Sepeda Listrik Saige Luna Premium.",
        description: "Saige Luna adalah kasta tertinggi dari sepeda listrik Saige. Desain sangat elegan layaknya motor matic dengan fitur serba digital.",
        specs: {
            "Motor": "800 Watt",
            "Baterai": "48V / 20Ah",
            "Jarak": "60 km",
            "Fitur": "NFC Lock, Digital Panel, Hydraulic Brake"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p40",
        name: "HANDLE REM KIRI SAIGE M35",
        category: "SPAREPART SELIS",
        price: 30000,
        image: "",
        shortDesc: "SPAREPART SELIS HANDLE REM KIRI SAIGE M35 berkualitas tinggi untuk kebutuhan Anda.",
        description: "HANDLE REM KIRI SAIGE M35 adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "HANDLE REM KIRI SAIGE M35",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p41",
        name: "Handphone Samsung A56 5G 8/256GB Pink",
        category: "HP",
        price: 6200000,
        image: "",
        shortDesc: "Smartphone 5G Premium dengan Layar Super AMOLED 120Hz.",
        description: "Samsung Galaxy A56 5G menghadirkan performa tingkat tinggi dengan chipset Exynos 1580 dan layar Super AMOLED yang sangat cerah. Sempurna untuk gaming dan fotografi mobile.",
        specs: {
            "Layar": "6.7 inch Super AMOLED 120Hz",
            "Processor": "Exynos 1580 (4nm)",
            "RAM/Storage": "8/256 GB",
            "Kamera": "50MP OIS + 12MP + 5MP",
            "Baterai": "5000mAh, 25W Fast Charging",
            "Sertifikasi": "IP67 Tahan Air & Debu"
    },
        highlights: ["Layar 120Hz super halus","Kamera 50MP dengan OIS (Anti Goyang)","Chipset kencang Exynos 1580"],
        sellingPoints: ["Update software hingga 4 tahun","Hasil foto malam hari (Nightography) sangat jernih","Tahan air, aman dibawa hujan-hujanan"],
        objections: ["\"Mahal?\" -> Sesuai kualitas flagship di kelas menengah.","\"Panas?\" -> Sudah pakai sistem pendingin baru untuk Exynos 1580."]
    },
    {
        id: "p42",
        name: "HISENSE AC SPLIT 1 PK AN09CDG",
        category: "AC",
        price: 3000000,
        image: "",
        shortDesc: "AC HISENSE AC SPLIT 1 PK AN09CDG berkualitas tinggi untuk kebutuhan Anda.",
        description: "HISENSE AC SPLIT 1 PK AN09CDG adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "HISENSE AC SPLIT 1 PK AN09CDG",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p43",
        name: "HISENSE AC SPLIT 1/2 PK AN05CDG",
        category: "AC",
        price: 2700000,
        image: "",
        shortDesc: "AC HISENSE AC SPLIT 1/2 PK AN05CDG berkualitas tinggi untuk kebutuhan Anda.",
        description: "HISENSE AC SPLIT 1/2 PK AN05CDG adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "HISENSE AC SPLIT 1/2 PK AN05CDG",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p44",
        name: "HISENSE SMART TV 32A4200G",
        category: "TV",
        price: 1999000,
        image: "",
        shortDesc: "Smart TV Hisense 32 inci dengan Android 11 dan Bezel Tipis.",
        description: "Hisense 32A4200G memberikan pengalaman hiburan pintar di rumah Anda. Dengan sistem operasi Android, Anda bisa mengakses ribuan aplikasi seperti YouTube dan Netflix dengan mudah.",
        specs: {
            "Layar": "32 inch HD (1366x768)",
            "OS": "Android TV 11",
            "Konektivitas": "WiFi, Bluetooth, HDMI, USB",
            "Fitur": "Bezel-less Design, Google Assistant, DTS Virtual-X"
    },
        highlights: ["Android TV 11 dengan ribuan aplikasi","Desain Bezel-less (Layar penuh)","Suara jernih dengan DTS Virtual-X"],
        sellingPoints: ["Paling terjangkau di kelasnya","Garansi panel 4 tahun","Mendukung voice control lewat Remote"],
        objections: ["\"Merek Cina bagus?\" -> Hisense adalah sponsor utama Euro & World Cup, kualitas global.","\"Gambar pecah?\" -> Panel grade A+ menjamin ketajaman warna."]
    },
    {
        id: "p45",
        name: "HISENSE SMART TV 43E6K",
        category: "TV",
        price: 3300000,
        image: "",
        shortDesc: "Smart TV Hisense 43 inci 4K UHD Google TV.",
        description: "Hisense 43E6K menghadirkan gambar 4K yang sangat detail dan sistem Google TV yang cerdas. Mendukung Dolby Vision dan HDR10 untuk pengalaman sinematik di rumah.",
        specs: {
            "Resolusi": "4K UHD (3840x2160)",
            "OS": "Google TV",
            "Fitur": "Dolby Vision, Game Mode Plus, Voice Control, HDR10"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p46",
        name: "Hp Samsung Galaxy A56 5G 8/256 Light Gray",
        category: "HP",
        price: 6200000,
        image: "",
        shortDesc: "Smartphone 5G Premium dengan Layar Super AMOLED 120Hz.",
        description: "Samsung Galaxy A56 5G menghadirkan performa tingkat tinggi dengan chipset Exynos 1580 dan layar Super AMOLED yang sangat cerah. Sempurna untuk gaming dan fotografi mobile.",
        specs: {
            "Layar": "6.7 inch Super AMOLED 120Hz",
            "Processor": "Exynos 1580 (4nm)",
            "RAM/Storage": "8/256 GB",
            "Kamera": "50MP OIS + 12MP + 5MP",
            "Baterai": "5000mAh, 25W Fast Charging",
            "Sertifikasi": "IP67 Tahan Air & Debu"
    },
        highlights: ["Layar 120Hz super halus","Kamera 50MP dengan OIS (Anti Goyang)","Chipset kencang Exynos 1580"],
        sellingPoints: ["Update software hingga 4 tahun","Hasil foto malam hari (Nightography) sangat jernih","Tahan air, aman dibawa hujan-hujanan"],
        objections: ["\"Mahal?\" -> Sesuai kualitas flagship di kelas menengah.","\"Panas?\" -> Sudah pakai sistem pendingin baru untuk Exynos 1580."]
    },
    {
        id: "p47",
        name: "IMP TV CABINET 120 MOTIF L04",
        category: "MEJA",
        price: 1100000,
        image: "",
        shortDesc: "MEJA IMP TV CABINET 120 MOTIF L04 berkualitas tinggi untuk kebutuhan Anda.",
        description: "IMP TV CABINET 120 MOTIF L04 adalah produk pilihan di kategori MEJA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "IMP TV CABINET 120 MOTIF L04",
            "Kategori": "MEJA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p48",
        name: "IMP ZW-M03 C01 DM LEMARI BESI 3 PINTU 120 CM",
        category: "LEMARI",
        price: 2900000,
        image: "",
        shortDesc: "LEMARI IMP ZW-M03 C01 DM LEMARI BESI 3 PINTU 120 CM berkualitas tinggi untuk kebutuhan Anda.",
        description: "IMP ZW-M03 C01 DM LEMARI BESI 3 PINTU 120 CM adalah produk pilihan di kategori LEMARI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "IMP ZW-M03 C01 DM LEMARI BESI 3 PINTU 120 CM",
            "Kategori": "LEMARI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p49",
        name: "IMP ZW-M03 C11 DM LEMARI BESI 3 PINTU 120 CM",
        category: "LEMARI",
        price: 2900000,
        image: "",
        shortDesc: "LEMARI IMP ZW-M03 C11 DM LEMARI BESI 3 PINTU 120 CM berkualitas tinggi untuk kebutuhan Anda.",
        description: "IMP ZW-M03 C11 DM LEMARI BESI 3 PINTU 120 CM adalah produk pilihan di kategori LEMARI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "IMP ZW-M03 C11 DM LEMARI BESI 3 PINTU 120 CM",
            "Kategori": "LEMARI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p50",
        name: "IMP ZW-M03 C21 DM LEMARI BESI 3 PINTU 120 CM",
        category: "LEMARI",
        price: 2900000,
        image: "",
        shortDesc: "LEMARI IMP ZW-M03 C21 DM LEMARI BESI 3 PINTU 120 CM berkualitas tinggi untuk kebutuhan Anda.",
        description: "IMP ZW-M03 C21 DM LEMARI BESI 3 PINTU 120 CM adalah produk pilihan di kategori LEMARI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "IMP ZW-M03 C21 DM LEMARI BESI 3 PINTU 120 CM",
            "Kategori": "LEMARI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p51",
        name: "ISI KAMPAS REM DEPAN / BELAKANG M35",
        category: "AKSESORIS",
        price: 150000,
        image: "",
        shortDesc: "AKSESORIS ISI KAMPAS REM DEPAN / BELAKANG M35 berkualitas tinggi untuk kebutuhan Anda.",
        description: "ISI KAMPAS REM DEPAN / BELAKANG M35 adalah produk pilihan di kategori AKSESORIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "ISI KAMPAS REM DEPAN / BELAKANG M35",
            "Kategori": "AKSESORIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p52",
        name: "KABEL AKI SAIGE",
        category: "SPAREPART SELIS",
        price: 13000,
        image: "",
        shortDesc: "SPAREPART SELIS KABEL AKI SAIGE berkualitas tinggi untuk kebutuhan Anda.",
        description: "KABEL AKI SAIGE adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KABEL AKI SAIGE",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p53",
        name: "KABEL FEDERAL NYM 2X1.5 MM @30M",
        category: "AKSESORIS",
        price: 15000,
        image: "",
        shortDesc: "AKSESORIS KABEL FEDERAL NYM 2X1.5 MM @30M berkualitas tinggi untuk kebutuhan Anda.",
        description: "KABEL FEDERAL NYM 2X1.5 MM @30M adalah produk pilihan di kategori AKSESORIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KABEL FEDERAL NYM 2X1.5 MM @30M",
            "Kategori": "AKSESORIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p54",
        name: "KABEL SUPREME NYM 2X1.5",
        category: "AKSESORIS",
        price: 15000,
        image: "",
        shortDesc: "AKSESORIS KABEL SUPREME NYM 2X1.5 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KABEL SUPREME NYM 2X1.5 adalah produk pilihan di kategori AKSESORIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KABEL SUPREME NYM 2X1.5",
            "Kategori": "AKSESORIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p55",
        name: "KAMPAS REM AURORA",
        category: "AKSESORIS",
        price: 150000,
        image: "",
        shortDesc: "AKSESORIS KAMPAS REM AURORA berkualitas tinggi untuk kebutuhan Anda.",
        description: "KAMPAS REM AURORA adalah produk pilihan di kategori AKSESORIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KAMPAS REM AURORA",
            "Kategori": "AKSESORIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p56",
        name: "KAMPAS REM BELAKANG SAIGE M35",
        category: "SPAREPART SELIS",
        price: 70000,
        image: "",
        shortDesc: "SPAREPART SELIS KAMPAS REM BELAKANG SAIGE M35 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KAMPAS REM BELAKANG SAIGE M35 adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KAMPAS REM BELAKANG SAIGE M35",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p57",
        name: "KAMPAS REM DEPAN SAIGE M35",
        category: "SPAREPART SELIS",
        price: 40000,
        image: "",
        shortDesc: "SPAREPART SELIS KAMPAS REM DEPAN SAIGE M35 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KAMPAS REM DEPAN SAIGE M35 adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KAMPAS REM DEPAN SAIGE M35",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p58",
        name: "KAMPAS REM POLARIS",
        category: "AKSESORIS",
        price: 150000,
        image: "",
        shortDesc: "AKSESORIS KAMPAS REM POLARIS berkualitas tinggi untuk kebutuhan Anda.",
        description: "KAMPAS REM POLARIS adalah produk pilihan di kategori AKSESORIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KAMPAS REM POLARIS",
            "Kategori": "AKSESORIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p59",
        name: "KASUR BUSA ROYAL FOAM MEDIACARE ORTHO 120 X 200",
        category: "KASUR",
        price: 1500000,
        image: "",
        shortDesc: "KASUR KASUR BUSA ROYAL FOAM MEDIACARE ORTHO 120 X 200 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KASUR BUSA ROYAL FOAM MEDIACARE ORTHO 120 X 200 adalah produk pilihan di kategori KASUR yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KASUR BUSA ROYAL FOAM MEDIACARE ORTHO 120 X 200",
            "Kategori": "KASUR",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p60",
        name: "KASUR GADJAH BALI 23 CM 120 X 200",
        category: "SOPA",
        price: 1050000,
        image: "",
        shortDesc: "SOPA KASUR GADJAH BALI 23 CM 120 X 200 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KASUR GADJAH BALI 23 CM 120 X 200 adalah produk pilihan di kategori SOPA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KASUR GADJAH BALI 23 CM 120 X 200",
            "Kategori": "SOPA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p61",
        name: "KASUR GADJAH BALI SUPERBED 160x200 23 CM",
        category: "KASUR",
        price: 1350000,
        image: "",
        shortDesc: "KASUR KASUR GADJAH BALI SUPERBED 160x200 23 CM berkualitas tinggi untuk kebutuhan Anda.",
        description: "KASUR GADJAH BALI SUPERBED 160x200 23 CM adalah produk pilihan di kategori KASUR yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KASUR GADJAH BALI SUPERBED 160x200 23 CM",
            "Kategori": "KASUR",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p62",
        name: "KETTLE COSMOS CTL-618N",
        category: "BLENDER",
        price: 180000,
        image: "",
        shortDesc: "BLENDER KETTLE COSMOS CTL-618N berkualitas tinggi untuk kebutuhan Anda.",
        description: "KETTLE COSMOS CTL-618N adalah produk pilihan di kategori BLENDER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KETTLE COSMOS CTL-618N",
            "Kategori": "BLENDER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p63",
        name: "KIPAS ANGIN COSMOS 12-LDA",
        category: "KIPAS",
        price: 210000,
        image: "",
        shortDesc: "KIPAS KIPAS ANGIN COSMOS 12-LDA berkualitas tinggi untuk kebutuhan Anda.",
        description: "KIPAS ANGIN COSMOS 12-LDA adalah produk pilihan di kategori KIPAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KIPAS ANGIN COSMOS 12-LDA",
            "Kategori": "KIPAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p64",
        name: "KIPAS ANGIN COSMOS 16 SN",
        category: "KIPAS",
        price: 315000,
        image: "",
        shortDesc: "KIPAS KIPAS ANGIN COSMOS 16 SN berkualitas tinggi untuk kebutuhan Anda.",
        description: "KIPAS ANGIN COSMOS 16 SN adalah produk pilihan di kategori KIPAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KIPAS ANGIN COSMOS 16 SN",
            "Kategori": "KIPAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p65",
        name: "KIPAS ANGIN COSMOS 16 WFC",
        category: "KIPAS",
        price: 275000,
        image: "",
        shortDesc: "KIPAS KIPAS ANGIN COSMOS 16 WFC berkualitas tinggi untuk kebutuhan Anda.",
        description: "KIPAS ANGIN COSMOS 16 WFC adalah produk pilihan di kategori KIPAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KIPAS ANGIN COSMOS 16 WFC",
            "Kategori": "KIPAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p66",
        name: "Kirin AIR FRYER 4.5L KAF - 745",
        category: "AIR FRYER",
        price: 999000,
        image: "",
        shortDesc: "AIR FRYER Kirin AIR FRYER 4.5L KAF - 745 berkualitas tinggi untuk kebutuhan Anda.",
        description: "Kirin AIR FRYER 4.5L KAF - 745 adalah produk pilihan di kategori AIR FRYER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "Kirin AIR FRYER 4.5L KAF - 745",
            "Kategori": "AIR FRYER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p67",
        name: "Kirin KNIFE SET 06 PP KUS-KS06",
        category: "PISAU",
        price: 175000,
        image: "",
        shortDesc: "PISAU Kirin KNIFE SET 06 PP KUS-KS06 berkualitas tinggi untuk kebutuhan Anda.",
        description: "Kirin KNIFE SET 06 PP KUS-KS06 adalah produk pilihan di kategori PISAU yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "Kirin KNIFE SET 06 PP KUS-KS06",
            "Kategori": "PISAU",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p68",
        name: "Kirin RICE COOKER 2.0 LT KRC 238 GREY",
        category: "MAGICOM",
        price: 330000,
        image: "",
        shortDesc: "MAGICOM Kirin RICE COOKER 2.0 LT KRC 238 GREY berkualitas tinggi untuk kebutuhan Anda.",
        description: "Kirin RICE COOKER 2.0 LT KRC 238 GREY adalah produk pilihan di kategori MAGICOM yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "Kirin RICE COOKER 2.0 LT KRC 238 GREY",
            "Kategori": "MAGICOM",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p69",
        name: "KLAKSON EGO PLUS",
        category: "AKSESORIS",
        price: 50000,
        image: "",
        shortDesc: "AKSESORIS KLAKSON EGO PLUS berkualitas tinggi untuk kebutuhan Anda.",
        description: "KLAKSON EGO PLUS adalah produk pilihan di kategori AKSESORIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KLAKSON EGO PLUS",
            "Kategori": "AKSESORIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p70",
        name: "KLAKSON M35",
        category: "AKSESORIS",
        price: 50000,
        image: "",
        shortDesc: "AKSESORIS KLAKSON M35 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KLAKSON M35 adalah produk pilihan di kategori AKSESORIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KLAKSON M35",
            "Kategori": "AKSESORIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p71",
        name: "KOMPOR GAS RINNAI RI-522 CE",
        category: "KOMPOR",
        price: 425000,
        image: "",
        shortDesc: "Kompor Gas Rinnai 2 Tungku Stainless Steel.",
        description: "Kompor gas legendaris dari Rinnai yang terkenal awet dan api biru yang stabil. Mudah dibersihkan karena menggunakan bahan stainless steel berkualitas.",
        specs: {
            "Tipe": "2 Tungku",
            "Bahan": "Stainless Steel",
            "Fitur": "Api Ekonomis, Tatakan Enamel"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p72",
        name: "KULKAS 1P SHARP SJ-N192D-VB",
        category: "KULKAS",
        price: 2150000,
        image: "",
        shortDesc: "Kulkas 1 Pintu Sharp Aurora Series yang Cantik dan Tangguh.",
        description: "Sharp SJ-N192D hadir dengan desain pola bunga Aurora yang menawan. Memiliki kapasitas luas dan tray kaca tempered yang kuat. Sangat efisien dalam penggunaan daya.",
        specs: {
            "Kapasitas": "184 Liter",
            "Daya": "84 Watt",
            "Dimensi": "535 x 550 x 1205 mm",
            "Fitur": "Direct Cooling, Tempered Glass Tray, Fresh Room, Semi Auto Defrost"
    },
        highlights: ["Desain Aurora Series yang cantik","Tempered Glass Tray kuat & mewah","Hemat energi & Low Voltage"],
        sellingPoints: ["Cocok untuk kado atau mempercantik dapur","Bisa beroperasi meski tegangan listrik turun","Area pendingin sayur sangat luas"],
        objections: ["\"Boros listrik?\" -> Sangat hemat, hanya sekitar 84W.","\"Bunga es banyak?\" -> Ada fitur Semi-Auto Defrost tinggal pencet tombol."]
    },
    {
        id: "p73",
        name: "KULKAS AQUA AQR-D185 (MME)",
        category: "KULKAS",
        price: 1800000,
        image: "",
        shortDesc: "Kulkas 1 Pintu dengan Giant Freezer dan Tempered Glass Tray.",
        description: "Aqua AQR-D185 adalah kulkas 1 pintu yang dirancang untuk efisiensi energi dan kemudahan penggunaan. Dilengkapi dengan Giant Freezer berkapasitas 23L dan rak kaca tempered yang mampu menahan beban berat.",
        specs: {
            "Kapasitas": "145 Liter",
            "Daya": "67 Watt",
            "Dimensi": "525 x 524 x 1060 mm",
            "Sistem Pendingin": "Direct Cooling",
            "Fitur": "Semi-Auto Defrost, R600a Ramah Lingkungan"
    },
        highlights: ["Giant Freezer 23L","Tempered Glass Tray tahan 100kg","Konsumsi daya rendah 67W"],
        sellingPoints: ["Hemat listrik bulanan","Garansi kompresor 7 tahun","Desain elegan Aurora Series"],
        objections: ["\"Gampang retak raknya?\" -> Tidak, sudah tempered glass tahan 100kg.","\"Berisik?\" -> Sangat senyap, cocok untuk kamar atau ruang tamu."]
    },
    {
        id: "p74",
        name: "KULKAS AQUA AQR-D185 (MPE)",
        category: "KULKAS",
        price: 1850000,
        image: "",
        shortDesc: "Kulkas 1 Pintu dengan Giant Freezer dan Tempered Glass Tray.",
        description: "Aqua AQR-D185 adalah kulkas 1 pintu yang dirancang untuk efisiensi energi dan kemudahan penggunaan. Dilengkapi dengan Giant Freezer berkapasitas 23L dan rak kaca tempered yang mampu menahan beban berat.",
        specs: {
            "Kapasitas": "145 Liter",
            "Daya": "67 Watt",
            "Dimensi": "525 x 524 x 1060 mm",
            "Sistem Pendingin": "Direct Cooling",
            "Fitur": "Semi-Auto Defrost, R600a Ramah Lingkungan"
    },
        highlights: ["Giant Freezer 23L","Tempered Glass Tray tahan 100kg","Konsumsi daya rendah 67W"],
        sellingPoints: ["Hemat listrik bulanan","Garansi kompresor 7 tahun","Desain elegan Aurora Series"],
        objections: ["\"Gampang retak raknya?\" -> Tidak, sudah tempered glass tahan 100kg.","\"Berisik?\" -> Sangat senyap, cocok untuk kamar atau ruang tamu."]
    },
    {
        id: "p75",
        name: "KULKAS CHANGHONG CBC-100",
        category: "KULKAS",
        price: 1600000,
        image: "",
        shortDesc: "KULKAS KULKAS CHANGHONG CBC-100 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS CHANGHONG CBC-100 adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS CHANGHONG CBC-100",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p76",
        name: "KULKAS GEA MINI BAR INOX GMB-50",
        category: "KULKAS",
        price: 1299000,
        image: "",
        shortDesc: "KULKAS KULKAS GEA MINI BAR INOX GMB-50 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS GEA MINI BAR INOX GMB-50 adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS GEA MINI BAR INOX GMB-50",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p77",
        name: "KULKAS HISENSE 2 PINTU RT218N4IBN",
        category: "KULKAS",
        price: 2900000,
        image: "",
        shortDesc: "KULKAS KULKAS HISENSE 2 PINTU RT218N4IBN berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS HISENSE 2 PINTU RT218N4IBN adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS HISENSE 2 PINTU RT218N4IBN",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p78",
        name: "KULKAS HISENSE RR125D4IBN",
        category: "KULKAS",
        price: 1550000,
        image: "",
        shortDesc: "KULKAS KULKAS HISENSE RR125D4IBN berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS HISENSE RR125D4IBN adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS HISENSE RR125D4IBN",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p79",
        name: "KULKAS HISENSE RR198D4IBN",
        category: "KULKAS",
        price: 1900000,
        image: "",
        shortDesc: "KULKAS KULKAS HISENSE RR198D4IBN berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS HISENSE RR198D4IBN adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS HISENSE RR198D4IBN",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p80",
        name: "KULKAS HISENSE RT469N4IWU",
        category: "KULKAS",
        price: 5500000,
        image: "",
        shortDesc: "KULKAS KULKAS HISENSE RT469N4IWU berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS HISENSE RT469N4IWU adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS HISENSE RT469N4IWU",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p81",
        name: "KULKAS LG GN-Y201CLAR",
        category: "KULKAS",
        price: 2350000,
        image: "",
        shortDesc: "KULKAS KULKAS LG GN-Y201CLAR berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS LG GN-Y201CLAR adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS LG GN-Y201CLAR",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p82",
        name: "KULKAS LG GN-B202SQIR",
        category: "KULKAS",
        price: 3500000,
        image: "",
        shortDesc: "KULKAS KULKAS LG GN-B202SQIR berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS LG GN-B202SQIR adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS LG GN-B202SQIR",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p83",
        name: "KULKAS MINI BAR HISENSE RR68D4IGN 43L SILVER",
        category: "KULKAS",
        price: 1250000,
        image: "",
        shortDesc: "KULKAS KULKAS MINI BAR HISENSE RR68D4IGN 43L SILVER berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS MINI BAR HISENSE RR68D4IGN 43L SILVER adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS MINI BAR HISENSE RR68D4IGN 43L SILVER",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p84",
        name: "KULKAS SHARP SJ-197ND-VB",
        category: "KULKAS",
        price: 2900000,
        image: "",
        shortDesc: "KULKAS KULKAS SHARP SJ-197ND-VB berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS SHARP SJ-197ND-VB adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS SHARP SJ-197ND-VB",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p85",
        name: "KULKAS SHARP SJ-237MG-DP",
        category: "KULKAS",
        price: 3150000,
        image: "",
        shortDesc: "KULKAS KULKAS SHARP SJ-237MG-DP berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS SHARP SJ-237MG-DP adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS SHARP SJ-237MG-DP",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p86",
        name: "KULKAS SHARP SJ-N162D-SH/SB/SP",
        category: "KULKAS",
        price: 1850000,
        image: "",
        shortDesc: "KULKAS KULKAS SHARP SJ-N162D-SH/SB/SP berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS SHARP SJ-N162D-SH/SB/SP adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS SHARP SJ-N162D-SH/SB/SP",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p87",
        name: "KULKAS SHARP SJ-N192D AB/AP",
        category: "KULKAS",
        price: 2150000,
        image: "",
        shortDesc: "Kulkas 1 Pintu Sharp Aurora Series yang Cantik dan Tangguh.",
        description: "Sharp SJ-N192D hadir dengan desain pola bunga Aurora yang menawan. Memiliki kapasitas luas dan tray kaca tempered yang kuat. Sangat efisien dalam penggunaan daya.",
        specs: {
            "Kapasitas": "184 Liter",
            "Daya": "84 Watt",
            "Dimensi": "535 x 550 x 1205 mm",
            "Fitur": "Direct Cooling, Tempered Glass Tray, Fresh Room, Semi Auto Defrost"
    },
        highlights: ["Desain Aurora Series yang cantik","Tempered Glass Tray kuat & mewah","Hemat energi & Low Voltage"],
        sellingPoints: ["Cocok untuk kado atau mempercantik dapur","Bisa beroperasi meski tegangan listrik turun","Area pendingin sayur sangat luas"],
        objections: ["\"Boros listrik?\" -> Sangat hemat, hanya sekitar 84W.","\"Bunga es banyak?\" -> Ada fitur Semi-Auto Defrost tinggal pencet tombol."]
    },
    {
        id: "p88",
        name: "KULKAS SHARP SJ-X165MG",
        category: "KULKAS",
        price: 1850000,
        image: "",
        shortDesc: "KULKAS KULKAS SHARP SJ-X165MG berkualitas tinggi untuk kebutuhan Anda.",
        description: "KULKAS SHARP SJ-X165MG adalah produk pilihan di kategori KULKAS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KULKAS SHARP SJ-X165MG",
            "Kategori": "KULKAS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Menjaga kesegaran lebih lama","Rak tempered glass kuat","Hemat energi"],
        sellingPoints: ["Bunga es minim","Ruang penyimpanan luas","Desain eksterior mewah"],
        objections: ["\"Boros?\" -> Teknologi baru lebih hemat 30%.","\"Bau?\" -> Dilengkapi filter penyaring bau (Deodorizer)."]
    },
    {
        id: "p89",
        name: "KURSI TERAS AF 001",
        category: "KURSI",
        price: 1150000,
        image: "",
        shortDesc: "KURSI KURSI TERAS AF 001 berkualitas tinggi untuk kebutuhan Anda.",
        description: "KURSI TERAS AF 001 adalah produk pilihan di kategori KURSI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "KURSI TERAS AF 001",
            "Kategori": "KURSI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p90",
        name: "LAMPU SEIN SAIGE M35 BELAKANG",
        category: "SPAREPART SELIS",
        price: 60000,
        image: "",
        shortDesc: "SPAREPART SELIS LAMPU SEIN SAIGE M35 BELAKANG berkualitas tinggi untuk kebutuhan Anda.",
        description: "LAMPU SEIN SAIGE M35 BELAKANG adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "LAMPU SEIN SAIGE M35 BELAKANG",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p91",
        name: "LAMPU SEIN SAIGE M35 DEPAN",
        category: "SPAREPART SELIS",
        price: 60000,
        image: "",
        shortDesc: "SPAREPART SELIS LAMPU SEIN SAIGE M35 DEPAN berkualitas tinggi untuk kebutuhan Anda.",
        description: "LAMPU SEIN SAIGE M35 DEPAN adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "LAMPU SEIN SAIGE M35 DEPAN",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p92",
        name: "LEM DUCT TAPE LEM ADHESIVE DU",
        category: "AC",
        price: 15000,
        image: "",
        shortDesc: "AC LEM DUCT TAPE LEM ADHESIVE DU berkualitas tinggi untuk kebutuhan Anda.",
        description: "LEM DUCT TAPE LEM ADHESIVE DU adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "LEM DUCT TAPE LEM ADHESIVE DU",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p93",
        name: "LEM DUCT TAPE NON ADHESIVE DU",
        category: "AC",
        price: 10000,
        image: "",
        shortDesc: "AC LEM DUCT TAPE NON ADHESIVE DU berkualitas tinggi untuk kebutuhan Anda.",
        description: "LEM DUCT TAPE NON ADHESIVE DU adalah produk pilihan di kategori AC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "LEM DUCT TAPE NON ADHESIVE DU",
            "Kategori": "AC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Pendinginan cepat & merata","Hemat listrik (Low Watt)","Operasi senyap"],
        sellingPoints: ["Garansi kompresor panjang","Tahan karat (Anti-Corrosion)","Layanan servis cepat"],
        objections: ["\"Listrik jeglek?\" -> Tidak, ini tipe Low Watt.","\"Pasang mahal?\" -> Paket kami sudah termasuk pipa & pasang standar."]
    },
    {
        id: "p94",
        name: "LEMARI ARSIP KABINET IMPORTA SC-04MS",
        category: "LEMARI",
        price: 1850000,
        image: "",
        shortDesc: "LEMARI LEMARI ARSIP KABINET IMPORTA SC-04MS berkualitas tinggi untuk kebutuhan Anda.",
        description: "LEMARI ARSIP KABINET IMPORTA SC-04MS adalah produk pilihan di kategori LEMARI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "LEMARI ARSIP KABINET IMPORTA SC-04MS",
            "Kategori": "LEMARI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p95",
        name: "LEMARI BESI ANAK 2P IMPORTA LCS-S02 B56 FM 90 CM",
        category: "LEMARI",
        price: 1900000,
        image: "",
        shortDesc: "LEMARI LEMARI BESI ANAK 2P IMPORTA LCS-S02 B56 FM 90 CM berkualitas tinggi untuk kebutuhan Anda.",
        description: "LEMARI BESI ANAK 2P IMPORTA LCS-S02 B56 FM 90 CM adalah produk pilihan di kategori LEMARI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "LEMARI BESI ANAK 2P IMPORTA LCS-S02 B56 FM 90 CM",
            "Kategori": "LEMARI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p96",
        name: "MAGICOM COSMOS CRJ-3307",
        category: "MAGICOM",
        price: 290000,
        image: "",
        shortDesc: "Rice Cooker Cosmos 1.8L dengan 3D Heating System.",
        description: "Memasak nasi lebih pulen dan matang merata dengan Cosmos CRJ-3307. Teknologi pemanasan 3D menjamin nasi tidak cepat basi dan tetap hangat lebih lama.",
        specs: {
            "Kapasitas": "1.8 Liter",
            "Daya": "400 Watt (Memasak)",
            "Fungsi": "3-in-1 (Masak, Kukus, Hangatkan)",
            "Panci": "Anti Lengket (Non-Stick Coating)"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p97",
        name: "MEGAN COFFEE TABLE BLACK SET",
        category: "MEJA",
        price: 999000,
        image: "",
        shortDesc: "MEJA MEGAN COFFEE TABLE BLACK SET berkualitas tinggi untuk kebutuhan Anda.",
        description: "MEGAN COFFEE TABLE BLACK SET adalah produk pilihan di kategori MEJA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MEGAN COFFEE TABLE BLACK SET",
            "Kategori": "MEJA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p98",
        name: "MEJA MAKAN BULAT MIAMI 4P",
        category: "MEJA",
        price: 2499000,
        image: "",
        shortDesc: "MEJA MEJA MAKAN BULAT MIAMI 4P berkualitas tinggi untuk kebutuhan Anda.",
        description: "MEJA MAKAN BULAT MIAMI 4P adalah produk pilihan di kategori MEJA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MEJA MAKAN BULAT MIAMI 4P",
            "Kategori": "MEJA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p99",
        name: "MEJA TAMU 306 B",
        category: "MEJA",
        price: 600000,
        image: "",
        shortDesc: "MEJA MEJA TAMU 306 B berkualitas tinggi untuk kebutuhan Anda.",
        description: "MEJA TAMU 306 B adalah produk pilihan di kategori MEJA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MEJA TAMU 306 B",
            "Kategori": "MEJA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p100",
        name: "MESIN CUCI AQUA QW-8031 HT",
        category: "SEPEDA LISTRIK",
        price: 1600000,
        image: "",
        shortDesc: "SEPEDA LISTRIK MESIN CUCI AQUA QW-8031 HT berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI AQUA QW-8031 HT adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI AQUA QW-8031 HT",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p101",
        name: "MESIN CUCI AQUA QW-9031HT",
        category: "MESIN CUCI",
        price: 1800000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI AQUA QW-9031HT berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI AQUA QW-9031HT adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI AQUA QW-9031HT",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p102",
        name: "MESIN CUCI HISENSE WS80SK10",
        category: "MESIN CUCI",
        price: 1500000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI HISENSE WS80SK10 berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI HISENSE WS80SK10 adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI HISENSE WS80SK10",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p103",
        name: "MESIN CUCI HISENSE WS90SK10",
        category: "MESIN CUCI",
        price: 1700000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI HISENSE WS90SK10 berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI HISENSE WS90SK10 adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI HISENSE WS90SK10",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p104",
        name: "MESIN CUCI HISENSE WSHS1013UB",
        category: "MESIN CUCI",
        price: 1950000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI HISENSE WSHS1013UB berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI HISENSE WSHS1013UB adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI HISENSE WSHS1013UB",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p105",
        name: "MESIN CUCI HISENSE WSHS1213UB",
        category: "MESIN CUCI",
        price: 2250000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI HISENSE WSHS1213UB berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI HISENSE WSHS1213UB adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI HISENSE WSHS1213UB",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p106",
        name: "MESIN CUCI LG P1000RT",
        category: "MESIN CUCI",
        price: 2900000,
        image: "",
        shortDesc: "Mesin Cuci 2 Tabung Kapasitas Besar 10kg.",
        description: "LG P1000RT dirancang untuk keluarga besar dengan kapasitas cuci 10kg. Menggunakan teknologi Roller Jet Pulsator untuk menjamin kebersihan pakaian tanpa merusak serat kain.",
        specs: {
            "Kapasitas": "10 kg",
            "Daya Cuci": "400 Watt",
            "Dimensi": "880 x 530 x 1025 mm",
            "Tipe": "Twin Tub",
            "Fitur": "Roller Jet Pulsator, Punch+3, Wind Jet Dry"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p107",
        name: "MESIN CUCI LG P-1200RT",
        category: "MESIN CUCI",
        price: 3250000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI LG P-1200RT berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI LG P-1200RT adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI LG P-1200RT",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p108",
        name: "MESIN CUCI LG P7000N",
        category: "MESIN CUCI",
        price: 2500000,
        image: "",
        shortDesc: "Mesin Cuci 2 Tabung 7kg dengan Roller Jet Pulsator.",
        description: "LG P7000N menawarkan performa pencucian yang kuat namun lembut pada pakaian berkat Roller Jet Pulsator. Dilengkapi dengan Wind Jet Dry untuk pengeringan yang lebih cepat.",
        specs: {
            "Kapasitas": "7.0 kg",
            "Daya Cuci": "320 Watt",
            "Dimensi": "805 x 475 x 975 mm",
            "Tipe": "Twin Tub",
            "Fitur": "Roller Jet Pulsator, Wind Jet Dry, 3 Wash Program"
    },
        highlights: ["Roller Jet Pulsator untuk hasil bersih maksimal","Wind Jet Dry mempercepat pengeringan","Body anti karat"],
        sellingPoints: ["Sangat awet, investasi jangka panjang","Hasil cucian lebih kering dibanding kompetitor","Mudah dioperasikan"],
        objections: ["\"Ribet manual?\" -> Malah lebih awet karena mekanik sederhana.","\"Rusak?\" -> Garansi resmi LG terjamin di seluruh Indonesia."]
    },
    {
        id: "p109",
        name: "MESIN CUCI LG P8000N",
        category: "MESIN CUCI",
        price: 2700000,
        image: "",
        shortDesc: "Mesin Cuci 2 Tabung 8kg dengan Roller Jet Pulsator.",
        description: "LG P8000N memberikan efisiensi pencucian tinggi dengan teknologi Roller Jet Pulsator. Pakaian lebih bersih dan kering lebih cepat berkat fitur Wind Jet Dry.",
        specs: {
            "Kapasitas": "8 kg",
            "Daya Cuci": "320 Watt",
            "Daya Peras": "250 Watt",
            "Dimensi": "805 x 478 x 975 mm",
            "Fitur": "Roller Jet Pulsator, Punch+3, Wind Jet Dry, Anti Rat Cover"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p110",
        name: "MESIN CUCI LG P9050RTB",
        category: "MESIN CUCI",
        price: 2800000,
        image: "",
        shortDesc: "Mesin Cuci 2 Tabung 9kg, Kuat dan Tahan Lama.",
        description: "LG P9050RTB dirancang untuk menangani beban cucian besar hingga 9kg. Dilengkapi dengan teknologi anti tikus dan pulsator yang kuat untuk hasil cuci maksimal.",
        specs: {
            "Kapasitas": "9 kg",
            "Daya": "320 Watt (Cuci)",
            "Dimensi": "805 x 475 x 975 mm",
            "Fitur": "Roller Jet Pulsator, Punch+3, Wind Jet Dry, Anti Rat Base"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p111",
        name: "MESIN CUCI POLYTRON PWM-1076",
        category: "MESIN CUCI",
        price: 2150000,
        image: "",
        shortDesc: "Mesin Cuci Polytron 10kg dengan Hijab Mode.",
        description: "Polytron PWM-1076 hadir dengan fitur khusus Hijab Mode untuk menjaga serat kain halus. Kapasitas 10kg sangat cocok untuk keluarga besar. Hemat energi dengan teknologi Magic Gear.",
        specs: {
            "Kapasitas": "10 kg",
            "Daya Cuci": "250 Watt",
            "Daya Peras": "130 Watt",
            "Fitur": "Hijab Mode, Magic Gear, Big Pulsator, Water Selector"
    },
        highlights: ["Fitur khusus Hijab Mode","Teknologi Magic Gear hemat listrik 30%","Kapasitas ekstra besar 10kg"],
        sellingPoints: ["Aman untuk kain halus/hijab","Motor kuat & bergaransi","Anti karat & tahan lama"],
        objections: ["\"Boros listrik?\" -> Sangat hemat, sudah pakai Magic Gear.","\"Susah bersihkan filter?\" -> Filter dirancang mudah dilepas-pasang."]
    },
    {
        id: "p112",
        name: "MESIN CUCI POLYTRON PWM-7073-P",
        category: "MESIN CUCI",
        price: 1600000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI POLYTRON PWM-7073-P berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI POLYTRON PWM-7073-P adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI POLYTRON PWM-7073-P",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p113",
        name: "MESIN CUCI POLYTRON PWM-8072",
        category: "MESIN CUCI",
        price: 1700000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI POLYTRON PWM-8072 berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI POLYTRON PWM-8072 adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI POLYTRON PWM-8072",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p114",
        name: "MESIN CUCI POLYTRON PWM-9076",
        category: "MC",
        price: 1900000,
        image: "",
        shortDesc: "MC MESIN CUCI POLYTRON PWM-9076 berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI POLYTRON PWM-9076 adalah produk pilihan di kategori MC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI POLYTRON PWM-9076",
            "Kategori": "MC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p115",
        name: "MESIN CUCI RSA 10Kg WM-TT100",
        category: "MESIN CUCI",
        price: 1700000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI RSA 10Kg WM-TT100 berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI RSA 10Kg WM-TT100 adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI RSA 10Kg WM-TT100",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p116",
        name: "MESIN CUCI RSA 7kg WM-TT70",
        category: "MESIN CUCI",
        price: 1300000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI RSA 7kg WM-TT70 berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI RSA 7kg WM-TT70 adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI RSA 7kg WM-TT70",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p117",
        name: "MESIN CUCI RSA 8Kg WM-TT80",
        category: "MESIN CUCI",
        price: 1400000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI RSA 8Kg WM-TT80 berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI RSA 8Kg WM-TT80 adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI RSA 8Kg WM-TT80",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p118",
        name: "MESIN CUCI SHARP ES-T1090-VK/PK",
        category: "MESIN CUCI",
        price: 2499000,
        image: "",
        shortDesc: "MESIN CUCI MESIN CUCI SHARP ES-T1090-VK/PK berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI SHARP ES-T1090-VK/PK adalah produk pilihan di kategori MESIN CUCI yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI SHARP ES-T1090-VK/PK",
            "Kategori": "MESIN CUCI",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bersih maksimal, lembut di kain","Hemat air & deterjen","Body anti karat & tikus"],
        sellingPoints: ["Pengoperasian sangat mudah","Motor tangguh & awet","Pakaian lebih cepat kering"],
        objections: ["\"Baju rusak?\" -> Pulsator didesain khusus agar tidak melilit.","\"Berisik?\" -> Sangat stabil bahkan saat memeras (spin)."]
    },
    {
        id: "p119",
        name: "MESIN CUCI SHARP ES-T1290WA",
        category: "MC",
        price: 3050000,
        image: "",
        shortDesc: "MC MESIN CUCI SHARP ES-T1290WA berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI SHARP ES-T1290WA adalah produk pilihan di kategori MC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI SHARP ES-T1290WA",
            "Kategori": "MC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p120",
        name: "MESIN CUCI SHARP ES-T70MW-BL",
        category: "MC",
        price: 1500000,
        image: "",
        shortDesc: "Mesin Cuci Sharp 6.5kg Low Watt.",
        description: "Sharp ES-T70MW adalah mesin cuci 2 tabung yang sangat hemat listrik. Menggunakan teknologi Super Soakmagic untuk hasil rendaman yang lebih bersih.",
        specs: {
            "Kapasitas": "6.5 kg",
            "Daya Cuci": "199 Watt",
            "Fitur": "Super Soakmagic, Silvermagic Protection, Planet Gear"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p121",
        name: "MESIN CUCI SHARP ES-T80MW",
        category: "MC",
        price: 1650000,
        image: "",
        shortDesc: "MC MESIN CUCI SHARP ES-T80MW berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI SHARP ES-T80MW adalah produk pilihan di kategori MC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI SHARP ES-T80MW",
            "Kategori": "MC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p122",
        name: "MESIN CUCI SHARP ES-T90MW",
        category: "MC",
        price: 1975000,
        image: "",
        shortDesc: "MC MESIN CUCI SHARP ES-T90MW berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI SHARP ES-T90MW adalah produk pilihan di kategori MC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI SHARP ES-T90MW",
            "Kategori": "MC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p123",
        name: "MESIN CUCI SHARP ES-T90MW-PK",
        category: "MC",
        price: 1975000,
        image: "",
        shortDesc: "MC MESIN CUCI SHARP ES-T90MW-PK berkualitas tinggi untuk kebutuhan Anda.",
        description: "MESIN CUCI SHARP ES-T90MW-PK adalah produk pilihan di kategori MC yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "MESIN CUCI SHARP ES-T90MW-PK",
            "Kategori": "MC",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p124",
        name: "REM KANAN SAIGE LUNA",
        category: "SPAREPART SELIS",
        price: 220000,
        image: "",
        shortDesc: "Sepeda Listrik Saige Luna Premium.",
        description: "Saige Luna adalah kasta tertinggi dari sepeda listrik Saige. Desain sangat elegan layaknya motor matic dengan fitur serba digital.",
        specs: {
            "Motor": "800 Watt",
            "Baterai": "48V / 20Ah",
            "Jarak": "60 km",
            "Fitur": "NFC Lock, Digital Panel, Hydraulic Brake"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p125",
        name: "RSA SHOWCASE RUBY 200",
        category: "SHOWCASE",
        price: 3300000,
        image: "",
        shortDesc: "SHOWCASE RSA SHOWCASE RUBY 200 berkualitas tinggi untuk kebutuhan Anda.",
        description: "RSA SHOWCASE RUBY 200 adalah produk pilihan di kategori SHOWCASE yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "RSA SHOWCASE RUBY 200",
            "Kategori": "SHOWCASE",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p126",
        name: "SADLE DEPAN SAIGE EGO PLUS",
        category: "SPAREPART SELIS",
        price: 65000,
        image: "",
        shortDesc: "SPAREPART SELIS SADLE DEPAN SAIGE EGO PLUS berkualitas tinggi untuk kebutuhan Anda.",
        description: "SADLE DEPAN SAIGE EGO PLUS adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SADLE DEPAN SAIGE EGO PLUS",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p127",
        name: "SAMSUNG GALAXY A17 5G 8/256 BLACK",
        category: "HANDPHONE",
        price: 3699000,
        image: "",
        shortDesc: "Samsung Galaxy A17, Smartphone 5G Terjangkau.",
        description: "Samsung Galaxy A17 hadir dengan layar luas dan baterai besar yang tahan lama. Pilihan terbaik untuk produktivitas harian dan media sosial.",
        specs: {
            "RAM/Storage": "8/256 GB",
            "Fitur": "Layar Besar, Baterai 5000mAh, Desain Modern"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p128",
        name: "SAMSUNG GALAXY A17 LTE 8/256 GB BLACK",
        category: "HP",
        price: 3399000,
        image: "",
        shortDesc: "Samsung Galaxy A17, Smartphone 5G Terjangkau.",
        description: "Samsung Galaxy A17 hadir dengan layar luas dan baterai besar yang tahan lama. Pilihan terbaik untuk produktivitas harian dan media sosial.",
        specs: {
            "RAM/Storage": "8/256 GB",
            "Fitur": "Layar Besar, Baterai 5000mAh, Desain Modern"
    },
        highlights: ["Kamera jernih & tajam","Performa kencang anti lag","Baterai awet seharian"],
        sellingPoints: ["Garansi resmi 1 tahun","Bisa trade-in (tukar tambah)","Bonus aksesoris lengkap"],
        objections: ["\"Gampang panas?\" -> Sudah pakai sistem pendingin terbaru.","\"Memori penuh?\" -> Dukungan slot MicroSD hingga 1TB."]
    },
    {
        id: "p129",
        name: "SAMSUNG GALAXY A36 5G 8/256 GB AWESOME BLACK",
        category: "HANDPHONE",
        price: 5200000,
        image: "",
        shortDesc: "Samsung Galaxy A36 5G, Performa Kencang Snapdragon.",
        description: "Galaxy A36 5G menawarkan keseimbangan sempurna antara harga dan performa. Dilengkapi layar Super AMOLED 120Hz dan kamera 50MP OIS yang handal.",
        specs: {
            "Layar": "6.7 inch Super AMOLED 120Hz",
            "Processor": "Snapdragon 6 Gen 3",
            "RAM/Storage": "8/256 GB",
            "Kamera": "50MP OIS + 8MP + 5MP",
            "Baterai": "5000mAh, 45W Fast Charging"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p130",
        name: "SAMSUNG GALAXY A36 5G 8/256 GB AWESOME LAVENDER",
        category: "HANDPHONE",
        price: 5200000,
        image: "",
        shortDesc: "Samsung Galaxy A36 5G, Performa Kencang Snapdragon.",
        description: "Galaxy A36 5G menawarkan keseimbangan sempurna antara harga dan performa. Dilengkapi layar Super AMOLED 120Hz dan kamera 50MP OIS yang handal.",
        specs: {
            "Layar": "6.7 inch Super AMOLED 120Hz",
            "Processor": "Snapdragon 6 Gen 3",
            "RAM/Storage": "8/256 GB",
            "Kamera": "50MP OIS + 8MP + 5MP",
            "Baterai": "5000mAh, 45W Fast Charging"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p131",
        name: "SAMSUNG GALAXY A36 5G 8/256 GB AWESOME WHITE",
        category: "HANDPHONE",
        price: 5700000,
        image: "",
        shortDesc: "Samsung Galaxy A36 5G, Performa Kencang Snapdragon.",
        description: "Galaxy A36 5G menawarkan keseimbangan sempurna antara harga dan performa. Dilengkapi layar Super AMOLED 120Hz dan kamera 50MP OIS yang handal.",
        specs: {
            "Layar": "6.7 inch Super AMOLED 120Hz",
            "Processor": "Snapdragon 6 Gen 3",
            "RAM/Storage": "8/256 GB",
            "Kamera": "50MP OIS + 8MP + 5MP",
            "Baterai": "5000mAh, 45W Fast Charging"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p132",
        name: "SAMSUNG GALAXY A56 5G 8/256 GB AWESOME GRAPHITE",
        category: "HP",
        price: 6200000,
        image: "",
        shortDesc: "Smartphone 5G Premium dengan Layar Super AMOLED 120Hz.",
        description: "Samsung Galaxy A56 5G menghadirkan performa tingkat tinggi dengan chipset Exynos 1580 dan layar Super AMOLED yang sangat cerah. Sempurna untuk gaming dan fotografi mobile.",
        specs: {
            "Layar": "6.7 inch Super AMOLED 120Hz",
            "Processor": "Exynos 1580 (4nm)",
            "RAM/Storage": "8/256 GB",
            "Kamera": "50MP OIS + 12MP + 5MP",
            "Baterai": "5000mAh, 25W Fast Charging",
            "Sertifikasi": "IP67 Tahan Air & Debu"
    },
        highlights: ["Layar 120Hz super halus","Kamera 50MP dengan OIS (Anti Goyang)","Chipset kencang Exynos 1580"],
        sellingPoints: ["Update software hingga 4 tahun","Hasil foto malam hari (Nightography) sangat jernih","Tahan air, aman dibawa hujan-hujanan"],
        objections: ["\"Mahal?\" -> Sesuai kualitas flagship di kelas menengah.","\"Panas?\" -> Sudah pakai sistem pendingin baru untuk Exynos 1580."]
    },
    {
        id: "p133",
        name: "SAMSUNG GALAXY A56 5G 8/256 GB AWESOME OLIVE",
        category: "HANDPHONE",
        price: 6300000,
        image: "",
        shortDesc: "Smartphone 5G Premium dengan Layar Super AMOLED 120Hz.",
        description: "Samsung Galaxy A56 5G menghadirkan performa tingkat tinggi dengan chipset Exynos 1580 dan layar Super AMOLED yang sangat cerah. Sempurna untuk gaming dan fotografi mobile.",
        specs: {
            "Layar": "6.7 inch Super AMOLED 120Hz",
            "Processor": "Exynos 1580 (4nm)",
            "RAM/Storage": "8/256 GB",
            "Kamera": "50MP OIS + 12MP + 5MP",
            "Baterai": "5000mAh, 25W Fast Charging",
            "Sertifikasi": "IP67 Tahan Air & Debu"
    },
        highlights: ["Layar 120Hz super halus","Kamera 50MP dengan OIS (Anti Goyang)","Chipset kencang Exynos 1580"],
        sellingPoints: ["Update software hingga 4 tahun","Hasil foto malam hari (Nightography) sangat jernih","Tahan air, aman dibawa hujan-hujanan"],
        objections: ["\"Mahal?\" -> Sesuai kualitas flagship di kelas menengah.","\"Panas?\" -> Sudah pakai sistem pendingin baru untuk Exynos 1580."]
    },
    {
        id: "p134",
        name: "SAMSUNG SMART TV UA32H5000FKLXD",
        category: "TV",
        price: 2450000,
        image: "",
        shortDesc: "TV SAMSUNG SMART TV UA32H5000FKLXD berkualitas tinggi untuk kebutuhan Anda.",
        description: "SAMSUNG SMART TV UA32H5000FKLXD adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SAMSUNG SMART TV UA32H5000FKLXD",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p135",
        name: "SELIS GROBAK PUJASERA3 FIBER C",
        category: "SEPEDA LISTRIK",
        price: 17000000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SELIS GROBAK PUJASERA3 FIBER C berkualitas tinggi untuk kebutuhan Anda.",
        description: "SELIS GROBAK PUJASERA3 FIBER C adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SELIS GROBAK PUJASERA3 FIBER C",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p136",
        name: "SEPEDA LISTRIK GODA 118 HITAM",
        category: "SEPEDA LISTRIK",
        price: 4000000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK GODA 118 HITAM berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK GODA 118 HITAM adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK GODA 118 HITAM",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p137",
        name: "SEPEDA LISTRIK GODA 118 MERAH",
        category: "SEPEDA LISTRIK",
        price: 4000000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK GODA 118 MERAH berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK GODA 118 MERAH adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK GODA 118 MERAH",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p138",
        name: "SEPEDA LISTRIK GODA 118 PUTIH",
        category: "SEPEDA LISTRIK",
        price: 4000000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK GODA 118 PUTIH berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK GODA 118 PUTIH adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK GODA 118 PUTIH",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p139",
        name: "SEPEDA LISTRIK GODA 122 ABU",
        category: "SEPEDA LISTRIK",
        price: 4500000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK GODA 122 ABU berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK GODA 122 ABU adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK GODA 122 ABU",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p140",
        name: "SEPEDA LISTRIK GODA 150A ABU",
        category: "SEPEDA LISTRIK",
        price: 4500000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK GODA 150A ABU berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK GODA 150A ABU adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK GODA 150A ABU",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p141",
        name: "SEPEDA LISTRIK GODA 199 MAX-C RRQ",
        category: "SEPEDA LISTRIK",
        price: 13200000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK GODA 199 MAX-C RRQ berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK GODA 199 MAX-C RRQ adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK GODA 199 MAX-C RRQ",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p142",
        name: "SEPEDA LISTRIK NUV F1 SPIVA BIRU",
        category: "SEPEDA LISTRIK",
        price: 4200000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK NUV F1 SPIVA BIRU berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK NUV F1 SPIVA BIRU adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK NUV F1 SPIVA BIRU",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p143",
        name: "SEPEDA LISTRIK NUV F1 SPIVA HIJAU",
        category: "SEPEDA LISTRIK",
        price: 4200000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK NUV F1 SPIVA HIJAU berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK NUV F1 SPIVA HIJAU adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK NUV F1 SPIVA HIJAU",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p144",
        name: "SEPEDA LISTRIK NUV F1 SPIVA UNGU",
        category: "SEPEDA LISTRIK",
        price: 4200000,
        image: "",
        shortDesc: "SEPEDA LISTRIK SEPEDA LISTRIK NUV F1 SPIVA UNGU berkualitas tinggi untuk kebutuhan Anda.",
        description: "SEPEDA LISTRIK NUV F1 SPIVA UNGU adalah produk pilihan di kategori SEPEDA LISTRIK yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SEPEDA LISTRIK NUV F1 SPIVA UNGU",
            "Kategori": "SEPEDA LISTRIK",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p145",
        name: "SEPEDA LISTRIK SAIGE LUNA",
        category: "SEPEDA LISTRIK",
        price: 6800000,
        image: "",
        shortDesc: "Sepeda Listrik Saige Luna Premium.",
        description: "Saige Luna adalah kasta tertinggi dari sepeda listrik Saige. Desain sangat elegan layaknya motor matic dengan fitur serba digital.",
        specs: {
            "Motor": "800 Watt",
            "Baterai": "48V / 20Ah",
            "Jarak": "60 km",
            "Fitur": "NFC Lock, Digital Panel, Hydraulic Brake"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p146",
        name: "SEPEDA LISTRIK SELIS RETRO COKLAT",
        category: "SEPEDA LISTRIK",
        price: 19800000,
        image: "",
        shortDesc: "Sepeda Listrik Selis Retro, Gaya Klasik Masa Kini.",
        description: "Tampil beda dengan Selis Retro. Menggabungkan desain klasik yang timeless dengan teknologi motor listrik modern yang senyap dan bertenaga.",
        specs: {
            "Motor": "500 Watt",
            "Baterai": "48V / 20Ah",
            "Jarak": "45 km"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p147",
        name: "SEPEDA LISTRIK SOLOZ G-L18 HIJAU",
        category: "SEPEDA LISTRIK",
        price: 5699000,
        image: "",
        shortDesc: "Sepeda Listrik Soloz G-L18, Praktis dan Modern.",
        description: "Soloz G-L18 menawarkan kemudahan mobilitas dengan desain yang compact namun tetap bertenaga. Sangat hemat biaya operasional.",
        specs: {
            "Motor": "500 Watt",
            "Baterai": "48V / 12Ah",
            "Jarak": "40 km"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p148",
        name: "SEPEDA LISTRIK U-WINFLY D65 PINK",
        category: "SEPEDA LISTRIK",
        price: 4600000,
        image: "",
        shortDesc: "Sepeda Listrik U-Winfly D65, Jarak Tempuh Hingga 50km.",
        description: "U-Winfly D65 adalah sepeda listrik yang nyaman dengan suspensi empuk. Sangat cocok untuk belanja atau mengantar anak sekolah.",
        specs: {
            "Motor": "600 Watt",
            "Baterai": "48V / 12Ah",
            "Jarak": "50 km",
            "Beban": "150 kg"
    },
        highlights: ["Bebas bensin & polusi","Biaya charge sangat murah","Mudah dikendarai"],
        sellingPoints: ["Bisa dicicil tanpa kartu kredit","Servis bisa panggil ke rumah","Baterai awet & tahan lama"],
        objections: ["\"Takut kena hujan?\" -> Komponen sudah waterproof standar IP.","\"Sparepart susah?\" -> Kami sedia lengkap dari baterai sampai ban."]
    },
    {
        id: "p149",
        name: "SETRIKA COSMOS CI-3110CM",
        category: "SETRIKA",
        price: 160000,
        image: "",
        shortDesc: "SETRIKA SETRIKA COSMOS CI-3110CM berkualitas tinggi untuk kebutuhan Anda.",
        description: "SETRIKA COSMOS CI-3110CM adalah produk pilihan di kategori SETRIKA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SETRIKA COSMOS CI-3110CM",
            "Kategori": "SETRIKA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p150",
        name: "SETRIKA COSMOS CIS-318",
        category: "SETRIKA",
        price: 150000,
        image: "",
        shortDesc: "SETRIKA SETRIKA COSMOS CIS-318 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SETRIKA COSMOS CIS-318 adalah produk pilihan di kategori SETRIKA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SETRIKA COSMOS CIS-318",
            "Kategori": "SETRIKA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p151",
        name: "SHARP LED TV 2T-C32GH3000I",
        category: "TV",
        price: 2500000,
        image: "",
        shortDesc: "TV SHARP LED TV 2T-C32GH3000I berkualitas tinggi untuk kebutuhan Anda.",
        description: "SHARP LED TV 2T-C32GH3000I adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SHARP LED TV 2T-C32GH3000I",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p152",
        name: "SHARP LED TV 2T-C32GH3000I",
        category: "TV",
        price: 2500000,
        image: "",
        shortDesc: "TV SHARP LED TV 2T-C32GH3000I berkualitas tinggi untuk kebutuhan Anda.",
        description: "SHARP LED TV 2T-C32GH3000I adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SHARP LED TV 2T-C32GH3000I",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p153",
        name: "SHOWCASE RSA AGATE-200",
        category: "SHOWCASE",
        price: 3200000,
        image: "",
        shortDesc: "SHOWCASE SHOWCASE RSA AGATE-200 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SHOWCASE RSA AGATE-200 adalah produk pilihan di kategori SHOWCASE yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SHOWCASE RSA AGATE-200",
            "Kategori": "SHOWCASE",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p154",
        name: "SHOWCASE RSA AGATE-240R",
        category: "SHOWCASE",
        price: 3500000,
        image: "",
        shortDesc: "SHOWCASE SHOWCASE RSA AGATE-240R berkualitas tinggi untuk kebutuhan Anda.",
        description: "SHOWCASE RSA AGATE-240R adalah produk pilihan di kategori SHOWCASE yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SHOWCASE RSA AGATE-240R",
            "Kategori": "SHOWCASE",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p155",
        name: "SHOWCASE RSA AGATE-300R",
        category: "SHOWCASE",
        price: 3999000,
        image: "",
        shortDesc: "SHOWCASE SHOWCASE RSA AGATE-300R berkualitas tinggi untuk kebutuhan Anda.",
        description: "SHOWCASE RSA AGATE-300R adalah produk pilihan di kategori SHOWCASE yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SHOWCASE RSA AGATE-300R",
            "Kategori": "SHOWCASE",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p156",
        name: "SHOWCASE RSA RUBY240",
        category: "SHOWCASE",
        price: 3600000,
        image: "",
        shortDesc: "SHOWCASE SHOWCASE RSA RUBY240 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SHOWCASE RSA RUBY240 adalah produk pilihan di kategori SHOWCASE yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SHOWCASE RSA RUBY240",
            "Kategori": "SHOWCASE",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p157",
        name: "SOFA MINIMALIS 221 + MEJA COKLAT CORAK",
        category: "SOPA",
        price: 3000000,
        image: "",
        shortDesc: "SOPA SOFA MINIMALIS 221 + MEJA COKLAT CORAK berkualitas tinggi untuk kebutuhan Anda.",
        description: "SOFA MINIMALIS 221 + MEJA COKLAT CORAK adalah produk pilihan di kategori SOPA yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SOFA MINIMALIS 221 + MEJA COKLAT CORAK",
            "Kategori": "SOPA",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p158",
        name: "SOUNDBAR JBL CINEMA 550",
        category: "SPEAKER",
        price: 3150000,
        image: "",
        shortDesc: "SPEAKER SOUNDBAR JBL CINEMA 550 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SOUNDBAR JBL CINEMA 550 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SOUNDBAR JBL CINEMA 550",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p159",
        name: "SPEAKER AKTIV SHARP CBOX-D1280CB",
        category: "SPEAKER",
        price: 2400000,
        image: "",
        shortDesc: "SPEAKER SPEAKER AKTIV SHARP CBOX-D1280CB berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER AKTIV SHARP CBOX-D1280CB adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER AKTIV SHARP CBOX-D1280CB",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p160",
        name: "SPEAKER HARDWELL 12 PRO",
        category: "SPEAKER",
        price: 3999000,
        image: "",
        shortDesc: "SPEAKER SPEAKER HARDWELL 12 PRO berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER HARDWELL 12 PRO adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER HARDWELL 12 PRO",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p161",
        name: "SPEAKER NIKO MEGABOX 12",
        category: "SPEAKER",
        price: 3450000,
        image: "",
        shortDesc: "SPEAKER SPEAKER NIKO MEGABOX 12 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER NIKO MEGABOX 12 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER NIKO MEGABOX 12",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p162",
        name: "SPEAKER NIKO OXXO 8",
        category: "SPEAKER",
        price: 1550000,
        image: "",
        shortDesc: "SPEAKER SPEAKER NIKO OXXO 8 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER NIKO OXXO 8 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER NIKO OXXO 8",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p163",
        name: "SPEAKER NIKO PT-1202",
        category: "SPEAKER",
        price: 1250000,
        image: "",
        shortDesc: "SPEAKER SPEAKER NIKO PT-1202 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER NIKO PT-1202 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER NIKO PT-1202",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p164",
        name: "SPEAKER NIKO WT10B",
        category: "SPEAKER",
        price: 1250000,
        image: "",
        shortDesc: "SPEAKER SPEAKER NIKO WT10B berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER NIKO WT10B adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER NIKO WT10B",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p165",
        name: "SPEAKER NIKO WT6A",
        category: "SPEAKER",
        price: 1099000,
        image: "",
        shortDesc: "SPEAKER SPEAKER NIKO WT6A berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER NIKO WT6A adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER NIKO WT6A",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p166",
        name: "SPEAKER NIKO WTD-10A",
        category: "SPEAKER",
        price: 1599000,
        image: "",
        shortDesc: "SPEAKER SPEAKER NIKO WTD-10A berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER NIKO WTD-10A adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER NIKO WTD-10A",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p167",
        name: "SPEAKER POLYTRON PAS-10DF22",
        category: "SPEAKER",
        price: 3100000,
        image: "",
        shortDesc: "Speaker Aktif Polytron Double 10 inci, Bass Menggelegar.",
        description: "Nikmati kualitas suara premium dengan Polytron PAS-10DF22. Dilengkapi Double Woofer 10 inci dan fitur karaoke lengkap untuk hiburan keluarga Anda.",
        specs: {
            "Power": "200 Watt RMS",
            "Woofer": "Double 10 inch",
            "Koneksi": "Bluetooth, USB, SD Card, Aux, Line In",
            "Fitur": "Super Bass, 3-Way System, 2 Mic Input, Polytron Audio Connect"
    },
        highlights: ["Double Woofer 10 inch untuk bass kuat","Fitur Karaoke dengan 2 Mic Input","Koneksi Bluetooth canggih"],
        sellingPoints: ["Suara paling mantap di kelasnya","Bisa kontrol lewat smartphone","Desain elegan dengan LED display"],
        objections: ["\"Terlalu besar?\" -> Suara sebanding dengan ukurannya yang kokoh.","\"Suara pecah?\" -> Tidak, sudah pakai teknologi 3-Way System."]
    },
    {
        id: "p168",
        name: "SPEAKER POLYTRON PAS-PR012F3",
        category: "SPEAKER",
        price: 3000000,
        image: "",
        shortDesc: "SPEAKER SPEAKER POLYTRON PAS-PR012F3 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER POLYTRON PAS-PR012F3 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER POLYTRON PAS-PR012F3",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p169",
        name: "SPEAKER POLYTRON PAS-PRO15F3",
        category: "SPEAKER",
        price: 3300000,
        image: "",
        shortDesc: "SPEAKER SPEAKER POLYTRON PAS-PRO15F3 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER POLYTRON PAS-PRO15F3 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER POLYTRON PAS-PRO15F3",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p170",
        name: "SPEAKER WIRELESS HUPPER JL 10",
        category: "SPEAKER",
        price: 3600000,
        image: "",
        shortDesc: "SPEAKER SPEAKER WIRELESS HUPPER JL 10 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER WIRELESS HUPPER JL 10 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER WIRELESS HUPPER JL 10",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p171",
        name: "SPEAKER WIRELESS HUPPER JL 15",
        category: "SPEAKER",
        price: 5500000,
        image: "",
        shortDesc: "SPEAKER SPEAKER WIRELESS HUPPER JL 15 berkualitas tinggi untuk kebutuhan Anda.",
        description: "SPEAKER WIRELESS HUPPER JL 15 adalah produk pilihan di kategori SPEAKER yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "SPEAKER WIRELESS HUPPER JL 15",
            "Kategori": "SPEAKER",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p172",
        name: "STOP KONTAK SAIGE",
        category: "SPAREPART SELIS",
        price: 20000,
        image: "",
        shortDesc: "SPAREPART SELIS STOP KONTAK SAIGE berkualitas tinggi untuk kebutuhan Anda.",
        description: "STOP KONTAK SAIGE adalah produk pilihan di kategori SPAREPART SELIS yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "STOP KONTAK SAIGE",
            "Kategori": "SPAREPART SELIS",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Kualitas Terjamin","Garansi Resmi","Layanan Aftersales"],
        sellingPoints: ["Harga Bersaing","Bisa Cicilan","Barang Ready"],
        objections: ["\"Bisa kurang?\" -> Harga sudah terbaik dengan layanan prima.","\"Garansi?\" -> Resmi pabrikan."]
    },
    {
        id: "p173",
        name: "TV HISENSE 32E4H",
        category: "TV",
        price: 1900000,
        image: "",
        shortDesc: "TV TV HISENSE 32E4H berkualitas tinggi untuk kebutuhan Anda.",
        description: "TV HISENSE 32E4H adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "TV HISENSE 32E4H",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p174",
        name: "TV HISENSE 65A6Q",
        category: "TV",
        price: 7800000,
        image: "",
        shortDesc: "TV TV HISENSE 65A6Q berkualitas tinggi untuk kebutuhan Anda.",
        description: "TV HISENSE 65A6Q adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "TV HISENSE 65A6Q",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p175",
        name: "TV HISENSE 75A65N",
        category: "TV",
        price: 11500000,
        image: "",
        shortDesc: "TV TV HISENSE 75A65N berkualitas tinggi untuk kebutuhan Anda.",
        description: "TV HISENSE 75A65N adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "TV HISENSE 75A65N",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p176",
        name: "TV HISENSE SAMRT TV 50A65N",
        category: "TV",
        price: 4400000,
        image: "",
        shortDesc: "TV TV HISENSE SAMRT TV 50A65N berkualitas tinggi untuk kebutuhan Anda.",
        description: "TV HISENSE SAMRT TV 50A65N adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "TV HISENSE SAMRT TV 50A65N",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p177",
        name: "TV LG 32LR600BPSB",
        category: "TV",
        price: 2300000,
        image: "",
        shortDesc: "TV TV LG 32LR600BPSB berkualitas tinggi untuk kebutuhan Anda.",
        description: "TV LG 32LR600BPSB adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "TV LG 32LR600BPSB",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p178",
        name: "TV LG SMART-TV 43UA7500PSA",
        category: "TV",
        price: 3800000,
        image: "",
        shortDesc: "TV TV LG SMART-TV 43UA7500PSA berkualitas tinggi untuk kebutuhan Anda.",
        description: "TV LG SMART-TV 43UA7500PSA adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "TV LG SMART-TV 43UA7500PSA",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    },
    {
        id: "p179",
        name: "TV TOSHIBA 32S25KP",
        category: "TV",
        price: 1800000,
        image: "",
        shortDesc: "TV TV TOSHIBA 32S25KP berkualitas tinggi untuk kebutuhan Anda.",
        description: "TV TOSHIBA 32S25KP adalah produk pilihan di kategori TV yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.",
        specs: {
            "Tipe": "TV TOSHIBA 32S25KP",
            "Kategori": "TV",
            "Kualitas": "Original Tridjaya"
    },
        highlights: ["Warna tajam & realistis","Desain slim & modern","Konektivitas lengkap"],
        sellingPoints: ["Hemat energi","Panel kualitas grade A+","Garansi resmi terpercaya"],
        objections: ["\"Cepat rusak panel?\" -> Pakai stabilizer dan garansi kami cover panel.","\"Ribet setting?\" -> Setting awal akan dibantu teknisi kami."]
    }
];

const partners = [
    { id: 'partner-aqua', name: 'Aqua', logo: '/uploads/Aqua.jpg' },
    { id: 'partner-sharp', name: 'Sharp', logo: '/uploads/sharp.png' },
    { id: 'partner-polytron', name: 'Polytron', logo: '/uploads/polytron.jpg' },
    { id: 'partner-goda', name: 'Goda', logo: '/uploads/goda.png' }
];

const seeds = {
    users: [],
    reward_tiers: [
        { id: 'silver', name: 'Silver Tier', threshold_points: 5000, reward_value: 650000, icon: 'Medal', color: 'text-slate-400', benefits: ['Komisi Extra 1%', 'Prioritas Support'] },
        { id: 'gold', name: 'Gold Tier', threshold_points: 15000, reward_value: 1200000, icon: 'Trophy', color: 'text-amber-400', benefits: ['Komisi Extra 2.5%', 'Voucher Belanja Rp 500rb'] },
        { id: 'diamond', name: 'Diamond Tier', threshold_points: 50000, reward_value: 2400000, icon: 'Crown', color: 'text-cyan-400', benefits: ['Komisi Extra 5%', 'Trip Liburan Tahunan'] }
    ],
    agent_stats: [],
    achievements: [
        { id: 'first_sale', name: 'First Blood', description: 'Berhasil melakukan penjualan pertama', icon: 'Target', color: 'text-red-500' },
        { id: 'sales_10', name: 'Rising Star', description: 'Mencapai 10 penjualan', icon: 'Star', color: 'text-yellow-500' },
        { id: 'top_agent', name: 'Elite Agent', description: 'Menjadi Top Agent bulanan', icon: 'Award', color: 'text-purple-500' }
    ],
    agent_achievements: [],
    reward_claims: [],
    products: products.map(p => ({
        ...p,
        slug: p.name.toLowerCase().replace(/ /g, '-'),
        subcategory: p.category,
        priceInstallment: p.price / 12,
        dpMin: p.price * 0.1,
        image: p.image,
        images: [p.image],
        badge: 'New',
        badgeText: 'Produk Terlaris',
        rating: 4.8,
        reviewCount: 120,
        shortDesc: `Deskripsi singkat untuk ${p.name}`,
        description: `Deskripsi lengkap untuk ${p.name}. Produk berkualitas dengan garansi resmi.`,
        specs: { "Garansi": "1 Tahun", "Warna": "Beragam" },
        stock: 'available',
        colors: ['Hitam', 'Putih', 'Merah']
    })),
    promos: [
        { id: 'promo-lebaran', title: 'Promo Lebaran', subtitle: 'Diskon hingga 50%', description: 'Rayakan lebaran dengan produk baru', discount: 20, originalPrice: 5000000, promoPrice: 4000000, image: 'https://api.dicebear.com/7.x/shapes/svg?seed=lebaran', badge: 'Terbatas', validUntil: '2026-05-30', category: 'Elektronik', variant: 'Special', productIds: ['p1', 'p3'] }
    ],
    blogPosts: [
        { id: 'blog-1', slug: 'tips-merawat-sepeda-listrik', title: 'Tips Merawat Sepeda Listrik', excerpt: 'Cara agar baterai awet...', author: 'Admin Tridjaya', author_role: 'Editor', author_image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin', hero_image: 'https://api.dicebear.com/7.x/shapes/svg?seed=blog1', category: 'Tips', tags: ['Sepeda Listrik', 'Maintenance'], publishedAt: formatDate(START_DATE), readTime: 5, featured: true }
    ],
    jobListings: [
        { id: 'job-1', title: 'Sales Agent', department: 'Sales', location: 'Manado', type: 'Full-time', level: 'Entry Level', description: 'Bergabunglah menjadi agent kami...', requirements: ['Minimal SMA', 'Memiliki motor'], benefits: ['Komisi besar', 'Bonus tahunan'], postedAt: formatDate(START_DATE) }
    ],
    partners: partners.map(p => ({ id: p.id, name: p.name, logo_url: p.logo, sort_order: 10 })),
    agent_registrations: [],
    leads: [],
    telemetry_events: [],
    referrals: [],
    support_tickets: [],
    notifications: []
};

// Generate Admins
for (let i = 1; i <= ADMINS_COUNT; i++) {
    const id = `adm-${i.toString().padStart(3, '0')}`;
    seeds.users.push({
        id,
        email: i === 1 ? 'admin@gmail.com' : `admin${i}@tridjaya.com`,
        name: i === 1 ? 'Administrator Tridjaya' : `Admin ${i}`,
        role: 'Admin',
        password: '123',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Admin${i}`
    });
}

// Generate Agents
for (let i = 1; i <= AGENTS_COUNT; i++) {
    const id = `agt-${i.toString().padStart(3, '0')}`;
    const name = `${randomElement(firstNames)} ${randomElement(lastNames)}`;
    const email = i === 1 ? 'agent@gmail.com' : `${name.toLowerCase().replace(/ /g, '.')}.${id}@gmail.com`;
    
    seeds.users.push({
        id,
        email,
        name,
        role: 'agent',
        password: '123',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        bank_account: `BNI - ${Math.floor(Math.random() * 1000000000)}`
    });

    // Referral link for agent
    const referralId = `ref-${id}`;
    seeds.referrals.push({
        id: referralId,
        slug: name.toLowerCase().replace(/ /g, '-'),
        owner_user_id: id,
        label: 'Link Utama',
        target_path: '/',
        clicks: 0,
        leads: 0,
        is_active: true,
        created_at: formatDate(START_DATE)
    });

    // Simulate leads for this agent
    const leadCount = Math.floor(Math.random() * LEADS_PER_AGENT_AVG) + 10;
    let salesCount = 0;
    let points = 0;

    for (let j = 0; j < leadCount; j++) {
        const leadId = `lead-${id}-${j}`;
        const leadDate = randomDate(START_DATE, NOW);
        const status = randomElement(['Follow Up', 'Negosiasi', 'Closed Won', 'Closed Lost']);
        
        seeds.leads.push({
            id: leadId,
            agent_id: id,
            customer_name: `${randomElement(firstNames)} ${randomElement(lastNames)}`,
            phone_number: `08${Math.floor(Math.random() * 1000000000)}`,
            interested_product: randomElement(products).name,
            status,
            notes: 'Follow up rutin via WhatsApp',
            created_at: formatDate(leadDate),
            updated_at: formatDate(new Date(leadDate.getTime() + 86400000))
        });

        // Telemetry for lead
        seeds.telemetry_events.push({
            id: crypto.randomUUID(),
            event_type: 'whatsapp_click',
            path: `/referral/${seeds.referrals[seeds.referrals.length-1].slug}`,
            source: 'Referral Link',
            session_id: crypto.randomUUID(),
            metadata: { lead_id: leadId },
            created_at: formatDate(leadDate)
        });

        if (status === 'Closed Won') {
            salesCount++;
            points += 1000;
        }

        // Notification for agent when lead is created
        seeds.notifications.push({
            id: crypto.randomUUID(),
            recipient_user_id: id,
            type: 'lead_new',
            title: 'Prospek Baru',
            message: `Seseorang tertarik dengan produk Anda.`,
            action_path: `/dashboard/leads`,
            entity_id: leadId,
            is_read: Math.random() > 0.3,
            created_at: formatDate(leadDate),
            read_at: null
        });
    }

    // Stats
    seeds.agent_stats.push({
        user_id: id,
        points,
        sales_count: salesCount,
        monthly_growth: Math.random() * 20,
        current_tier_id: points > 50000 ? 'diamond' : (points > 15000 ? 'gold' : 'silver')
    });

    // Achievements
    if (salesCount > 0) {
        seeds.agent_achievements.push({ agent_id: id, achievement_id: 'first_sale' });
    }
    if (salesCount >= 10) {
        seeds.agent_achievements.push({ agent_id: id, achievement_id: 'sales_10' });
    }

    // Support Tickets
    if (Math.random() > 0.5) {
        seeds.support_tickets.push({
            id: `ticket-${id}`,
            agent_id: id,
            subject: 'Kendala Pencairan Komisi',
            message: 'Halo admin, saya ingin menanyakan status komisi saya.',
            priority: 'medium',
            status: randomElement(['open', 'closed']),
            created_at: formatDate(randomDate(START_DATE, NOW)),
            updated_at: formatDate(NOW)
        });
    }
}

// Generate some generic telemetry
for (let i = 0; i < 500; i++) {
    seeds.telemetry_events.push({
        id: crypto.randomUUID(),
        event_type: 'page_view',
        path: randomElement(['/', '/products', '/about', '/contact']),
        source: randomElement(['Direct', 'Google', 'Facebook', 'Referral']),
        session_id: crypto.randomUUID(),
        metadata: {},
        created_at: formatDate(randomDate(START_DATE, NOW))
    });
}

// Save to file
fs.writeFileSync('backend/seeds.json', JSON.stringify(seeds, null, 2));
console.log('Successfully generated backend/seeds.json with 1 year of simulated data!');
