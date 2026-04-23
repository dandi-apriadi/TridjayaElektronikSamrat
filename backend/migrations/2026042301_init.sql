-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    price REAL NOT NULL,
    price_installment REAL,
    dp_min REAL,
    image TEXT NOT NULL,
    images TEXT, -- JSON array of strings
    badge TEXT,
    badge_text TEXT,
    rating REAL DEFAULT 4.5,
    review_count INTEGER DEFAULT 0,
    short_desc TEXT,
    description TEXT,
    specs TEXT, -- JSON object
    stock TEXT DEFAULT 'available',
    colors TEXT, -- JSON array of strings
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Promos Table
CREATE TABLE IF NOT EXISTS promos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    discount INTEGER,
    original_price REAL,
    promo_price REAL,
    image TEXT NOT NULL,
    badge TEXT,
    valid_until TEXT,
    category TEXT,
    variant TEXT,
    product_ids TEXT, -- JSON array of strings
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    author TEXT,
    author_role TEXT,
    author_image TEXT,
    hero_image TEXT,
    category TEXT,
    tags TEXT, -- JSON array of strings
    published_at TEXT,
    read_time INTEGER,
    featured BOOLEAN DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Job Listings Table
CREATE TABLE IF NOT EXISTS job_listings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    type TEXT,
    level TEXT,
    description TEXT,
    requirements TEXT, -- JSON array
    benefits TEXT, -- JSON array
    posted_at TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
