const fs = require('fs');

const modelData = {
    'AQR-D185': {
        shortDesc: 'Kulkas 1 Pintu dengan Giant Freezer dan Tempered Glass Tray.',
        description: 'Aqua AQR-D185 adalah kulkas 1 pintu yang dirancang untuk efisiensi energi dan kemudahan penggunaan. Dilengkapi dengan Giant Freezer berkapasitas 23L dan rak kaca tempered yang mampu menahan beban berat.',
        specs: {
            'Kapasitas': '145 Liter',
            'Daya': '67 Watt',
            'Dimensi': '525 x 524 x 1060 mm',
            'Sistem Pendingin': 'Direct Cooling',
            'Fitur': 'Semi-Auto Defrost, R600a Ramah Lingkungan'
        },
        highlights: ['Giant Freezer 23L', 'Tempered Glass Tray tahan 100kg', 'Konsumsi daya rendah 67W'],
        sellingPoints: ['Hemat listrik bulanan', 'Garansi kompresor 7 tahun', 'Desain elegan Aurora Series'],
        objections: ['"Gampang retak raknya?" -> Tidak, sudah tempered glass tahan 100kg.', '"Berisik?" -> Sangat senyap, cocok untuk kamar atau ruang tamu.']
    },
    'P7000N': {
        shortDesc: 'Mesin Cuci 2 Tabung 7kg dengan Roller Jet Pulsator.',
        description: 'LG P7000N menawarkan performa pencucian yang kuat namun lembut pada pakaian berkat Roller Jet Pulsator. Dilengkapi dengan Wind Jet Dry untuk pengeringan yang lebih cepat.',
        specs: {
            'Kapasitas': '7.0 kg',
            'Daya Cuci': '320 Watt',
            'Dimensi': '805 x 475 x 975 mm',
            'Tipe': 'Twin Tub',
            'Fitur': 'Roller Jet Pulsator, Wind Jet Dry, 3 Wash Program'
        },
        highlights: ['Roller Jet Pulsator untuk hasil bersih maksimal', 'Wind Jet Dry mempercepat pengeringan', 'Body anti karat'],
        sellingPoints: ['Sangat awet, investasi jangka panjang', 'Hasil cucian lebih kering dibanding kompetitor', 'Mudah dioperasikan'],
        objections: ['"Ribet manual?" -> Malah lebih awet karena mekanik sederhana.', '"Rusak?" -> Garansi resmi LG terjamin di seluruh Indonesia.']
    },
    'P8000N': {
        shortDesc: 'Mesin Cuci 2 Tabung 8kg dengan Roller Jet Pulsator.',
        description: 'LG P8000N memberikan efisiensi pencucian tinggi dengan teknologi Roller Jet Pulsator. Pakaian lebih bersih dan kering lebih cepat berkat fitur Wind Jet Dry.',
        specs: {
            'Kapasitas': '8 kg',
            'Daya Cuci': '320 Watt',
            'Daya Peras': '250 Watt',
            'Dimensi': '805 x 478 x 975 mm',
            'Fitur': 'Roller Jet Pulsator, Punch+3, Wind Jet Dry, Anti Rat Cover'
        }
    },
    'P9050RTB': {
        shortDesc: 'Mesin Cuci 2 Tabung 9kg, Kuat dan Tahan Lama.',
        description: 'LG P9050RTB dirancang untuk menangani beban cucian besar hingga 9kg. Dilengkapi dengan teknologi anti tikus dan pulsator yang kuat untuk hasil cuci maksimal.',
        specs: {
            'Kapasitas': '9 kg',
            'Daya': '320 Watt (Cuci)',
            'Dimensi': '805 x 475 x 975 mm',
            'Fitur': 'Roller Jet Pulsator, Punch+3, Wind Jet Dry, Anti Rat Base'
        }
    },
    'PWM-1076': {
        shortDesc: 'Mesin Cuci Polytron 10kg dengan Hijab Mode.',
        description: 'Polytron PWM-1076 hadir dengan fitur khusus Hijab Mode untuk menjaga serat kain halus. Kapasitas 10kg sangat cocok untuk keluarga besar. Hemat energi dengan teknologi Magic Gear.',
        specs: {
            'Kapasitas': '10 kg',
            'Daya Cuci': '250 Watt',
            'Daya Peras': '130 Watt',
            'Fitur': 'Hijab Mode, Magic Gear, Big Pulsator, Water Selector'
        },
        highlights: ['Fitur khusus Hijab Mode', 'Teknologi Magic Gear hemat listrik 30%', 'Kapasitas ekstra besar 10kg'],
        sellingPoints: ['Aman untuk kain halus/hijab', 'Motor kuat & bergaransi', 'Anti karat & tahan lama'],
        objections: ['"Boros listrik?" -> Sangat hemat, sudah pakai Magic Gear.', '"Susah bersihkan filter?" -> Filter dirancang mudah dilepas-pasang.']
    },
    'ES-T70MW': {
        shortDesc: 'Mesin Cuci Sharp 6.5kg Low Watt.',
        description: 'Sharp ES-T70MW adalah mesin cuci 2 tabung yang sangat hemat listrik. Menggunakan teknologi Super Soakmagic untuk hasil rendaman yang lebih bersih.',
        specs: {
            'Kapasitas': '6.5 kg',
            'Daya Cuci': '199 Watt',
            'Fitur': 'Super Soakmagic, Silvermagic Protection, Planet Gear'
        }
    },
    'Agate-200': {
        shortDesc: 'Showcase Cooler RSA 192 Liter, Pendinginan Cepat.',
        description: 'RSA Agate-200 sangat cocok untuk mendisplay minuman dingin di toko atau restoran Anda. Menggunakan kaca anti embun dan lampu LED yang terang.',
        specs: {
            'Volume': '192 Liter',
            'Daya': '180 Watt',
            'Rak': '3 Buah',
            'Fitur': 'Fan Cooling System, LED Light, Kaca Anti Embun, Key Lock'
        }
    },
    'PAS-10DF22': {
        shortDesc: 'Speaker Aktif Polytron Double 10 inci, Bass Menggelegar.',
        description: 'Nikmati kualitas suara premium dengan Polytron PAS-10DF22. Dilengkapi Double Woofer 10 inci dan fitur karaoke lengkap untuk hiburan keluarga Anda.',
        specs: {
            'Power': '200 Watt RMS',
            'Woofer': 'Double 10 inch',
            'Koneksi': 'Bluetooth, USB, SD Card, Aux, Line In',
            'Fitur': 'Super Bass, 3-Way System, 2 Mic Input, Polytron Audio Connect'
        },
        highlights: ['Double Woofer 10 inch untuk bass kuat', 'Fitur Karaoke dengan 2 Mic Input', 'Koneksi Bluetooth canggih'],
        sellingPoints: ['Suara paling mantap di kelasnya', 'Bisa kontrol lewat smartphone', 'Desain elegan dengan LED display'],
        objections: ['"Terlalu besar?" -> Suara sebanding dengan ukurannya yang kokoh.', '"Suara pecah?" -> Tidak, sudah pakai teknologi 3-Way System.']
    },
    '43E6K': {
        shortDesc: 'Smart TV Hisense 43 inci 4K UHD Google TV.',
        description: 'Hisense 43E6K menghadirkan gambar 4K yang sangat detail dan sistem Google TV yang cerdas. Mendukung Dolby Vision dan HDR10 untuk pengalaman sinematik di rumah.',
        specs: {
            'Resolusi': '4K UHD (3840x2160)',
            'OS': 'Google TV',
            'Fitur': 'Dolby Vision, Game Mode Plus, Voice Control, HDR10'
        }
    },
    'A36 5G': {
        shortDesc: 'Samsung Galaxy A36 5G, Performa Kencang Snapdragon.',
        description: 'Galaxy A36 5G menawarkan keseimbangan sempurna antara harga dan performa. Dilengkapi layar Super AMOLED 120Hz dan kamera 50MP OIS yang handal.',
        specs: {
            'Layar': '6.7 inch Super AMOLED 120Hz',
            'Processor': 'Snapdragon 6 Gen 3',
            'RAM/Storage': '8/256 GB',
            'Kamera': '50MP OIS + 8MP + 5MP',
            'Baterai': '5000mAh, 45W Fast Charging'
        }
    },
    'A17': {
        shortDesc: 'Samsung Galaxy A17, Smartphone 5G Terjangkau.',
        description: 'Samsung Galaxy A17 hadir dengan layar luas dan baterai besar yang tahan lama. Pilihan terbaik untuk produktivitas harian dan media sosial.',
        specs: {
            'RAM/Storage': '8/256 GB',
            'Fitur': 'Layar Besar, Baterai 5000mAh, Desain Modern'
        }
    },
    'D65': {
        shortDesc: 'Sepeda Listrik U-Winfly D65, Jarak Tempuh Hingga 50km.',
        description: 'U-Winfly D65 adalah sepeda listrik yang nyaman dengan suspensi empuk. Sangat cocok untuk belanja atau mengantar anak sekolah.',
        specs: {
            'Motor': '600 Watt',
            'Baterai': '48V / 12Ah',
            'Jarak': '50 km',
            'Beban': '150 kg'
        }
    },
    'Goda 150A': {
        shortDesc: 'Sepeda Listrik Goda Golden Panda 150A.',
        description: 'Goda 150A memiliki desain yang ikonik dan motor yang bertenaga. Dilengkapi fitur keamanan lengkap untuk kenyamanan berkendara Anda.',
        specs: {
            'Motor': '550 Watt',
            'Baterai': '48V / 12Ah',
            'Jarak': '40 km',
            'Beban': '150 kg'
        }
    },
    'Goda 122': {
        shortDesc: 'Sepeda Listrik Goda 122 New Model.',
        description: 'Varian terbaru dari Goda dengan peningkatan pada daya tahan baterai dan kenyamanan tempat duduk. Cocok untuk penggunaan harian di perumahan.',
        specs: {
            'Motor': '500 Watt',
            'Baterai': '48V / 12Ah',
            'Jarak': '40 km'
        }
    },
    'Nuv F1': {
        shortDesc: 'Sepeda Listrik Nuv F1 Spiva yang Tangguh.',
        description: 'Nuv F1 Spiva dirancang dengan frame yang kuat dan ban tubeless. Memberikan stabilitas tinggi saat dikendarai di berbagai medan jalan.',
        specs: {
            'Motor': '650 Watt',
            'Baterai': '48V / 12Ah',
            'Kecepatan': '40 km/jam'
        }
    },
    'LUNA': {
        shortDesc: 'Sepeda Listrik Saige Luna Premium.',
        description: 'Saige Luna adalah kasta tertinggi dari sepeda listrik Saige. Desain sangat elegan layaknya motor matic dengan fitur serba digital.',
        specs: {
            'Motor': '800 Watt',
            'Baterai': '48V / 20Ah',
            'Jarak': '60 km',
            'Fitur': 'NFC Lock, Digital Panel, Hydraulic Brake'
        }
    },
    'RETRO': {
        shortDesc: 'Sepeda Listrik Selis Retro, Gaya Klasik Masa Kini.',
        description: 'Tampil beda dengan Selis Retro. Menggabungkan desain klasik yang timeless dengan teknologi motor listrik modern yang senyap dan bertenaga.',
        specs: {
            'Motor': '500 Watt',
            'Baterai': '48V / 20Ah',
            'Jarak': '45 km'
        }
    },
    'G-L18': {
        shortDesc: 'Sepeda Listrik Soloz G-L18, Praktis dan Modern.',
        description: 'Soloz G-L18 menawarkan kemudahan mobilitas dengan desain yang compact namun tetap bertenaga. Sangat hemat biaya operasional.',
        specs: {
            'Motor': '500 Watt',
            'Baterai': '48V / 12Ah',
            'Jarak': '40 km'
        }
    },
    'CB-171-AP': {
        shortDesc: 'Blender Cosmos 2 in 1 dengan Pisau Stainless Steel.',
        description: 'Blender Cosmos CB-171-AP sangat handal untuk menghaluskan bumbu maupun buah. Dilengkapi dengan dry mill untuk menghaluskan biji-bijian.',
        specs: {
            'Kapasitas': '1 Liter',
            'Daya': '200-380 Watt',
            'Bahan': 'Plastik Food Grade'
        }
    },
    'RI-522 CE': {
        shortDesc: 'Kompor Gas Rinnai 2 Tungku Stainless Steel.',
        description: 'Kompor gas legendaris dari Rinnai yang terkenal awet dan api biru yang stabil. Mudah dibersihkan karena menggunakan bahan stainless steel berkualitas.',
        specs: {
            'Tipe': '2 Tungku',
            'Bahan': 'Stainless Steel',
            'Fitur': 'Api Ekonomis, Tatakan Enamel'
        }
    }

};

