import sqlite3

# Mapping: Keyword in Product Name -> Data Dict
DATA = {
    # MESIN CUCI
    "WS80SK10": {
        "short_desc": "Mesin cuci 2 tabung (Twin Tub) kapasitas 8kg hemat listrik (Super Low Watt) dengan fitur Hijab Care.",
        "description": "Hisense WS80SK10 adalah solusi pencucian efisien untuk keluarga Indonesia. Dilengkapi teknologi Hijab Care untuk pencucian lembut kain sensitif, Air Tub Spin Drying untuk pengeringan lebih cepat dan anti-bau, serta bodi plastik anti-karat yang tahan lama.",
        "specs": "Tipe: Twin Tub (Top Loading); Kapasitas: 8.0 Kg; Daya Cuci: 360-400W; Daya Spin: 160-180W; Kecepatan Spin: 1350 RPM; Dimensi: 763 x 450 x 892 mm."
    },
    "QW-9031HT": {
        "short_desc": "Mesin cuci 2 tabung 9kg 'Hijab Series' dengan fitur pengeringan Air Dry dan Dynamic Soak.",
        "description": "Aqua QW-9031HT dirancang khusus untuk perawatan hijab dan pakaian halus. Memiliki fitur Fresh Air System untuk pengeringan optimal tanpa bau apek, serta perendaman dinamis (Dynamic Soak) untuk mempermudah pengangkatan kotoran membandel.",
        "specs": "Tipe: Twin Tub; Kapasitas: 9 Kg; Daya Cuci: 380-400W; Daya Spin: 160W; Dimensi: 760 x 441 x 939 mm; Material: Kabinet Plastik PP."
    },
    "ES-T1290WA": {
        "short_desc": "Mesin cuci 2 tabung kapasitas jumbo 12kg dengan teknologi Dolphinwave dan filter Aquamagic.",
        "description": "Sharp ES-T1290WA Dolphinwave Series menawarkan kapasitas besar untuk keluarga besar. Dilengkapi W-Screw Pulsator untuk pusaran air tornado yang kuat, Super Aquamagic Filter dengan Ion Ag+ anti-bakteri, serta bodi plastik yang bebas korosi.",
        "specs": "Tipe: Twin Tub; Kapasitas: 12 Kg (Cuci) / 10 Kg (Spin); Daya Cuci: 360W; Daya Spin: 180W; Dimensi: 921 x 1065 x 551 mm."
    },
    "P1200RT": {
        "short_desc": "Mesin cuci 2 tabung 12kg dengan teknologi Roller Jet Pulsator dan Wind Jet Dry.",
        "description": "LG P-1200RT menawarkan performa pencucian maksimal dengan teknologi Roller Jet Pulsator yang menambah gesekan untuk hasil lebih bersih. Dilengkapi Wind Jet Dry untuk sirkulasi udara optimal saat pengeringan dan 3 program pencucian (Gentle, Normal, Strong).",
        "specs": "Tipe: Twin Tub; Kapasitas: 12 Kg; Daya: 450W; Dimensi: 880 x 530 x 1025 mm; Fitur: Punch+3, Wind Jet Dry."
    },
    "P-1200RT": {
        "short_desc": "Mesin cuci 2 tabung 12kg dengan teknologi Roller Jet Pulsator dan Wind Jet Dry.",
        "description": "LG P-1200RT menawarkan performa pencucian maksimal dengan teknologi Roller Jet Pulsator yang menambah gesekan untuk hasil lebih bersih. Dilengkapi Wind Jet Dry untuk sirkulasi udara optimal saat pengeringan dan 3 program pencucian (Gentle, Normal, Strong).",
        "specs": "Tipe: Twin Tub; Kapasitas: 12 Kg; Daya: 450W; Dimensi: 880 x 530 x 1025 mm; Fitur: Punch+3, Wind Jet Dry."
    },
    # SEPEDA LISTRIK
    "GODA 118": {
        "short_desc": "Sepeda listrik modern 600W dengan kecepatan 40km/jam and fitur Smart Key.",
        "description": "Goda Apollo GD 118 dirancang untuk mobilitas perkotaan yang efisien. Memiliki 3 mode kecepatan, fitur Auto-P untuk keamanan parkir, serta IoT Start/Smart Key untuk kemudahan akses tanpa kunci konvensional.",
        "specs": "Motor: 600W; Baterai: 48V 12Ah; Kecepatan: +/- 40 km/jam; Jarak Tempuh: +/- 40 km; Ban: Tubeless; Rem: Tromol."
    },
    "GODA 122": {
        "short_desc": "Sepeda listrik stylish 550W dengan intelligent display dan colorful running lights.",
        "description": "Goda Halo 122 menawarkan desain futuristik dengan lampu hias warna-warni dan dashboard fungsional. Sangat ekonomis dan ramah lingkungan, cocok untuk aktivitas harian seperti ke sekolah atau pasar.",
        "specs": "Motor: 550W; Baterai: 48V 12Ah; Kecepatan: +/- 40 km/jam; Jarak Tempuh: 35-40 km; Beban Maks: 150 kg; Fitur: Keyless, Remote Alarm."
    },
    "U-WINFLY D65": {
        "short_desc": "Sepeda listrik praktis 600W dengan sistem Smart Key NFC dan desain sporty.",
        "description": "U-Winfly D65 mengombinasikan kenyamanan berkendara dengan teknologi canggih seperti Smart Key NFC. Memiliki suspensi ganda yang empuk dan daya angkut hingga 150kg, ideal untuk komuter jarak pendek.",
        "specs": "Motor: 600W; Baterai: 48V 12Ah; Kecepatan: 33-45 km/jam; Jarak Tempuh: 40-50 km; Fitur: Remote Alarm, LED Headlight."
    },
    "SAIGE LUNA": {
        "short_desc": "Sepeda listrik elegan 800W dengan daya tempuh jauh hingga 70km dan tampilan mewah.",
        "description": "Saige Luna tampil dengan desain premium menyerupai motor listrik minimalis. Dengan motor 800W dan baterai 20Ah, sepeda ini mampu menempuh jarak yang lebih jauh dibandingkan model standar, memberikan kenyamanan ekstra untuk perjalanan harian.",
        "specs": "Motor: 800W; Baterai: 48V 20Ah; Kecepatan: +/- 45 km/jam; Jarak Tempuh: 55-70 km; Beban Maks: 200 kg; Fitur: Lock Motor, Find Vehicle."
    },
    "GODA 150A": {
        "short_desc": "Sepeda listrik tangguh 550W dengan jarak tempuh 40km dan sistem pengereman tromol.",
        "description": "Goda 150A adalah kendaraan listrik yang andal untuk kebutuhan transportasi jarak pendek. Didesain dengan struktur kokoh dan fitur keamanan standar yang memadai untuk kenyamanan berkendara di komplek atau perumahan.",
        "specs": "Motor: 550W; Baterai: 48V 12Ah; Kecepatan: 40 km/jam; Jarak Tempuh: 40 km; Beban Maks: 150 kg."
    },
    # HANDPHONE
    "SAMSUNG GALAXY A56": {
        "short_desc": "Smartphone premium 5G dengan Exynos 1580, layar Super AMOLED 120Hz, dan pengisian cepat 45W.",
        "description": "Samsung Galaxy A56 5G menghadirkan performa kencang dengan chipset Exynos 1580 (4nm) dan layar 120Hz yang sangat cerah (1900 nits). Dilengkapi kamera utama 50MP OIS dan sertifikasi IP67 untuk ketahanan air dan debu.",
        "specs": "Layar: 6.7 inch Super AMOLED 120Hz; Chipset: Exynos 1580; RAM/Storage: 8GB/256GB; Kamera: 50MP OIS + 12MP + 5MP; Baterai: 5000mAh (45W Fast Charging)."
    },
    "SAMSUNG A56": {
        "short_desc": "Smartphone premium 5G dengan Exynos 1580, layar Super AMOLED 120Hz, dan pengisian cepat 45W.",
        "description": "Samsung Galaxy A56 5G menghadirkan performa kencang dengan chipset Exynos 1580 (4nm) dan layar 120Hz yang sangat cerah (1900 nits). Dilengkapi kamera utama 50MP OIS dan sertifikasi IP67 untuk ketahanan air dan debu.",
        "specs": "Layar: 6.7 inch Super AMOLED 120Hz; Chipset: Exynos 1580; RAM/Storage: 8GB/256GB; Kamera: 50MP OIS + 12MP + 5MP; Baterai: 5000mAh (45W Fast Charging)."
    },
    "HOT 40i": {
        "short_desc": "HP Entry-level performa gaming dengan RAM besar (8GB+8GB virtual) and penyimpanan 256GB.",
        "description": "Infinix Hot 40i dirancang untuk multitasking lancar dan hiburan. Memiliki layar 90Hz yang halus, fitur Magic Ring interaktif untuk notifikasi, serta penyimpanan internal luas 256GB yang jarang ada di kelasnya.",
        "specs": "Layar: 6.56 inch 90Hz HD+; Chipset: Unisoc T606; RAM/Storage: 8GB/256GB; Kamera: 32MP Front / 50MP AI Rear; Baterai: 5000mAh (18W)."
    },
    "OPPO A98 5G": {
        "short_desc": "Smartphone 5G dengan 67W SUPERVOOC, layar 120Hz, and kamera mikroskop 40x.",
        "description": "OPPO A98 5G menonjolkan kecepatan pengisian daya super cepat (0-100% dalam 44 menit) and fitur kamera mikroskop unik. Didesain dengan OPPO Glow yang cantik and Battery Health Engine untuk masa pakai baterai hingga 4 tahun.",
        "specs": "Layar: 6.72 inch 120Hz FHD+; Chipset: Snapdragon 695 5G; RAM/Storage: 8GB/256GB; Kamera: 64MP + 2MP + 2MP Microscope; Baterai: 5000mAh (67W)."
    },
    "REDMI 10C": {
        "short_desc": "HP efisien bertenaga Snapdragon 680 dengan kamera 50MP and layar luas 6.71 inci.",
        "description": "Redmi 10C adalah pilihan cerdas untuk penggunaan harian. Ditenagai prosesor Snapdragon 680 yang hemat daya namun bertenaga, didukung kamera 50MP yang jernih and penyimpanan UFS 2.2 yang cepat untuk membuka aplikasi.",
        "specs": "Layar: 6.71 inch HD+; Chipset: Snapdragon 680; RAM/Storage: 4GB/64-128GB; Kamera: 50MP + 2MP; Baterai: 5000mAh (18W)."
    },
    "REDMI 12C": {
        "short_desc": "Smartphone ekonomis dengan layar besar 6.71 inci and kamera 50MP AI.",
        "description": "Redmi 12C menawarkan performa harian yang handal dengan harga terjangkau. Memiliki layar lega untuk menonton video, baterai 5000mAh yang awet, serta kamera 50MP untuk menangkap momen penting dengan detail.",
        "specs": "Layar: 6.71 inch HD+; Prosesor: Helio G85; RAM/Storage: hingga 4GB/128GB; Kamera: 50MP AI; Baterai: 5000mAh."
    },
    # TV
    "LE50AQT7000QU": {
        "short_desc": "Smart Android TV 50 inci 4K UHD dengan teknologi HQLED and Hands-free Voice Control.",
        "description": "AQUA LE50AQT7000QU Pro menghadirkan kualitas gambar memukau dengan HQLED 4K HDR and Dolby Vision. Dilengkapi sistem Android 11, fitur Google Assistant tanpa remote (Hands-free), and IoT Hub untuk mengontrol perangkat pintar di rumah Anda.",
        "specs": "Layar: 50 inch 4K UHD; Sistem: Android 11; Fitur: Dolby Atmos, Chromecast, HQLED; Daya: 160W; Dimensi: 1116 x 252 x 727 mm."
    },
    "LE55AQT7000QU": {
        "short_desc": "Smart Android TV 55 inci 4K UHD desain Bezel Less dengan visual HQLED yang nyata.",
        "description": "AQUA LE55AQT7000QU menawarkan pengalaman menonton bioskop di rumah dengan layar 55 inci tanpa bingkai (Bezel Less). Didukung teknologi HQ-LED 4K HDR untuk detail gambar yang tajam and fitur cerdas Google Assistant untuk kemudahan navigasi.",
        "specs": "Layar: 55 inch 4K UHD; Sistem: Android OS; Fitur: Intelligent Voice Control, IoT Hub, Chromecast; Daya: 150W; Dimensi: 1239 x 313 x 777 mm."
    },
    "POLYTRON 32": {
        "short_desc": "Smart Google TV 32 inci HD Ready dengan garansi 5 tahun and kualitas suara unggul.",
        "description": "TV Polytron 32 inci (Seri Cinemax/Google TV) memberikan gambar jernih dengan DIPE Engine and dukungan siaran TV Digital (DVB-T2). Dikenal dengan fitur suara yang kuat and jaminan garansi 5 tahun yang mencakup panel LED and remote.",
        "specs": "Layar: 32 inch HD Ready; Sistem: Google TV / Android; Fitur: DIPE Engine, USB Multimedia, T2 Digital; Garansi: 5 Tahun."
    },
    # KULKAS
    "SJ-236MG-GB": {
        "short_desc": "Kulkas 2 pintu 205L desain Shine Magneglas yang elegan and hemat energi.",
        "description": "Sharp SJ-236MG-GB Shine Series hadir dengan pintu bermotif geometris yang mewah and tahan gores. Dilengkapi Fan Cooling System untuk pendinginan merata, fitur 7 Shields untuk perlindungan maksimal, and teknologi AG+ Nano Deodorizer untuk menjaga kesegaran tanpa bau.",
        "specs": "Kapasitas: 205 Liter; Sistem: Fan Cooling; Daya: 100-130W; Fitur: Tempered Glass Tray, Ice Twist, 7 Shields; Dimensi: 545 x 588 x 1380 mm."
    }
}

def main():
    conn = sqlite3.connect('tridjaya.db')
    c = conn.cursor()
    
    updated_count = 0
    for kw, vals in DATA.items():
        # Match by keyword in name
        query = "UPDATE products SET short_desc = ?, description = ?, specs = ? WHERE name LIKE ?"
        params = (vals['short_desc'], vals['description'], vals['specs'], f'%{kw}%')
        c.execute(query, params)
        updated_count += c.rowcount
        if c.rowcount > 0:
            print(f"Updated {c.rowcount} products matching keyword: {kw}")
        
    conn.commit()
    conn.close()
    print(f"Total products enriched: {updated_count}")

if __name__ == "__main__":
    main()
