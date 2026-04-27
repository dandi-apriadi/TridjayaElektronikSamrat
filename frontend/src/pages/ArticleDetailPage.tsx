import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { 
  ArrowLeft,
  Share2, 
  Tag, 
  ChevronRight, 
  MessageCircle, 
  Bookmark,
  ExternalLink
} from 'lucide-react';
import { toast } from '../store/useNotificationStore';
import { Badge, ProductCard } from '../components/ui';
import { useBlogStore } from '../store/useBlogStore';
import { useProductStore } from '../store/useProductStore';
import { getImageUrl } from '../utils/apiClient';
import { recordTelemetry } from '../utils/telemetry';

const ArticleDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { posts, fetchPosts, getPostBySlug, isLoading: isBlogLoading } = useBlogStore();
  const { products, fetchProducts } = useProductStore();

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const post = getPostBySlug(slug || '');

  useEffect(() => {
    window.scrollTo(0, 0);
    // Fetch data if not already present
    if (posts.length === 0) {
      fetchPosts();
    }
    if (products.length === 0) {
      fetchProducts();
    }
  }, [slug, fetchPosts, fetchProducts, posts.length, products.length]);

  // Only block the whole page if BLOG is loading
  if (isBlogLoading && posts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-on-surface-variant font-display tracking-widest uppercase text-xs">Memuat Insight...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24 text-center px-4 bg-surface">
        <div className="max-w-md">
          <h2 className="font-display text-headline-md text-white mb-4">Edisi Tidak Ditemukan</h2>
          <p className="text-on-surface-variant mb-8">Maaf, artikel yang Anda cari mungkin telah diarsipkan atau dipindahkan ke kategori lain.</p>
          <Link to="/blog" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-surface rounded-full font-display text-sm font-bold hover:bg-primary transition-all duration-300">
            <ArrowLeft className="w-4 h-4" /> Jelajahi Blog
          </Link>
        </div>
      </div>
    );
  }

  const related = posts.filter((p) => p.id !== post.id).slice(0, 3);
  const relatedBikes = products.filter((p) => p.category === 'bike').slice(0, 3);

  const handleShareArticle = async () => {
    const url = window.location.href;
    recordTelemetry('click', {
      path: `/blog/${post.slug}`,
      source: 'direct',
      metadata: {
        contentType: 'article',
        contentSlug: post.slug,
        contentKey: `article:${post.slug}`,
        contentTitle: post.title,
        action: 'share_article',
      },
    });

    if (navigator.share) {
      try {
        await navigator.share({ title: post.title || 'Insight Tridjaya', url });
        return;
      } catch (e) {}
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link Disalin', 'Tautan artikel siap dibagikan.');
  };


  return (
    <div className="bg-surface selection:bg-primary selection:text-surface">
      {/* Reading Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary z-[100] origin-left"
        style={{ scaleX }}
      />

      {/* Nav Overlay (Minimalist) */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-gradient-to-b from-surface to-transparent z-40 pointer-events-none" />

      {/* Editorial Hero */}
      <section className="relative min-h-[60vh] flex items-end pb-12 pt-24 overflow-hidden">
        {/* Parallax Image Placeholder (since I can't do real parallax easily here, I'll use fixed bg) */}
        <div className="absolute inset-0 z-0">
          <img 
            src={getImageUrl(post.heroImage)} 
            alt={post.title || ''} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/10 via-surface/70 to-surface" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/40 via-surface/20 to-transparent" />
          
          {/* Decorative Mesh for Light Mode - fills white space subtly */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />
        </div>

        <div className="container-custom relative z-10">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link to="/blog" className="inline-flex items-center gap-2 text-primary font-display text-xs font-bold uppercase tracking-[0.2em] mb-6 hover:gap-3 transition-all">
                <ArrowLeft className="w-4 h-4" /> Kembali
              </Link>
              
              <div className="flex items-center gap-4 mb-5">
                <span className="w-12 h-px bg-primary/40" />
                <Badge label={post.category || 'News'} variant="primary" size="sm" />
                <span className="font-display text-[10px] text-on-surface-variant uppercase tracking-widest">{post.readTime || 5} min read</span>
              </div>

              <h1 className="font-display text-headline-lg md:text-display-sm lg:text-display-md font-bold text-on-surface mb-8 leading-[1.15] tracking-tight">
                {post.title}
              </h1>

              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full border-2 border-primary/20 p-0.5">
                  <div className="w-full h-full rounded-full gradient-primary flex items-center justify-center font-display text-xs font-bold text-surface">
                    {post.author ? post.author.charAt(0) : 'T'}
                  </div>
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-on-surface">{post.author || 'Tim Tridjaya'}</div>
                  <div className="text-xs text-on-surface-variant">{post.authorRole || 'Editorial'} · {post.publishedAt || 'Terbaru'}</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/4 right-0 w-1/4 h-1/2 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
      </section>

      {/* Main Content Layout */}
      <section className="relative z-20 -mt-16 pb-20">
        <div className="container-custom">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
            
            <aside className="lg:w-16 flex lg:flex-col items-center gap-6 order-2 lg:order-1 pt-4">
              <div className="sticky top-32 flex lg:flex-col items-center gap-6">
                <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest [writing-mode:vertical-lr] hidden lg:block mb-4">
                  Share Article
                </div>
                <button type="button" onClick={handleShareArticle} className="w-12 h-12 rounded-full border border-outline-variant/20 flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-all group">
                  <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    recordTelemetry('click', {
                      path: `/blog/${post.slug}`,
                      source: 'direct',
                      metadata: {
                        contentType: 'article',
                        contentSlug: post.slug,
                        contentKey: `article:${post.slug}`,
                        contentTitle: post.title,
                        action: 'bookmark_article',
                      },
                    });
                  }}
                  className="w-12 h-12 rounded-full border border-outline-variant/20 flex items-center justify-center text-white hover:bg-secondary hover:border-secondary transition-all group"
                >
                  <Bookmark className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
                <a
                  href="#comments"
                  onClick={() => {
                    recordTelemetry('click', {
                      path: `/blog/${post.slug}`,
                      source: 'direct',
                      metadata: {
                        contentType: 'article',
                        contentSlug: post.slug,
                        contentKey: `article:${post.slug}`,
                        contentTitle: post.title,
                        action: 'jump_to_comments',
                      },
                    });
                  }}
                  className="w-12 h-12 rounded-full border border-outline-variant/20 flex items-center justify-center text-white hover:bg-tertiary hover:border-tertiary transition-all group"
                >
                  <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </a>
              </div>
            </aside>

            {/* Content Body */}
            <article className="flex-1 max-w-3xl order-1 lg:order-2">
              <div className="prose prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:tracking-tight prose-p:font-body prose-p:text-on-surface-variant prose-p:leading-[1.8] prose-strong:text-white prose-strong:font-bold prose-img:rounded-3xl">
                
                <p className="text-xl font-display text-white/90 leading-relaxed mb-12 first-letter:text-5xl first-letter:font-bold first-letter:text-primary first-letter:mr-3 first-letter:float-left first-letter:mt-2">
                  {post.excerpt}
                </p>

                <div className="space-y-8">
                  {(post.content || '').split('\n\n').map((paragraph, i) => {
                    const trimmed = paragraph.trim();
                    if (!trimmed) return null;

                    // Handle potential headings in content
                    if (trimmed.startsWith('###')) {
                      return (
                        <h3 key={i} className="text-headline-sm font-bold text-white mt-12 mb-6">
                          {trimmed.replace(/^###\s*/, '')}
                        </h3>
                      );
                    }
                    
                    if (trimmed.startsWith('##')) {
                      return (
                        <h2 key={i} className="text-headline-md font-bold text-white mt-16 mb-8">
                          {trimmed.replace(/^##\s*/, '')}
                        </h2>
                      );
                    }

                    // Handle potential images in content [img:url]
                    if (trimmed.startsWith('[img:') && trimmed.endsWith(']')) {
                      const imageUrl = trimmed.slice(5, -1);
                      return (
                        <div key={i} className="my-12 rounded-3xl overflow-hidden border border-outline-variant/10">
                          <img src={imageUrl} alt="Article visual" className="w-full h-auto object-cover" />
                        </div>
                      );
                    }

                    return (
                      <p key={i} className="text-on-surface-variant">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>

                {/* Dynamic Products CTA */}
                <div className="p-8 rounded-3xl bg-surface-high border border-outline-variant/20 my-16 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <h3 className="font-display text-headline-sm font-bold text-white mb-4 relative z-10">Punya Pertanyaan Mengenai Artikel Ini?</h3>
                  <p className="text-on-surface-variant mb-8 max-w-xl mx-auto relative z-10">
                    Tim ahli kami di Tridjaya Samrat siap membantu Anda memberikan informasi lebih detail mengenai topik di atas.
                  </p>
                  <div className="flex flex-wrap justify-center gap-4 relative z-10">
                    <Link
                      to="/bikes"
                      onClick={() => {
                        recordTelemetry('click', {
                          path: '/bikes',
                          source: 'direct',
                          metadata: {
                            contentType: 'page',
                            contentKey: 'catalog:bike',
                            pageType: 'related_products_cta',
                            pageLabel: 'Lihat Produk Terkait',
                            sourceArticleSlug: post.slug,
                            action: 'open_product_catalog',
                          },
                        });
                      }}
                      className="px-8 py-3 bg-primary text-surface font-display text-sm font-bold rounded-full hover:shadow-neon-cyan transition-all duration-300"
                    >
                      Lihat Produk Terkait
                    </Link>
                    <a
                      href="https://wa.me/6281234567890"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        recordTelemetry('whatsapp_click', {
                          path: `/blog/${post.slug}`,
                          source: 'direct',
                          metadata: {
                            contentType: 'article',
                            contentSlug: post.slug,
                            contentKey: `article:${post.slug}`,
                            contentTitle: post.title,
                            action: 'article_whatsapp_cta',
                          },
                        });
                      }}
                      className="px-8 py-3 border border-outline-variant/30 text-white font-display text-sm font-bold rounded-full hover:bg-white/5 transition-all duration-300"
                    >
                      Tanya via WhatsApp
                    </a>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="flex items-center gap-3 flex-wrap mt-20 pt-10 border-t border-outline-variant/10">
                  <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mr-2 flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" /> Topic tags
                  </div>
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/blog?tag=${encodeURIComponent(tag)}`}
                      onClick={() => {
                        recordTelemetry('click', {
                          path: `/blog?tag=${encodeURIComponent(tag)}`,
                          source: 'direct',
                          metadata: {
                            contentType: 'article',
                            contentSlug: post.slug,
                            contentKey: `article:${post.slug}`,
                            contentTitle: post.title,
                            action: 'filter_by_tag',
                            tag,
                          },
                        });
                      }}
                      className="px-4 py-1.5 rounded-full border border-outline-variant/10 bg-surface-high/30 text-on-surface-variant font-display text-[11px] font-bold uppercase tracking-wider hover:border-primary/50 hover:text-primary transition-all"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            </article>

            {/* Sidebar Right (Author & Recommended) */}
            <aside className="lg:w-80 space-y-12 order-3">
              {/* Author Card Detailed */}
              <div className="p-6 rounded-2xl bg-surface-high/30 border border-outline-variant/10">
                <h5 className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-4">Ditulis Oleh</h5>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full gradient-primary p-0.5">
                    <div className="w-full h-full rounded-full bg-surface border-2 border-surface flex items-center justify-center font-display text-lg font-bold text-white">
                      {post.author.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-white">{post.author}</div>
                    <div className="text-xs text-primary">{post.authorRole}</div>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                  Spesialis Review Produk Kendaraan Listrik dengan pengalaman lebih dari 5 tahun di industri otomotif urban.
                </p>
                <Link
                  to="/tentang"
                  onClick={() => {
                    recordTelemetry('click', {
                      path: '/tentang',
                      source: 'direct',
                      metadata: {
                        contentType: 'page',
                        contentKey: 'about',
                        pageType: 'author_profile_cta',
                        sourceArticleSlug: post.slug,
                        action: 'open_about_page',
                      },
                    });
                  }}
                  className="text-xs font-bold text-white hover:text-primary transition-colors flex items-center gap-1"
                >
                  Lihat Profil <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Related Posts Minimalist */}
              <div>
                <h5 className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-6">Artikel Terkait</h5>
                <div className="space-y-6">
                  {related.map((p) => (
                    <Link
                      key={p.id}
                      to={`/blog/${p.slug}`}
                      onClick={() => {
                        recordTelemetry('click', {
                          path: `/blog/${p.slug}`,
                          source: 'direct',
                          metadata: {
                            contentType: 'article',
                            contentSlug: p.slug,
                            contentKey: `article:${p.slug}`,
                            contentTitle: p.title,
                            action: 'open_related_article',
                            sourceArticleSlug: post.slug,
                          },
                        });
                      }}
                      className="group block"
                    >
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-surface-high border border-outline-variant/10">
                          <img src={getImageUrl(p.heroImage)} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div>
                          <h6 className="text-sm font-bold text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {p.title}
                          </h6>
                          <div className="text-[10px] text-on-surface-variant uppercase mt-2 font-display">{p.publishedAt}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Newsletter Placeholder */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-primary/5 border border-outline-variant/10 relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                <h5 className="font-display font-bold text-white mb-2">Tridjaya Samrat Insight</h5>
                <p className="text-xs text-on-surface-variant mb-4">Dapatkan tips perawatan dan info promo eksklusif langsung ke email Anda.</p>
                <div className="relative">
                  <input 
                    type="email" 
                    placeholder="Alamat email" 
                    className="w-full bg-surface/50 border border-outline-variant/20 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button className="absolute right-1 top-1 bottom-1 px-3 bg-primary text-surface rounded-md font-bold text-[10px] hover:bg-white transition-all">
                    Gabung
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Featured Products Footer */}
      <section className="py-32 bg-surface relative overflow-hidden">
        <div className="container-custom relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-xl">
              <h2 className="font-display text-headline-md md:text-headline-lg font-bold text-white mb-4">Rekomendasi Produk Terkait</h2>
              <p className="text-on-surface-variant">Berdasarkan artikel yang Anda baca, unit-unit di bawah ini mungkin cocok untuk kebutuhan mobilitas Anda.</p>
            </div>
            <Link
              to="/bikes"
              onClick={() => {
                recordTelemetry('click', {
                  path: '/bikes',
                  source: 'direct',
                  metadata: {
                    contentType: 'page',
                    contentKey: 'catalog:bike',
                    pageType: 'featured_products_footer_cta',
                    sourceArticleSlug: post.slug,
                    action: 'open_product_catalog',
                  },
                });
              }}
              className="px-8 py-3 bg-surface-high text-white rounded-full font-display text-sm font-bold border border-outline-variant/20 hover:bg-white hover:text-surface transition-all duration-300 flex items-center gap-2 w-fit"
            >
              Lihat Katalog Lengkap <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {relatedBikes.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
        
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-2/3 bg-primary/5 blur-[160px] rounded-full pointer-events-none" />
      </section>

      {/* Final CTA Strip */}
      <div className="bg-primary py-4 text-center">
        <div className="container-custom">
          <p className="font-display text-xs font-bold text-surface uppercase tracking-[0.3em]">
            Tridjaya Samrat · Partner Mobilitas Urban Terpercaya Sejak 2020
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetailPage;