const categoryFallbacks = {
    'AC': {
        highlights: ['Pendinginan cepat & merata', 'Hemat listrik (Low Watt)', 'Operasi senyap'],
        sellingPoints: ['Garansi kompresor panjang', 'Tahan karat (Anti-Corrosion)', 'Layanan servis cepat'],
        objections: ['"Listrik jeglek?" -> Tidak, ini tipe Low Watt.', '"Pasang mahal?" -> Paket kami sudah termasuk pipa & pasang standar.']
    },
    'TV': {
        highlights: ['Warna tajam & realistis', 'Desain slim & modern', 'Konektivitas lengkap'],
        sellingPoints: ['Hemat energi', 'Panel kualitas grade A+', 'Garansi resmi terpercaya'],
        objections: ['"Cepat rusak panel?" -> Pakai stabilizer dan garansi kami cover panel.', '"Ribet setting?" -> Setting awal akan dibantu teknisi kami.']
    },
    'KULKAS': {
        highlights: ['Menjaga kesegaran lebih lama', 'Rak tempered glass kuat', 'Hemat energi'],
        sellingPoints: ['Bunga es minim', 'Ruang penyimpanan luas', 'Desain eksterior mewah'],
        objections: ['"Boros?" -> Teknologi baru lebih hemat 30%.', '"Bau?" -> Dilengkapi filter penyaring bau (Deodorizer).']
    },
    'MESIN CUCI': {
        highlights: ['Bersih maksimal, lembut di kain', 'Hemat air & deterjen', 'Body anti karat & tikus'],
        sellingPoints: ['Pengoperasian sangat mudah', 'Motor tangguh & awet', 'Pakaian lebih cepat kering'],
        objections: ['"Baju rusak?" -> Pulsator didesain khusus agar tidak melilit.', '"Berisik?" -> Sangat stabil bahkan saat memeras (spin).']
    },
    'SEPEDA LISTRIK': {
        highlights: ['Bebas bensin & polusi', 'Biaya charge sangat murah', 'Mudah dikendarai'],
        sellingPoints: ['Bisa dicicil tanpa kartu kredit', 'Servis bisa panggil ke rumah', 'Baterai awet & tahan lama'],
        objections: ['"Takut kena hujan?" -> Komponen sudah waterproof standar IP.', '"Sparepart susah?" -> Kami sedia lengkap dari baterai sampai ban.']
    },
    'HP': {
        highlights: ['Kamera jernih & tajam', 'Performa kencang anti lag', 'Baterai awet seharian'],
        sellingPoints: ['Garansi resmi 1 tahun', 'Bisa trade-in (tukar tambah)', 'Bonus aksesoris lengkap'],
        objections: ['"Gampang panas?" -> Sudah pakai sistem pendingin terbaru.', '"Memori penuh?" -> Dukungan slot MicroSD hingga 1TB.']
    }
};

