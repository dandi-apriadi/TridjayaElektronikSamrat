-- Migration: Site Content Management
-- Created: 2026-04-23

CREATE TABLE IF NOT EXISTS site_content (
    id TEXT PRIMARY KEY,
    page TEXT NOT NULL,
    section TEXT NOT NULL,
    content TEXT NOT NULL -- Store as JSON
);

-- Initial Content for Home & About
-- This allows translating/changing text from DB
INSERT INTO site_content (id, page, section, content) VALUES 
('home-hero', 'home', 'hero', '{"title": "Solusi Gaya Hidup Modern & Berkelanjutan di Sulawesi", "subtitle": "Nikmati kenyamanan rumah dengan teknologi elektronik premium dan mobilitas hijau masa depan."}'),
('about-story', 'about', 'story', '{"title": "Lebih dari Sekadar Bisnis", "body": "Didirikan pada tahun 2010 di Makassar, Tridjaya Samrat bermula sebagai toko elektronik sederhana dengan visi untuk menyediakan akses mudah bagi masyarakat lokal terhadap teknologi berkualitas."}');
