import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Tag, ArrowRight, Search } from 'lucide-react';
import { Badge } from '../components/ui';
import { useBlogStore } from '../store/useBlogStore';
import type { BlogPost } from '../types';
import blogHeroImg from '../assets/images/blog-hero.webp';
import { getImageUrl } from '../utils/apiClient';
import { recordTelemetry } from '../utils/telemetry';

const categories = ['Semua', 'Review', 'Tips & Trik', 'Edukasi', 'Home Styling'];

const PostCard: React.FC<{ post: BlogPost; index: number; featured?: boolean }> = ({ post, index, featured }) => {
  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="lg:col-span-2"
      >
        <Link
          to={`/blog/${post.slug}`}
          onClick={() => {
            recordTelemetry('click', {
              path: `/blog/${post.slug}`,
              source: 'internal',
              metadata: {
                contentType: 'article',
                contentSlug: post.slug,
                contentKey: `article:${post.slug}`,
                contentTitle: post.title,
                action: 'open_article_detail',
                location: featured ? 'blog_featured_card' : 'blog_card',
              },
            });
          }}
          className="group block"
        >
          <div className="relative overflow-hidden rounded-2xl aspect-[16/7]">
            <img src={getImageUrl(post.heroImage)} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
            <div className="absolute top-5 left-5">
              <Badge label={`⭐ ${post.category}`} variant="primary" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-body text-body-sm text-on-surface-variant">{post.publishedAt}</span>
                  <span className="w-1 h-1 rounded-full bg-outline" />
                  <span className="font-body text-body-sm text-on-surface-variant flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.readTime} menit baca</span>
                </div>
                <h2 className="font-display text-headline-md font-bold text-white mb-2 group-hover:text-primary transition-colors">{post.title}</h2>
                <p className="font-body text-body-md text-on-surface-variant line-clamp-2 mb-3">{post.excerpt}</p>
                <div className="flex items-center gap-2 text-primary font-body text-body-md font-semibold group-hover:gap-3 transition-all duration-200">
                  Baca Selengkapnya <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.07, 0.35), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/blog/${post.slug}`}
        onClick={() => {
          recordTelemetry('click', {
            path: `/blog/${post.slug}`,
            source: 'internal',
            metadata: {
              contentType: 'article',
              contentSlug: post.slug,
              contentKey: `article:${post.slug}`,
              contentTitle: post.title,
              action: 'open_article_detail',
              location: featured ? 'blog_featured_card' : 'blog_card',
            },
          });
        }}
        className="group block"
      >
        <div className="glass-card rounded-2xl overflow-hidden hover:shadow-neon-cyan transition-all duration-300 h-full">
          <div className="relative overflow-hidden aspect-[16/9]">
            <img src={getImageUrl(post.heroImage)} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 glass-dark rounded-lg font-body text-label-sm font-semibold text-primary uppercase tracking-wider">{post.category}</span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-body text-body-sm text-on-surface-variant">{post.publishedAt}</span>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <span className="font-body text-body-sm text-on-surface-variant flex items-center gap-1">
                <Clock className="w-3 h-3" />{post.readTime} mnt
              </span>
            </div>
            <h3 className="font-display text-title-md font-bold text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
            <p className="font-body text-body-sm text-on-surface-variant line-clamp-2 mb-3">{post.excerpt}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {post.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-surface-highest text-on-surface-variant font-body text-label-sm">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const BlogPage: React.FC = () => {
  const { posts, isLoading, fetchPosts } = useBlogStore();

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const activeTag = searchParams.get('tag');

  const featured = posts.find((p) => p.featured);
  const others = posts.filter((p) => !p.featured);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-on-surface-variant font-body">Memuat Artikel...</p>
        </div>
      </div>
    );
  }

  const filtered = (activeCategory === 'Semua' ? others : others.filter((p) => p.category === activeCategory))
    .filter((p) => searchQuery === '' || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((p) => !activeTag || p.tags.some((tag) => tag.toLowerCase() === activeTag.toLowerCase()));

  const clearTagFilter = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tag');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src={blogHeroImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-surface" />
        </div>
        <div className="relative z-10 container-custom text-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <Badge label="Blog & Tips" variant="primary" />
            <h1 className="font-display text-display-sm font-bold text-white mt-4 mb-4">
              Insight & Inspirasi <span className="gradient-text-primary">Tridjaya</span>
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant max-w-xl mx-auto mb-8">
              Tips perawatan, review produk, dan inspirasi gaya hidup modern dari para ahli kami.
            </p>
            <div className="flex justify-center mb-6">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-surface font-body text-body-md font-semibold shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all duration-200"
              >
                Login
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Cari artikel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-highest rounded-xl pl-11 pr-4 py-3 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pb-20 bg-surface/90">
        <div className="container-custom">
          {/* Featured */}
          {featured && !searchQuery && activeCategory === 'Semua' && !activeTag && (
            <div className="mb-10">
              <PostCard post={featured} index={0} featured />
            </div>
          )}

          {activeTag && (
            <div className="mb-6 glass-card rounded-xl p-4 flex items-center justify-between gap-3">
              <p className="font-body text-body-sm text-on-surface-variant">
                Filter aktif: <span className="text-primary font-semibold">#{activeTag}</span>
              </p>
              <button
                type="button"
                onClick={clearTagFilter}
                className="px-3 py-1.5 rounded-lg bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors text-label-sm font-semibold"
              >
                Reset Filter
              </button>
            </div>
          )}

          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap mb-8">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-body text-body-md font-medium transition-all duration-200 ${
                  activeCategory === cat
                    ? 'gradient-primary text-surface shadow-neon-cyan-sm'
                    : 'glass-card text-on-surface-variant hover:text-white'
                }`}
              >
                {cat !== 'Semua' && <Tag className="w-3.5 h-3.5" />}
                {cat}
              </button>
            ))}
          </div>

          {/* Posts grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="font-body text-body-lg text-on-surface-variant">Tidak ada artikel yang ditemukan.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default BlogPage;