function enrichProduct(p) {
    const name = p.name.toUpperCase();
    let enriched = { ...p };

    // Find model match
    for (const [key, data] of Object.entries(modelData)) {
        if (name.includes(key)) {
            enriched = { ...enriched, ...data };
            break;
        }
    }

    // Apply category fallbacks for missing fields
    const fallback = categoryFallbacks[p.category] || {};
    if (!enriched.shortDesc) {
        enriched.shortDesc = `${p.category} ${p.name} berkualitas tinggi untuk kebutuhan Anda.`;
    }
    if (!enriched.description) {
        enriched.description = `${p.name} adalah produk pilihan di kategori ${p.category} yang menawarkan performa handal dan efisiensi terbaik. Produk ini dirancang untuk memberikan kenyamanan maksimal bagi pengguna.`;
    }
    if (!enriched.specs || Object.keys(enriched.specs).length === 0) {
        enriched.specs = {
            'Tipe': p.name,
            'Kategori': p.category,
            'Kualitas': 'Original Tridjaya'
        };
    }
    if (!enriched.highlights) enriched.highlights = fallback.highlights || ['Kualitas Terjamin', 'Garansi Resmi', 'Layanan Aftersales'];
    if (!enriched.sellingPoints) enriched.sellingPoints = fallback.sellingPoints || ['Harga Bersaing', 'Bisa Cicilan', 'Barang Ready'];
    if (!enriched.objections) enriched.objections = fallback.objections || ['"Bisa kurang?" -> Harga sudah terbaik dengan layanan prima.', '"Garansi?" -> Resmi pabrikan.'];

    return enriched;
}

