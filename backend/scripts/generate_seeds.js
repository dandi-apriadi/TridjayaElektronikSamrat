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
    { id: 'p1', name: 'Sepeda Listrik G-One', category: 'Sepeda Listrik', price: 5500000, image: '/uploads/partners/bike-goda.webp' },
    { id: 'p2', name: 'E-Motor Saige M6', category: 'Motor Listrik', price: 12000000, image: '/uploads/partners/saige.webp' },
    { id: 'p3', name: 'Kulkas Sharp 2 Pintu', category: 'Elektronik', price: 3500000, image: '/uploads/partners/lg-fridge.webp' },
    { id: 'p4', name: 'AC Polytron 1/2 PK', category: 'Elektronik', price: 2800000, image: '/uploads/partners/sharp-ac.webp' },
    { id: 'p5', name: 'Smart TV LG 43"', category: 'Elektronik', price: 4200000, image: '/uploads/partners/tv.webp' },
    { id: 'p6', name: 'Mesin Cuci Polytron', category: 'Elektronik', price: 3100000, image: '/uploads/partners/polytron-washer.webp' },
    { id: 'p7', name: 'Sepeda Selis Mandalika', category: 'Sepeda Listrik', price: 4800000, image: '/uploads/partners/selis-mandalika.webp' }
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
    const email = i === 1 ? 'agent@gmail.com' : `${name.toLowerCase().replace(/ /g, '.')}@gmail.com`;
    
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
