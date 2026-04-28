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
        image: ""
    },
    {
        id: "p2",
        name: "Set sofa minimalis + meja abu corak",
        category: "SOPA",
        price: 2800000,
        image: ""
    },
    {
        id: "p3",
        name: "AC LG STANDARD 1/2 PK K05NSA",
        category: "AC",
        price: 2750000,
        image: ""
    },
    {
        id: "p4",
        name: "AC SHARP 1 PK AH-A9ZCY+AU-A9ZCY",
        category: "AC",
        price: 3350000,
        image: ""
    },
    {
        id: "p5",
        name: "AC SHARP 1/2 PK AH-A5ZCY+AU-A5ZCY",
        category: "AC",
        price: 2850000,
        image: ""
    },
    {
        id: "p6",
        name: "AQUA KULKAS AQR-DTM245CBP",
        category: "KULKAS",
        price: 2850000,
        image: ""
    },
    {
        id: "p7",
        name: "BAN AURORA",
        category: "BAN",
        price: 200000,
        image: ""
    },
    {
        id: "p8",
        name: "BAN LUAR SAIGE EGO PLUS",
        category: "SPAREPART SELIS",
        price: 150000,
        image: ""
    },
    {
        id: "p9",
        name: "BAN POLARIS",
        category: "BAN",
        price: 200000,
        image: ""
    },
    {
        id: "p10",
        name: "BATERAI GODA 48V/12AH",
        category: "BATERAI",
        price: 0,
        image: ""
    },
    {
        id: "p11",
        name: "BATERAI GODA 48V/20AH",
        category: "BATERAI",
        price: 0,
        image: ""
    },
    {
        id: "p12",
        name: "BATERAI SAIGE 48V/20AH",
        category: "BATERAI",
        price: 0,
        image: ""
    },
    {
        id: "p13",
        name: "BATERAI SAIGE LITHIUM 48V/20AH",
        category: "BATERAI",
        price: 0,
        image: ""
    },
    {
        id: "p14",
        name: "BATERAI U-WINFLY 48V/12AH",
        category: "BATERAI",
        price: 0,
        image: ""
    },
    {
        id: "p15",
        name: "BLENDER COSMOS CB-171-AP",
        category: "BLENDER",
        price: 260000,
        image: ""
    },
    {
        id: "p16",
        name: "BRACKET AC 1 PK",
        category: "BRAKET",
        price: 70000,
        image: ""
    },
    {
        id: "p17",
        name: "BRACKET TV QUALITY 50-100",
        category: "BRAKET",
        price: 385000,
        image: ""
    },
    {
        id: "p18",
        name: "BRAKET TV BERVIN BWBA-1940M",
        category: "BRAKET",
        price: 110000,
        image: ""
    },
    {
        id: "p19",
        name: "CHARGER SAIGE 48V-12AH",
        category: "SPAREPART SELIS",
        price: 160000,
        image: ""
    },
    {
        id: "p20",
        name: "CHARGER SAIGE 48V-20AH",
        category: "SPAREPART SELIS",
        price: 230000,
        image: ""
    },
    {
        id: "p21",
        name: "COSMOS AIR COOLER CAC 005-ABW",
        category: "AC",
        price: 1350000,
        image: ""
    },
    {
        id: "p22",
        name: "DENPO PIPA ECONOMY 1/4 + 3/8",
        category: "AC",
        price: 0,
        image: ""
    },
    {
        id: "p23",
        name: "DENPOO PIPA AC PLATINUM 1/4+1/2 x 0.6",
        category: "AC",
        price: 130000,
        image: ""
    },
    {
        id: "p24",
        name: "DISPENSER COSMOS CWD-113",
        category: "DISPENSER",
        price: 200000,
        image: ""
    },
    {
        id: "p25",
        name: "DISPENSER COSMOS CWD-115",
        category: "DISPENSER",
        price: 250000,
        image: ""
    },
    {
        id: "p26",
        name: "DISPENSER COSMOS CWD-1170",
        category: "DISPENSER",
        price: 200000,
        image: ""
    },
    {
        id: "p27",
        name: "ELECTRIC OVEN COSMOS CO-9919 R",
        category: "OVEN",
        price: 690000,
        image: ""
    },
    {
        id: "p28",
        name: "FAN COSMOS 16 SDB",
        category: "KIPAS",
        price: 265000,
        image: ""
    },
    {
        id: "p29",
        name: "FREEZER BOX GEA AB-108 R",
        category: "FREEZER",
        price: 2300000,
        image: ""
    },
    {
        id: "p30",
        name: "FREEZER BOX GEA AB-208-R",
        category: "FREEZER",
        price: 3000000,
        image: ""
    },
    {
        id: "p31",
        name: "FREEZER BOX RSA CF-210",
        category: "FREEZER",
        price: 2600000,
        image: ""
    },
    {
        id: "p32",
        name: "FREEZER BOX RSA CF-310Q",
        category: "FREEZER",
        price: 3300000,
        image: ""
    },
    {
        id: "p33",
        name: "FREZEER AQUA AQF-460MG",
        category: "FREEZER",
        price: 4600000,
        image: ""
    },
    {
        id: "p34",
        name: "FREZER AQUA AQF-120MC",
        category: "FREEZER",
        price: 2050000,
        image: ""
    },
    {
        id: "p35",
        name: "FREZER RSA CF-110",
        category: "FREEZER",
        price: 2000000,
        image: ""
    },
    {
        id: "p36",
        name: "FREZER RSA CF-310",
        category: "KULKAS",
        price: 3500000,
        image: ""
    },
    {
        id: "p37",
        name: "FRIZER BOX RSA XS-110",
        category: "KULKAS",
        price: 2750000,
        image: ""
    },
    {
        id: "p38",
        name: "HANDLE REM KANAN SAIGE M35",
        category: "SPAREPART SELIS",
        price: 30000,
        image: ""
    },
    {
        id: "p39",
        name: "HANDLE REM KIRI SAIGE LUNA",
        category: "SPAREPART SELIS",
        price: 85000,
        image: ""
    },
    {
        id: "p40",
        name: "HANDLE REM KIRI SAIGE M35",
        category: "SPAREPART SELIS",
        price: 30000,
        image: ""
    },
    {
        id: "p41",
        name: "Handphone Samsung A56 5G 8/256GB Pink",
        category: "HP",
        price: 6200000,
        image: ""
    },
    {
        id: "p42",
        name: "HISENSE AC SPLIT 1 PK AN09CDG",
        category: "AC",
        price: 3000000,
        image: ""
    },
    {
        id: "p43",
        name: "HISENSE AC SPLIT 1/2 PK AN05CDG",
        category: "AC",
        price: 2700000,
        image: ""
    },
    {
        id: "p44",
        name: "HISENSE SMART TV 32A4200G",
        category: "TV",
        price: 1999000,
        image: ""
    },
    {
        id: "p45",
        name: "HISENSE SMART TV 43E6K",
        category: "TV",
        price: 3300000,
        image: ""
    },
    {
        id: "p46",
        name: "Hp Samsung Galaxy A56 5G 8/256 Light Gray",
        category: "HP",
        price: 6200000,
        image: ""
    },
    {
        id: "p47",
        name: "IMP TV CABINET 120 MOTIF L04",
        category: "MEJA",
        price: 1100000,
        image: ""
    },
    {
        id: "p48",
        name: "IMP ZW-M03 C01 DM LEMARI BESI 3 PINTU 120 CM",
        category: "LEMARI",
        price: 2900000,
        image: ""
    },
    {
        id: "p49",
        name: "IMP ZW-M03 C11 DM LEMARI BESI 3 PINTU 120 CM",
        category: "LEMARI",
        price: 2900000,
        image: ""
    },
    {
        id: "p50",
        name: "IMP ZW-M03 C21 DM LEMARI BESI 3 PINTU 120 CM",
        category: "LEMARI",
        price: 2900000,
        image: ""
    },
    {
        id: "p51",
        name: "ISI KAMPAS REM DEPAN / BELAKANG M35",
        category: "AKSESORIS",
        price: 150000,
        image: ""
    },
    {
        id: "p52",
        name: "KABEL AKI SAIGE",
        category: "SPAREPART SELIS",
        price: 13000,
        image: ""
    },
    {
        id: "p53",
        name: "KABEL FEDERAL NYM 2X1.5 MM @30M",
        category: "AKSESORIS",
        price: 15000,
        image: ""
    },
    {
        id: "p54",
        name: "KABEL SUPREME NYM 2X1.5",
        category: "AKSESORIS",
        price: 15000,
        image: ""
    },
    {
        id: "p55",
        name: "KAMPAS REM AURORA",
        category: "AKSESORIS",
        price: 150000,
        image: ""
    },
    {
        id: "p56",
        name: "KAMPAS REM BELAKANG SAIGE M35",
        category: "SPAREPART SELIS",
        price: 70000,
        image: ""
    },
    {
        id: "p57",
        name: "KAMPAS REM DEPAN SAIGE M35",
        category: "SPAREPART SELIS",
        price: 40000,
        image: ""
    },
    {
        id: "p58",
        name: "KAMPAS REM POLARIS",
        category: "AKSESORIS",
        price: 150000,
        image: ""
    },
    {
        id: "p59",
        name: "KASUR BUSA ROYAL FOAM MEDIACARE ORTHO 120 X 200",
        category: "KASUR",
        price: 1500000,
        image: ""
    },
    {
        id: "p60",
        name: "KASUR GADJAH BALI 23 CM 120 X 200",
        category: "SOPA",
        price: 1050000,
        image: ""
    },
    {
        id: "p61",
        name: "KASUR GADJAH BALI SUPERBED 160x200 23 CM",
        category: "KASUR",
        price: 1350000,
        image: ""
    },
    {
        id: "p62",
        name: "KETTLE COSMOS CTL-618N",
        category: "BLENDER",
        price: 180000,
        image: ""
    },
    {
        id: "p63",
        name: "KIPAS ANGIN COSMOS 12-LDA",
        category: "KIPAS",
        price: 210000,
        image: ""
    },
    {
        id: "p64",
        name: "KIPAS ANGIN COSMOS 16 SN",
        category: "KIPAS",
        price: 315000,
        image: ""
    },
    {
        id: "p65",
        name: "KIPAS ANGIN COSMOS 16 WFC",
        category: "KIPAS",
        price: 275000,
        image: ""
    },
    {
        id: "p66",
        name: "Kirin AIR FRYER 4.5L KAF - 745",
        category: "AIR FRYER",
        price: 999000,
        image: ""
    },
    {
        id: "p67",
        name: "Kirin KNIFE SET 06 PP KUS-KS06",
        category: "PISAU",
        price: 175000,
        image: ""
    },
    {
        id: "p68",
        name: "Kirin RICE COOKER 2.0 LT KRC 238 GREY",
        category: "MAGICOM",
        price: 330000,
        image: ""
    },
    {
        id: "p69",
        name: "KLAKSON EGO PLUS",
        category: "AKSESORIS",
        price: 50000,
        image: ""
    },
    {
        id: "p70",
        name: "KLAKSON M35",
        category: "AKSESORIS",
        price: 50000,
        image: ""
    },
    {
        id: "p71",
        name: "KOMPOR GAS RINNAI RI-522 CE",
        category: "KOMPOR",
        price: 425000,
        image: ""
    },
    {
        id: "p72",
        name: "KULKAS 1P SHARP SJ-N192D-VB",
        category: "KULKAS",
        price: 2150000,
        image: ""
    },
    {
        id: "p73",
        name: "KULKAS AQUA AQR-D185 (MME)",
        category: "KULKAS",
        price: 1800000,
        image: ""
    },
    {
        id: "p74",
        name: "KULKAS AQUA AQR-D185 (MPE)",
        category: "KULKAS",
        price: 1850000,
        image: ""
    },
    {
        id: "p75",
        name: "KULKAS CHANGHONG CBC-100",
        category: "KULKAS",
        price: 1600000,
        image: ""
    },
    {
        id: "p76",
        name: "KULKAS GEA MINI BAR INOX GMB-50",
        category: "KULKAS",
        price: 1299000,
        image: ""
    },
    {
        id: "p77",
        name: "KULKAS HISENSE 2 PINTU RT218N4IBN",
        category: "KULKAS",
        price: 2900000,
        image: ""
    },
    {
        id: "p78",
        name: "KULKAS HISENSE RR125D4IBN",
        category: "KULKAS",
        price: 1550000,
        image: ""
    },
    {
        id: "p79",
        name: "KULKAS HISENSE RR198D4IBN",
        category: "KULKAS",
        price: 1900000,
        image: ""
    },
    {
        id: "p80",
        name: "KULKAS HISENSE RT469N4IWU",
        category: "KULKAS",
        price: 5500000,
        image: ""
    },
    {
        id: "p81",
        name: "KULKAS LG GN-Y201CLAR",
        category: "KULKAS",
        price: 2350000,
        image: ""
    },
    {
        id: "p82",
        name: "KULKAS LG GN-B202SQIR",
        category: "KULKAS",
        price: 3500000,
        image: ""
    },
    {
        id: "p83",
        name: "KULKAS MINI BAR HISENSE RR68D4IGN 43L SILVER",
        category: "KULKAS",
        price: 1250000,
        image: ""
    },
    {
        id: "p84",
        name: "KULKAS SHARP SJ-197ND-VB",
        category: "KULKAS",
        price: 2900000,
        image: ""
    },
    {
        id: "p85",
        name: "KULKAS SHARP SJ-237MG-DP",
        category: "KULKAS",
        price: 3150000,
        image: ""
    },
    {
        id: "p86",
        name: "KULKAS SHARP SJ-N162D-SH/SB/SP",
        category: "KULKAS",
        price: 1850000,
        image: ""
    },
    {
        id: "p87",
        name: "KULKAS SHARP SJ-N192D AB/AP",
        category: "KULKAS",
        price: 2150000,
        image: ""
    },
    {
        id: "p88",
        name: "KULKAS SHARP SJ-X165MG",
        category: "KULKAS",
        price: 1850000,
        image: ""
    },
    {
        id: "p89",
        name: "KURSI TERAS AF 001",
        category: "KURSI",
        price: 1150000,
        image: ""
    },
    {
        id: "p90",
        name: "LAMPU SEIN SAIGE M35 BELAKANG",
        category: "SPAREPART SELIS",
        price: 60000,
        image: ""
    },
    {
        id: "p91",
        name: "LAMPU SEIN SAIGE M35 DEPAN",
        category: "SPAREPART SELIS",
        price: 60000,
        image: ""
    },
    {
        id: "p92",
        name: "LEM DUCT TAPE LEM ADHESIVE DU",
        category: "AC",
        price: 15000,
        image: ""
    },
    {
        id: "p93",
        name: "LEM DUCT TAPE NON ADHESIVE DU",
        category: "AC",
        price: 10000,
        image: ""
    },
    {
        id: "p94",
        name: "LEMARI ARSIP KABINET IMPORTA SC-04MS",
        category: "LEMARI",
        price: 1850000,
        image: ""
    },
    {
        id: "p95",
        name: "LEMARI BESI ANAK 2P IMPORTA LCS-S02 B56 FM 90 CM",
        category: "LEMARI",
        price: 1900000,
        image: ""
    },
    {
        id: "p96",
        name: "MAGICOM COSMOS CRJ-3307",
        category: "MAGICOM",
        price: 290000,
        image: ""
    },
    {
        id: "p97",
        name: "MEGAN COFFEE TABLE BLACK SET",
        category: "MEJA",
        price: 999000,
        image: ""
    },
    {
        id: "p98",
        name: "MEJA MAKAN BULAT MIAMI 4P",
        category: "MEJA",
        price: 2499000,
        image: ""
    },
    {
        id: "p99",
        name: "MEJA TAMU 306 B",
        category: "MEJA",
        price: 600000,
        image: ""
    },
    {
        id: "p100",
        name: "MESIN CUCI AQUA QW-8031 HT",
        category: "SEPEDA LISTRIK",
        price: 1600000,
        image: ""
    },
    {
        id: "p101",
        name: "MESIN CUCI AQUA QW-9031HT",
        category: "MESIN CUCI",
        price: 1800000,
        image: ""
    },
    {
        id: "p102",
        name: "MESIN CUCI HISENSE WS80SK10",
        category: "MESIN CUCI",
        price: 1500000,
        image: ""
    },
    {
        id: "p103",
        name: "MESIN CUCI HISENSE WS90SK10",
        category: "MESIN CUCI",
        price: 1700000,
        image: ""
    },
    {
        id: "p104",
        name: "MESIN CUCI HISENSE WSHS1013UB",
        category: "MESIN CUCI",
        price: 1950000,
        image: ""
    },
    {
        id: "p105",
        name: "MESIN CUCI HISENSE WSHS1213UB",
        category: "MESIN CUCI",
        price: 2250000,
        image: ""
    },
    {
        id: "p106",
        name: "MESIN CUCI LG P1000RT",
        category: "MESIN CUCI",
        price: 2900000,
        image: ""
    },
    {
        id: "p107",
        name: "MESIN CUCI LG P-1200RT",
        category: "MESIN CUCI",
        price: 3250000,
        image: ""
    },
    {
        id: "p108",
        name: "MESIN CUCI LG P7000N",
        category: "MESIN CUCI",
        price: 2500000,
        image: ""
    },
    {
        id: "p109",
        name: "MESIN CUCI LG P8000N",
        category: "MESIN CUCI",
        price: 2700000,
        image: ""
    },
    {
        id: "p110",
        name: "MESIN CUCI LG P9050RTB",
        category: "MESIN CUCI",
        price: 2800000,
        image: ""
    },
    {
        id: "p111",
        name: "MESIN CUCI POLYTRON PWM-1076",
        category: "MESIN CUCI",
        price: 2150000,
        image: ""
    },
    {
        id: "p112",
        name: "MESIN CUCI POLYTRON PWM-7073-P",
        category: "MESIN CUCI",
        price: 1600000,
        image: ""
    },
    {
        id: "p113",
        name: "MESIN CUCI POLYTRON PWM-8072",
        category: "MESIN CUCI",
        price: 1700000,
        image: ""
    },
    {
        id: "p114",
        name: "MESIN CUCI POLYTRON PWM-9076",
        category: "MC",
        price: 1900000,
        image: ""
    },
    {
        id: "p115",
        name: "MESIN CUCI RSA 10Kg WM-TT100",
        category: "MESIN CUCI",
        price: 1700000,
        image: ""
    },
    {
        id: "p116",
        name: "MESIN CUCI RSA 7kg WM-TT70",
        category: "MESIN CUCI",
        price: 1300000,
        image: ""
    },
    {
        id: "p117",
        name: "MESIN CUCI RSA 8Kg WM-TT80",
        category: "MESIN CUCI",
        price: 1400000,
        image: ""
    },
    {
        id: "p118",
        name: "MESIN CUCI SHARP ES-T1090-VK/PK",
        category: "MESIN CUCI",
        price: 2499000,
        image: ""
    },
    {
        id: "p119",
        name: "MESIN CUCI SHARP ES-T1290WA",
        category: "MC",
        price: 3050000,
        image: ""
    },
    {
        id: "p120",
        name: "MESIN CUCI SHARP ES-T70MW-BL",
        category: "MC",
        price: 1500000,
        image: ""
    },
    {
        id: "p121",
        name: "MESIN CUCI SHARP ES-T80MW",
        category: "MC",
        price: 1650000,
        image: ""
    },
    {
        id: "p122",
        name: "MESIN CUCI SHARP ES-T90MW",
        category: "MC",
        price: 1975000,
        image: ""
    },
    {
        id: "p123",
        name: "MESIN CUCI SHARP ES-T90MW-PK",
        category: "MC",
        price: 1975000,
        image: ""
    },
    {
        id: "p124",
        name: "REM KANAN SAIGE LUNA",
        category: "SPAREPART SELIS",
        price: 220000,
        image: ""
    },
    {
        id: "p125",
        name: "RSA SHOWCASE RUBY 200",
        category: "SHOWCASE",
        price: 3300000,
        image: ""
    },
    {
        id: "p126",
        name: "SADLE DEPAN SAIGE EGO PLUS",
        category: "SPAREPART SELIS",
        price: 65000,
        image: ""
    },
    {
        id: "p127",
        name: "SAMSUNG GALAXY A17 5G 8/256 BLACK",
        category: "HANDPHONE",
        price: 3699000,
        image: ""
    },
    {
        id: "p128",
        name: "SAMSUNG GALAXY A17 LTE 8/256 GB BLACK",
        category: "HP",
        price: 3399000,
        image: ""
    },
    {
        id: "p129",
        name: "SAMSUNG GALAXY A36 5G 8/256 GB AWESOME BLACK",
        category: "HANDPHONE",
        price: 5200000,
        image: ""
    },
    {
        id: "p130",
        name: "SAMSUNG GALAXY A36 5G 8/256 GB AWESOME LAVENDER",
        category: "HANDPHONE",
        price: 5200000,
        image: ""
    },
    {
        id: "p131",
        name: "SAMSUNG GALAXY A36 5G 8/256 GB AWESOME WHITE",
        category: "HANDPHONE",
        price: 5700000,
        image: ""
    },
    {
        id: "p132",
        name: "SAMSUNG GALAXY A56 5G 8/256 GB AWESOME GRAPHITE",
        category: "HP",
        price: 6200000,
        image: ""
    },
    {
        id: "p133",
        name: "SAMSUNG GALAXY A56 5G 8/256 GB AWESOME OLIVE",
        category: "HANDPHONE",
        price: 6300000,
        image: ""
    },
    {
        id: "p134",
        name: "SAMSUNG SMART TV UA32H5000FKLXD",
        category: "TV",
        price: 2450000,
        image: ""
    },
    {
        id: "p135",
        name: "SELIS GROBAK PUJASERA3 FIBER C",
        category: "SEPEDA LISTRIK",
        price: 17000000,
        image: ""
    },
    {
        id: "p136",
        name: "SEPEDA LISTRIK GODA 118 HITAM",
        category: "SEPEDA LISTRIK",
        price: 4000000,
        image: ""
    },
    {
        id: "p137",
        name: "SEPEDA LISTRIK GODA 118 MERAH",
        category: "SEPEDA LISTRIK",
        price: 4000000,
        image: ""
    },
    {
        id: "p138",
        name: "SEPEDA LISTRIK GODA 118 PUTIH",
        category: "SEPEDA LISTRIK",
        price: 4000000,
        image: ""
    },
    {
        id: "p139",
        name: "SEPEDA LISTRIK GODA 122 ABU",
        category: "SEPEDA LISTRIK",
        price: 4500000,
        image: ""
    },
    {
        id: "p140",
        name: "SEPEDA LISTRIK GODA 150A ABU",
        category: "SEPEDA LISTRIK",
        price: 4500000,
        image: ""
    },
    {
        id: "p141",
        name: "SEPEDA LISTRIK GODA 199 MAX-C RRQ",
        category: "SEPEDA LISTRIK",
        price: 13200000,
        image: ""
    },
    {
        id: "p142",
        name: "SEPEDA LISTRIK NUV F1 SPIVA BIRU",
        category: "SEPEDA LISTRIK",
        price: 4200000,
        image: ""
    },
    {
        id: "p143",
        name: "SEPEDA LISTRIK NUV F1 SPIVA HIJAU",
        category: "SEPEDA LISTRIK",
        price: 4200000,
        image: ""
    },
    {
        id: "p144",
        name: "SEPEDA LISTRIK NUV F1 SPIVA UNGU",
        category: "SEPEDA LISTRIK",
        price: 4200000,
        image: ""
    },
    {
        id: "p145",
        name: "SEPEDA LISTRIK SAIGE LUNA",
        category: "SEPEDA LISTRIK",
        price: 6800000,
        image: ""
    },
    {
        id: "p146",
        name: "SEPEDA LISTRIK SELIS RETRO COKLAT",
        category: "SEPEDA LISTRIK",
        price: 19800000,
        image: ""
    },
    {
        id: "p147",
        name: "SEPEDA LISTRIK SOLOZ G-L18 HIJAU",
        category: "SEPEDA LISTRIK",
        price: 5699000,
        image: ""
    },
    {
        id: "p148",
        name: "SEPEDA LISTRIK U-WINFLY D65 PINK",
        category: "SEPEDA LISTRIK",
        price: 4600000,
        image: ""
    },
    {
        id: "p149",
        name: "SETRIKA COSMOS CI-3110CM",
        category: "SETRIKA",
        price: 160000,
        image: ""
    },
    {
        id: "p150",
        name: "SETRIKA COSMOS CIS-318",
        category: "SETRIKA",
        price: 150000,
        image: ""
    },
    {
        id: "p151",
        name: "SHARP LED TV 2T-C32GH3000I",
        category: "TV",
        price: 2500000,
        image: ""
    },
    {
        id: "p152",
        name: "SHARP LED TV 2T-C32GH3000I",
        category: "TV",
        price: 2500000,
        image: ""
    },
    {
        id: "p153",
        name: "SHOWCASE RSA AGATE-200",
        category: "SHOWCASE",
        price: 3200000,
        image: ""
    },
    {
        id: "p154",
        name: "SHOWCASE RSA AGATE-240R",
        category: "SHOWCASE",
        price: 3500000,
        image: ""
    },
    {
        id: "p155",
        name: "SHOWCASE RSA AGATE-300R",
        category: "SHOWCASE",
        price: 3999000,
        image: ""
    },
    {
        id: "p156",
        name: "SHOWCASE RSA RUBY240",
        category: "SHOWCASE",
        price: 3600000,
        image: ""
    },
    {
        id: "p157",
        name: "SOFA MINIMALIS 221 + MEJA COKLAT CORAK",
        category: "SOPA",
        price: 3000000,
        image: ""
    },
    {
        id: "p158",
        name: "SOUNDBAR JBL CINEMA 550",
        category: "SPEAKER",
        price: 3150000,
        image: ""
    },
    {
        id: "p159",
        name: "SPEAKER AKTIV SHARP CBOX-D1280CB",
        category: "SPEAKER",
        price: 2400000,
        image: ""
    },
    {
        id: "p160",
        name: "SPEAKER HARDWELL 12 PRO",
        category: "SPEAKER",
        price: 3999000,
        image: ""
    },
    {
        id: "p161",
        name: "SPEAKER NIKO MEGABOX 12",
        category: "SPEAKER",
        price: 3450000,
        image: ""
    },
    {
        id: "p162",
        name: "SPEAKER NIKO OXXO 8",
        category: "SPEAKER",
        price: 1550000,
        image: ""
    },
    {
        id: "p163",
        name: "SPEAKER NIKO PT-1202",
        category: "SPEAKER",
        price: 1250000,
        image: ""
    },
    {
        id: "p164",
        name: "SPEAKER NIKO WT10B",
        category: "SPEAKER",
        price: 1250000,
        image: ""
    },
    {
        id: "p165",
        name: "SPEAKER NIKO WT6A",
        category: "SPEAKER",
        price: 1099000,
        image: ""
    },
    {
        id: "p166",
        name: "SPEAKER NIKO WTD-10A",
        category: "SPEAKER",
        price: 1599000,
        image: ""
    },
    {
        id: "p167",
        name: "SPEAKER POLYTRON PAS-10DF22",
        category: "SPEAKER",
        price: 3100000,
        image: ""
    },
    {
        id: "p168",
        name: "SPEAKER POLYTRON PAS-PR012F3",
        category: "SPEAKER",
        price: 3000000,
        image: ""
    },
    {
        id: "p169",
        name: "SPEAKER POLYTRON PAS-PRO15F3",
        category: "SPEAKER",
        price: 3300000,
        image: ""
    },
    {
        id: "p170",
        name: "SPEAKER WIRELESS HUPPER JL 10",
        category: "SPEAKER",
        price: 3600000,
        image: ""
    },
    {
        id: "p171",
        name: "SPEAKER WIRELESS HUPPER JL 15",
        category: "SPEAKER",
        price: 5500000,
        image: ""
    },
    {
        id: "p172",
        name: "STOP KONTAK SAIGE",
        category: "SPAREPART SELIS",
        price: 20000,
        image: ""
    },
    {
        id: "p173",
        name: "TV HISENSE 32E4H",
        category: "TV",
        price: 1900000,
        image: ""
    },
    {
        id: "p174",
        name: "TV HISENSE 65A6Q",
        category: "TV",
        price: 7800000,
        image: ""
    },
    {
        id: "p175",
        name: "TV HISENSE 75A65N",
        category: "TV",
        price: 11500000,
        image: ""
    },
    {
        id: "p176",
        name: "TV HISENSE SAMRT TV 50A65N",
        category: "TV",
        price: 4400000,
        image: ""
    },
    {
        id: "p177",
        name: "TV LG 32LR600BPSB",
        category: "TV",
        price: 2300000,
        image: ""
    },
    {
        id: "p178",
        name: "TV LG SMART-TV 43UA7500PSA",
        category: "TV",
        price: 3800000,
        image: ""
    },
    {
        id: "p179",
        name: "TV TOSHIBA 32S25KP",
        category: "TV",
        price: 1800000,
        image: ""
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
fs.writeFileSync('seeds.json', JSON.stringify(seeds, null, 2));
console.log('Successfully generated seeds.json with 1 year of simulated data!');