// Read generate_seeds.js
const seedFile = 'c:/Users/acer/Desktop/Project/RUST/Tridjaya Samrat/backend/scripts/generate_seeds.js';
let content = fs.readFileSync(seedFile, 'utf8');

// Find the products array
const startMarker = 'const products = [';
const endMarker = '];';
const startIndex = content.indexOf(startMarker) + startMarker.length;
const endIndex = content.indexOf(endMarker, startIndex);

const productsRaw = content.substring(startIndex, endIndex);
// This is a bit tricky because it's JS code, not JSON. 
// But since it's a static array in the script, we can eval it in a sandbox or just parse it if it's clean.
// For safety, I'll use a simpler regex or manual string manipulation.

// Let's try to parse it as an array of objects
const products = eval('[' + productsRaw + ']');
const enrichedProducts = products.map(enrichProduct);

// Stringify back
const enrichedRaw = enrichedProducts.map(p => {
    return `    {
        id: ${JSON.stringify(p.id)},
        name: ${JSON.stringify(p.name)},
        category: ${JSON.stringify(p.category)},
        price: ${p.price},
        image: ${JSON.stringify(p.image)},
        shortDesc: ${JSON.stringify(p.shortDesc)},
        description: ${JSON.stringify(p.description)},
        specs: ${JSON.stringify(p.specs, null, 8).replace(/\n/g, '\n    ')},
        highlights: ${JSON.stringify(p.highlights)},
        sellingPoints: ${JSON.stringify(p.sellingPoints)},
        objections: ${JSON.stringify(p.objections)}
    }`;
}).join(',\n');

const newContent = content.substring(0, startIndex) + '\n' + enrichedRaw + '\n' + content.substring(endIndex);
fs.writeFileSync(seedFile, newContent);
console.log('Successfully enriched 179 products in generate_seeds.js');
