# Tridjaya Samrat - UI Generation Master Prompts (REVISED)

Dokumen ini berisi daftar prompt yang telah diperbarui untuk fokus pada produk Sepeda Listrik (Goda, Winfly, Nuv), Elektronik (TV, Kulkas, Kipas), dan Furniture (Sofa). 

**Konsep Desain: "Balanced Modernism"**
- Desain tidak terlalu gelap (hindari obsidian pekat) dan tidak terlalu cerah (hindari putih silau).
- **DarkMode**: Menggunakan *Soft Charcoal* (#1A1A1A) dengan aksen *Electric Cyan*.
- **LightMode**: Menggunakan *Warm Mist* (#F2F2F2) dengan aksen *Sophisticated Indigo*.
- Fokus pada visual produk yang premium dan tata letak Bento Grid yang dinamis.

---

## 1. Public Experience Layer (Pengunjung & SEO)

### 1.1 Beranda (Landing Page) done
**Prompt**:
> A premium landing page for Tridjaya Samrat (Bikes, Electronics & Furniture). Hero section: Balanced modern aesthetic (neither too dark nor too bright). Features a high-fidelity showcase of Goda & Winfly electric bikes and premium sofas. Asymmetrical Bento Grid Categories: "Electric Mobility" (Bikes), "Home Entertainment" (TVs), "Cooling & Kitchen" (Kulkas, Kipas), and "Living Space" (Sofa). Navigation: Glassmorphic bar with soft tonal shifts. Support both Soft Charcoal (Dark) and Warm Mist (Light) modes.

### 1.2 Daftar Promosi (`/promo`) done
**Prompt**:
> Premium promotions list for Tridjaya Samrat. Bento Grid layout. Focus: "Electric Freedom" promo for Winfly/Goda bikes, "Cooling Days" for refrigerators/fans, and "Comfort First" for sofas. Design Strategy: Balanced contrast. Use Soft Charcoal (#1A1A1A) for dark mode and Warm Mist (#F2F2F2) for light mode. Aksen: Electric Cyan and Indigo. Soft glassmorphism with 24px backdrop blur.

### 1.3 Katalog Produk Sepeda Listrik (`/produk/bike`) done
**Prompt**:
> Specialized catalog for Electric Bikes (Goda, Winfly, Nuv). High-quality card grid showing bike range, battery battery life, and price. Subtle "Eco-friendly" badges. Design: Balanced modernism, no-line rule, tonal surface layering.

### 1.4 Katalog Elektronik & Furniture (`/produk/home`) done
**Prompt**:
> Combined catalog for Home Electronics (TV, Kulkas, Kipas) and Furniture (Sofa). Categorized Bento Grid. Use high-res lifestyle images. Soft shadows, deep tonal depth without being pitch black.

### 1.5 Detail Produk (`/produk/[slug]`) done
**Prompt**:
> High-end product detail page. Focus on Goda/Winfly bikes or premium home items (TV/Sofa). Features: Large image gallery, technical specs (Engine/Power for bikes, Dimensions for furniture), and "Apply Credit" CTA. Right panel: Price and variant selector (colors/sizes). Design: Balanced contrast between background and cards.

### 1.6 Daftar Blog & Tips (`/blog`) done
**Prompt**:
> Editorial blog list focusing on "Electric Bike Maintenance" and "Home Styling Tips". Featured card at the top. Asymmetrical Bento Grid below. LightMode: Warm Mist (#F2F2F2) for reading comfort. DarkMode: Soft Charcoal (#1A1A1A).

### 1.7 Detail Artikel (`/blog/[slug]`) done
**Prompt**:
> Premium reading experience. Focus on high legibility. Large hero image with soft overlay. Content discusses product reviews (e.g., Goda vs Winfly) and home care.

### 1.8 Portal Karir (`/karier`) done
**Prompt**:
> Modern career portal for Tridjaya Samrat. Bento grid for job listings (Sales Executive, Tech Support, Warehouse). Balanced design, Electric Cyan chips.

### 1.9 Landing Page Referal Agen (`/referal/[slug]`) done
**Prompt**:
> Personalized referral page. Agent profile snippet welcoming the customer. Highlighted product (e.g., a specific Winfly bike or Smart TV). Lead capture form in a glassmorphic card.

---

## 2. Operational Layer (Internal Portal)

### 2.1 Admin Central Dashboard (Overview) done
**Prompt**:
> Admin Central Dashboard for Tridjaya Samrat. Focus: Management of Blog, Agents (Resellers), and Catalog content. KPIs: Total active resellers, blog engagement stats, and catalog health. Bento Grid layout with "Reseller Registration Alerts", "Recently Updated Catalog items", and "Popular Articles". Balanced modern aesthetic (Soft Charcoal #1A1A1A). Tonal surface layering, glassmorphic navigation.

### 2.2 Product Knowledge & Catalog Management (`/dashboard/catalog`) done
**Prompt**:
> Comprehensive Catalog Management focusing on Product Knowledge. This is the source of truth for agents. Fields include: Real-time price, Stock availability (Available, Indent, or Hidden), and Detailed Credit Pricing (DP & monthly installments). Design: High-fidelity product cards with technical specs focused on sales points for Goda/Winfly bikes, Electronics, and Furniture. Sub-menus for "Bike Specs", "Electronic Specs", and "Furniture Materials".

### 2.3 Agent Registration Form (`/agent/register`)
**Prompt**:
> Premium public-facing registration form for new Resellers/Agents. Hero section: "Become a Tridjaya Partner." Features: Multi-step registration form (User Profile, Social Reach, Experience). Glassmorphic card design, minimalist and professional. Electric Cyan accents. Design builds trust and excitement for joining the platform.

### 2.4 Reseller Personal Dashboard (`/dashboard/reseller`)
**Prompt**:
> Personalized command center for Resellers. Bento Grid layout containing: 
> 1. **Product Knowledge Access**: Quick search for prices and stock.
> 2. **Customer Data**: Table view of their buyers.
> 3. **Prospect Management**: Lead tracking system (Prospective buyers).
> 4. **Earnings & Financials**: Income overview, Pending balances, and Withdrawal History.
> High-performance "Neon Nocturne" aesthetic. Smooth transitions between modules.

### 2.5 Agent & Withdrawal Management (Admin View) (`/admin/agents`)
**Prompt**:
> Admin interface for managing the reseller network. Features: Agent Approval queue (verifying registration data), Performance tracking, and Withdrawal Request management (approving reseller payouts). Clean, professional table with balance statuses and "Approval" CTAs.
