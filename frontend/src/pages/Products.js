import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Package, TrendingUp, Award, ChevronLeft, ChevronRight, Search, X, Timer } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API}/files/${path}`;
};

const isVideoPath = (path) => {
  const lower = (path || '').toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov');
};

// Countdown timer displayed on product cards
const CountdownTimer = ({ endTime, status }) => {
  const calc = () => {
    if (!endTime || status !== 'active') return null;
    const diff = new Date(endTime) - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, diff };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    if (!endTime || status !== 'active') return;
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  });

  if (status === 'sold') {
    return (
      <div className="absolute inset-0 bg-blue-600/80 flex items-center justify-center">
        <span className="text-white font-serif text-3xl font-bold tracking-widest">SOLD</span>
      </div>
    );
  }
  if (status === 'expired' || (status === 'active' && !time)) {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-orange-600/90 text-white text-center py-2 text-xs font-semibold tracking-wide">
        BIDDING CLOSED
      </div>
    );
  }
  if (!time) return null;

  const urgent = time.diff < 30 * 60 * 1000; // < 30 min
  return (
    <div className={`absolute bottom-0 left-0 right-0 ${urgent ? 'bg-red-600/90' : 'bg-green-700/85'} text-white py-2 px-3 flex items-center gap-2`}>
      <Timer size={13} className={urgent ? 'animate-pulse' : ''} />
      <span className={`text-xs font-semibold ${urgent ? 'animate-pulse' : ''}`}>
        {String(time.h).padStart(2,'0')}:{String(time.m).padStart(2,'0')}:{String(time.s).padStart(2,'0')} remaining
      </span>
    </div>
  );
};

const MediaGallery = ({ mediaPaths, imageUrl, name }) => {
  const paths = mediaPaths && mediaPaths.length > 0 ? mediaPaths : (imageUrl ? [imageUrl] : []);

  // Always start on the first image, not necessarily index 0 (which could be a video)
  const firstImageIdx = paths.findIndex((p) => !isVideoPath(p));
  const [current, setCurrent] = useState(firstImageIdx >= 0 ? firstImageIdx : 0);

  // No media at all, or everything is a video → show placeholder
  if (paths.length === 0 || firstImageIdx < 0) {
    return (
      <div className="w-full h-80 bg-primary/10 flex flex-col items-center justify-center gap-2">
        <span className="text-5xl select-none">🌿</span>
        <span className="text-xs font-medium text-primary/60 uppercase tracking-wide">Cardamom</span>
      </div>
    );
  }

  const src = getMediaUrl(paths[current]);
  const video = isVideoPath(paths[current]);

  return (
    <div className="relative group">
      {video ? (
        <video src={src} controls className="w-full h-80 object-cover bg-black" />
      ) : (
        <img src={src} alt={name} className="w-full h-80 object-cover" />
      )}
      {paths.length > 1 && (
        <>
          <button onClick={(e) => { e.preventDefault(); setCurrent((current - 1 + paths.length) % paths.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft size={18} />
          </button>
          <button onClick={(e) => { e.preventDefault(); setCurrent((current + 1) % paths.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {paths.map((_, i) => (
              <button key={i} onClick={(e) => { e.preventDefault(); setCurrent(i); }} className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Availability bar component
const AvailabilityBar = ({ total, remaining }) => {
  if (!total || total <= 0) return null;
  const rem = remaining ?? total;
  const pct = Math.max(0, Math.min(100, Math.round((rem / total) * 100)));
  const isLow = pct < 20;
  const isMid = pct >= 20 && pct <= 50;
  const barColor = isLow ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-green-500';
  const textColor = isLow ? 'text-red-600' : isMid ? 'text-amber-600' : 'text-green-700';
  return (
    <div className="mt-2 mb-1">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">Availability</span>
        <span className={`font-semibold ${textColor}`}>
          {isLow ? `Only ${rem.toLocaleString('en-IN')} kg left!` : `${rem.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} kg`}
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGrade, setActiveGrade] = useState('all');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API}/products`);
        setProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Extract unique grades from products
  const grades = useMemo(() => {
    const uniqueGrades = [...new Set(products.map(p => p.size))];
    return uniqueGrades.sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeGrade !== 'all') {
      result = result.filter(p => p.size === activeGrade);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q) ||
        (p.seller_name && p.seller_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [products, activeGrade, searchQuery]);

  if (loading) {
    return (
      <div data-testid="products-loading" className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div data-testid="products-page" className="pt-20">
      {/* Hero */}
      <section className="py-24 bg-muted" data-testid="products-hero">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6">Our Collection</p>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tight leading-tight mb-6 text-foreground">Green Cardamom Varieties</h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Premium quality Green Cardamom (Elettaria cardamomum) in three different size grades to meet diverse market requirements.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="py-8 border-b border-border" data-testid="products-filter-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                data-testid="products-search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, grade, or seller..."
                className="w-full pl-10 pr-9 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  data-testid="products-search-clear"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Grade Filter Pills */}
            <div className="flex flex-wrap gap-2" data-testid="products-grade-filters">
              <button
                data-testid="grade-filter-all"
                onClick={() => setActiveGrade('all')}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                  activeGrade === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                All Grades ({products.length})
              </button>
              {grades.map(grade => (
                <button
                  key={grade}
                  data-testid={`grade-filter-${grade}`}
                  onClick={() => setActiveGrade(grade)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                    activeGrade === grade
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }`}
                >
                  {grade} ({products.filter(p => p.size === grade).length})
                </button>
              ))}
            </div>
          </div>

          {/* Active filter summary */}
          {(activeGrade !== 'all' || searchQuery) && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" data-testid="products-filter-summary">
              <span>Showing {filteredProducts.length} of {products.length} products</span>
              {(activeGrade !== 'all' || searchQuery) && (
                <button
                  onClick={() => { setActiveGrade('all'); setSearchQuery(''); }}
                  data-testid="products-clear-all-filters"
                  className="text-primary text-xs font-semibold hover:underline ml-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-24" data-testid="products-grid">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16" data-testid="products-no-results">
              <Package className="mx-auto text-muted-foreground mb-4" size={48} />
              <p className="text-lg text-muted-foreground mb-2">No products found</p>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? `No results for "${searchQuery}"` : 'No products match the selected grade.'}
              </p>
              <button
                onClick={() => { setActiveGrade('all'); setSearchQuery(''); }}
                className="text-primary font-semibold text-sm hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  data-testid={`product-card-${index}`}
                  className="product-card bg-white rounded-lg overflow-hidden border border-primary/10"
                >
                  <Link to={`/products/${product.id}`} className="block cursor-pointer">
                    <div className="relative">
                      <MediaGallery mediaPaths={product.media_paths} imageUrl={product.image_url} name={product.name} />
                      <CountdownTimer endTime={product.bid_end_time} status={product.listing_status} />
                    </div>
                    <div className="p-8">
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-sans tracking-wide uppercase font-medium rounded-full">
                          {product.size}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Leaf size={14} /> Elettaria cardamomum
                        </span>
                        {product.listing_status === 'sold' && (
                          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Sold</span>
                        )}
                      </div>
                      <h3 className="font-serif text-2xl md:text-3xl font-semibold mb-3 text-foreground">{product.name}</h3>

                      {/* Seller info */}
                      {product.seller_name && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-foreground">Sold by {product.seller_name}</p>
                          {product.seller_company && (
                            <p className="text-xs text-muted-foreground">{product.seller_company}</p>
                          )}
                        </div>
                      )}

                      {/* Pricing row */}
                      {product.base_price && (
                        <div className="flex items-center gap-4 mb-1 py-2 border-t border-border/60">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Base Price</p>
                            <p className="text-sm font-bold text-foreground">
                              {product.base_price_currency === 'USD' ? '$' : '₹'}{product.base_price.toLocaleString('en-IN')}/kg
                            </p>
                          </div>
                          {product.minimum_quantity_kg && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Min. Qty</p>
                              <p className="text-sm font-bold text-foreground">{product.minimum_quantity_kg} kg</p>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Availability bar */}
                      {product.total_quantity_kg > 0 && product.listing_status === 'active' && (
                        <div className="mb-3 pb-2 border-b border-border/60">
                          <AvailabilityBar total={product.total_quantity_kg} remaining={product.remaining_quantity_kg} />
                        </div>
                      )}

                      <p className="text-muted-foreground leading-relaxed mb-4 line-clamp-3">{product.description}</p>
                      {product.listing_status === 'sold' ? (
                        <span className="text-blue-600 text-sm font-semibold">View Details</span>
                      ) : product.listing_status === 'expired' ? (
                        <span className="text-orange-600 text-sm font-semibold">Bidding Closed</span>
                      ) : (
                        <span className="text-primary text-sm font-semibold hover:underline">View Details & Place Bid</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-24 bg-muted" data-testid="why-choose-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-6 text-foreground">Why Choose Our Cardamom?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: Award, title: 'Premium Quality', description: 'Hand-selected from the finest plantations' },
              { icon: Package, title: 'Export Ready', description: 'Meeting international packaging standards' },
              { icon: TrendingUp, title: 'Consistent Supply', description: 'Reliable year-round availability' },
              { icon: Leaf, title: 'Sustainable', description: 'Environmentally conscious cultivation' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                data-testid={`why-choose-${index}`}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                  <item.icon size={28} />
                </div>
                <h3 className="font-serif text-xl font-semibold mb-2 text-foreground">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Products;
