const fs = require('fs');

const seedsPath = 'seeds.json';
const seeds = JSON.parse(fs.readFileSync(seedsPath, 'utf8'));

// 1. Standardize product categories
const categoryMap = {
    'MC': 'MESIN CUCI',
    'SOPA': 'SOFA',
    'HP': 'HANDPHONE',
    'MAGICOM': 'MAGIC COM',
    'KIPAS': 'KIPAS ANGIN'
};

seeds.products.forEach(p => {
    if (categoryMap[p.category]) {
        p.category = categoryMap[p.category];
    }
    // Also update subcategory if it matches the old category
    if (categoryMap[p.subcategory]) {
        p.subcategory = categoryMap[p.subcategory];
    }
});

// 2. Extract unique categories and create product_categories array
const uniqueCats = [...new Set(seeds.products.map(p => p.category))].sort();

const categoryDetails = {
    'AC': 'Sistem pendingin udara untuk kenyamanan ruangan Anda.',
    'AIR FRYER': 'Alat masak modern untuk menggoreng sehat tanpa minyak.',
    'AKSESORIS': 'Berbagai perlengkapan pendukung produk elektronik dan furnitur.',
    'BAN': 'Pilihan ban berkualitas untuk kendaraan dan sepeda listrik.',
    'BATERAI': 'Sumber daya cadangan dan utama untuk perangkat Anda.',
    'BLENDER': 'Penghalus makanan dan bumbu dapur berkualitas.',
    'BRAKET': 'Penyangga TV dan peralatan elektronik lainnya.',
    'DISPENSER': 'Penyedia air minum panas dan dingin praktis.',
    'FREEZER': 'Penyimpanan beku untuk kesegaran makanan lebih lama.',
    'HANDPHONE': 'Perangkat komunikasi cerdas terbaru dari berbagai brand.',
    'KASUR': 'Pilihan kasur springbed untuk tidur yang berkualitas.',
    'KIPAS ANGIN': 'Penyegar udara ruangan dengan berbagai model.',
    'KOMPOR': 'Peralatan memasak dapur dengan teknologi keamanan terbaru.',
    'KULKAS': 'Lemari es untuk menjaga kesegaran bahan makanan.',
    'KURSI': 'Pilihan kursi duduk nyaman untuk berbagai kebutuhan.',
    'LEMARI': 'Penyimpanan pakaian dan barang rumah tangga lainnya.',
    'MAGIC COM': 'Penanak nasi otomatis dengan fitur multifungsi.',
    'MEJA': 'Pilihan meja fungsional untuk rumah dan kantor.',
    'MESIN CUCI': 'Solusi pencucian pakaian yang bersih dan efisien.',
    'OVEN': 'Alat pemanggang roti dan makanan berkualitas.',
    'PISAU': 'Peralatan potong dapur tajam dan tahan lama.',
    'SEPEDA LISTRIK': 'Kendaraan ramah lingkungan untuk mobilitas harian.',
    'SETRIKA': 'Penghalus pakaian praktis dan hemat energi.',
    'SHOWCASE': 'Lemari pendingin dengan pintu kaca untuk display produk.',
    'SOFA': 'Pilihan sofa empuk dan stylish untuk ruang tamu.',
    'SPAREPART SELIS': 'Suku cadang asli untuk perawatan sepeda listrik.',
    'SPEAKER': 'Sistem audio untuk hiburan berkualitas di rumah.',
    'TV': 'Televisi layar datar dengan teknologi gambar jernih.'
};

seeds.product_categories = uniqueCats.map(name => ({
    id: `cat-${name.toLowerCase().replace(/ /g, '-')}`,
    name: name,
    slug: name.toLowerCase().replace(/ /g, '-'),
    description: categoryDetails[name] || `Kategori produk ${name} berkualitas tinggi.`
}));

fs.writeFileSync(seedsPath, JSON.stringify(seeds, null, 2));
console.log(`Successfully standardized categories and added ${seeds.product_categories.length} category records.`);
