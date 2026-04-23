import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ArrowLeft, Share2, Tag } from 'lucide-react';
import { toast } from '../store/useNotificationStore';
import { blogPosts } from '../data';
import { Badge, ProductCard } from '../components/ui';
import { products } from '../data';

const ArticleDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <div className="text-center">
          <p className="font-display text-headline-md text-on-surface-variant mb-4">Artikel tidak ditemukan</p>
          <Link to="/blog" className="flex items-center gap-2 px-6 py-3 gradient-primary rounded-xl font-body text-body-md font-bold text-surface mx-auto w-fit">
            Kembali ke Blog
          </Link>
        </div>
      </div>
    );
  }

  const related = blogPosts.filter((p) => p.id !== post.id).slice(0, 2);
  const relatedBikes = products.filter((p) => p.category === 'bike').slice(0, 3);

  const handleShareArticle = async () => {
    const url = window.location.href;
    const shareData = {
      title: post.title,
      text: post.excerpt,
      url,
    };

    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success('Link Artikel Berhasil Disalin', 'Anda dapat membagikannya melalui media sosial.');
  };

  const articleContent = `
    Memilih sepeda listrik yang tepat adalah keputusan penting yang membutuhkan pertimbangan matang. 
    Dalam artikel ini, kita akan membahas secara mendalam dua pilihan terpopuler dari Tridjaya Samrat: 
    Goda GD120 dan Winfly W200.
    
    **Performa & Tenaga**
    
    Goda GD120 hadir dengan motor BLDC 750W yang menghasilkan akselerasi responsif dan cocok untuk 
    penggunaan di berbagai medan perkotaan. Winfly W200 dengan motor 500W menawarkan keseimbangan sempurna 
    antara efisiensi tenaga dan kenyamanan berkendara.
    
    **Jangkauan & Baterai**
    
    GD120 unggul dengan jangkauan 45 km per charge berkat sistem manajemen daya revolusioner. 
    Winfly W200 memberikan jangkauan hingga 35 km — sangat ideal untuk komuter harian urban.
    
    **Kesimpulan**
    
    Jika Anda mencari daya angkut lebih kuat dan jangkauan ekstra, pilih Goda GD120. 
    Untuk mobilitas harian yang ringan dan gesit, Winfly W200 adalah partner setia Anda.
  `;

  return (
    <>
      {/* Hero */}
      <section className="relative pt-24 pb-0 overflow-hidden">
        <div className="relative h-[50vh] min-h-[400px]">
          <img src={post.heroImage} alt={post.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-surface/10" />
        </div>
      </section>

      {/* Article */}
      <section className="pb-20 bg-surface/90 backdrop-blur-sm">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto -mt-24 relative z-10">
            {/* Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-8 md:p-10 mb-10"
            >
              {/* Back */}
              <Link to="/blog" className="inline-flex items-center gap-2 font-body text-body-md text-on-surface-variant hover:text-primary transition-colors mb-6">
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Blog
              </Link>

              {/* Meta */}
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <Badge label={post.category} variant="primary" size="sm" />
                <span className="font-body text-body-sm text-on-surface-variant">{post.publishedAt}</span>
                <span className="font-body text-body-sm text-on-surface-variant flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />{post.readTime} menit baca
                </span>
              </div>

              <h1 className="font-display text-headline-lg font-bold text-white mb-4 leading-tight">{post.title}</h1>
              <p className="font-body text-body-lg text-on-surface-variant leading-relaxed mb-6 italic">{post.excerpt}</p>

              {/* Author */}
              <div className="flex items-center gap-3 pb-6 border-b border-outline-variant/20 mb-8">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-display text-title-sm font-bold text-surface">
                  {post.author.charAt(0)}
                </div>
                <div>
                  <div className="font-body text-body-md font-semibold text-white">{post.author}</div>
                  <div className="font-body text-body-sm text-on-surface-variant">{post.authorRole}</div>
                </div>
                <button
                  type="button"
                  onClick={handleShareArticle}
                  className="ml-auto w-9 h-9 glass-dark rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                  aria-label="Bagikan artikel"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="prose prose-invert prose-lg max-w-none">
                {articleContent.split('\n\n').map((paragraph, i) => {
                  if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                    return (
                      <h2 key={i} className="font-display text-headline-sm font-bold text-white mt-8 mb-3">
                        {paragraph.replace(/\*\*/g, '')}
                      </h2>
                    );
                  }
                  return (
                    <p key={i} className="font-body text-body-lg text-on-surface-variant leading-relaxed mb-4">
                      {paragraph.trim()}
                    </p>
                  );
                })}
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap mt-8 pt-6 border-t border-outline-variant/20">
                <Tag className="w-4 h-4 text-on-surface-variant" />
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="px-3 py-1 rounded-lg glass-dark text-on-surface-variant font-body text-body-sm hover:text-primary transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Related posts */}
            {related.length > 0 && (
              <div className="mb-12">
                <h3 className="font-display text-headline-sm font-bold text-white mb-6">Artikel Terkait</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {related.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Link to={`/blog/${p.slug}`} className="group block glass-card rounded-xl p-4 hover:shadow-neon-cyan transition-all duration-300">
                        <Badge label={p.category} variant="primary" size="sm" />
                        <h4 className="font-display text-title-sm font-bold text-white mt-2 mb-1 group-hover:text-primary transition-colors line-clamp-2">{p.title}</h4>
                        <p className="font-body text-body-sm text-on-surface-variant line-clamp-2">{p.excerpt}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Related products */}
          <div className="max-w-5xl mx-auto">
            <h3 className="font-display text-headline-sm font-bold text-white mb-6 text-center">Produk yang Dibahas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedBikes.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ArticleDetailPage;
