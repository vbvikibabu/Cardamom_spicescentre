import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Timer, Package } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getProductImage } from '../utils/imageHelper';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API}/files/${path}`;
};

// ─── Mini countdown chip for product cards ───────────────────────────────────
const CountdownChip = ({ endTime, status }) => {
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
  if (!time) return null;
  const urgent = time.diff < 30 * 60 * 1000;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full ${
        urgent ? 'bg-red-600 text-white animate-pulse' : 'bg-green-700/90 text-white'
      }`}
    >
      <Timer size={9} />
      {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
    </span>
  );
};

// ─── Skeleton placeholder card ───────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-border overflow-hidden animate-pulse">
    <div className="w-full h-52 bg-gray-200" />
    <div className="p-5 space-y-3">
      <div className="h-3.5 bg-gray-200 rounded w-1/3" />
      <div className="h-5 bg-gray-200 rounded w-2/3" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="pt-2 h-8 bg-gray-200 rounded" />
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [liveEvent, setLiveEvent] = useState(null);
  const [upcomingEvent, setUpcomingEvent] = useState(null);

  // FIX 4 — Auto-redirect approved users to their dashboard
  useEffect(() => {
    if (user && user.status === 'approved') {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'seller') navigate('/seller');
      else if (user.role === 'buyer') navigate('/dashboard');
      else if (user.role === 'both') navigate('/dashboard');
    }
  }, [user, navigate]);

  // FIX 1 — Fetch live product listings (max 3 active)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get(`${API}/products`);
        const active = (res.data || [])
          .filter((p) => p.listing_status === 'active')
          .slice(0, 3);
        setProducts(active);
      } catch {
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // FIX 2 — Poll for live/upcoming auction events every 30s
  useEffect(() => {
    const checkAuction = async () => {
      try {
        const res = await axios.get(`${API}/auction/events/upcoming`);
        const events = res.data || [];
        setLiveEvent(events.find(e => e.status === 'live') || null);
        setUpcomingEvent(
          events.find(e => e.status === 'upcoming' || e.status === 'registration_open') || null
        );
      } catch {
        setLiveEvent(null);
        setUpcomingEvent(null);
      }
    };
    checkAuction();
    const interval = setInterval(checkAuction, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div data-testid="home-page" className="pt-20 pb-20 md:pb-0">

      {/* FIX 2 — Live / upcoming auction flash banner */}
      {liveEvent && (
        <div className="bg-red-600 text-white flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-ping flex-shrink-0" />
            🔴 LIVE NOW: {liveEvent.title}
          </span>
          <Link
            to={`/auctions/${liveEvent.id}`}
            className="bg-white text-red-600 text-xs font-bold px-3 py-1 rounded-full hover:bg-red-50 transition-colors flex-shrink-0 ml-3"
          >
            Join Now →
          </Link>
        </div>
      )}
      {!liveEvent && upcomingEvent && (
        <div className="bg-amber-500 text-white flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
          <span className="flex items-center gap-2">
            🔔 Upcoming Auction: {upcomingEvent.title}
            {upcomingEvent.status === 'registration_open' && (
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">Registration Open</span>
            )}
          </span>
          <Link
            to="/auctions"
            className="bg-white text-amber-600 text-xs font-bold px-3 py-1 rounded-full hover:bg-amber-50 transition-colors flex-shrink-0 ml-3"
          >
            View Details →
          </Link>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ HERO ═══ */}
      <section className="flex items-center" data-testid="hero-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* Left: Copy + CTA */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6"
              >
                Premium Export Quality
              </motion.p>

              <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl tracking-tight leading-[0.9] mb-6 text-foreground">
                The Queen of Spices
              </h1>

              <p className="text-base md:text-lg font-sans leading-relaxed text-muted-foreground mb-10 max-w-md">
                Premium Green Cardamom — graded, certified, export ready.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/products"
                  data-testid="hero-cta-products"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-primary/90 transition-colors"
                >
                  View Products <ArrowRight size={16} />
                </Link>
                <Link
                  to="/contact"
                  data-testid="hero-cta-contact"
                  className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-secondary/80 transition-colors"
                >
                  Contact Us
                </Link>
              </div>
            </motion.div>

            {/* Right: Hero image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative h-[400px] md:h-[500px] lg:h-[600px]"
            >
              <img
                src="https://customer-assets.emergentagent.com/job_21ff2258-a2aa-405e-b346-3b2451a93f14/artifacts/br03ic3s_perennial-no-yes-elaichi-plant-h-01-1-platone-original-imahcut3yswvgzg8.jpeg"
                alt="Fresh cardamom plant"
                className="hero-image w-full h-full object-cover rounded-lg shadow-sm"
              />
            </motion.div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ LIVE LISTINGS ═══ */}
      <section className="py-10 mt-6 bg-muted" data-testid="live-listings-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">

          {/* Section header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-amber-600 mb-3">
                Our Range
              </p>
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight text-foreground">
                Live Listings
              </h2>
            </div>
            <Link
              to="/products"
              data-testid="view-all-products-link"
              className="hidden md:inline-flex items-center gap-2 text-primary font-sans text-sm tracking-wide uppercase font-medium hover:gap-3 transition-all"
            >
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {/* Loading skeletons */}
          {productsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!productsLoading && products.length === 0 && (
            <div className="text-center py-20" data-testid="no-live-listings">
              <Package className="mx-auto text-muted-foreground mb-4" size={48} />
              <p className="text-lg text-muted-foreground font-medium">No active listings right now.</p>
              <p className="text-sm text-muted-foreground mt-1">Check back soon!</p>
            </div>
          )}

          {/* Product cards grid */}
          {!productsLoading && products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {products.map((product, idx) => {
                const imgSrc = getProductImage(product);
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    viewport={{ once: true }}
                    data-testid={`home-product-card-${idx}`}
                    className="product-card bg-white rounded-xl overflow-hidden border border-primary/10 hover:border-primary/30 transition-colors"
                  >
                    <Link to={`/products/${product.id}`} className="block">
                      {/* Image — smart selection: first image in media_paths, then image_url, then placeholder */}
                      <div className="relative overflow-hidden">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={product.name}
                            className="w-full h-52 object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-52 bg-primary/10 flex flex-col items-center justify-center gap-2">
                            <span className="text-4xl select-none">🌿</span>
                            <span className="text-xs font-medium text-primary/60 uppercase tracking-wide">Cardamom</span>
                          </div>
                        )}
                        {/* Live countdown chip */}
                        <div className="absolute bottom-2 left-2">
                          <CountdownChip
                            endTime={product.bid_end_time}
                            status={product.listing_status}
                          />
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-5">
                        {/* Size badge */}
                        <div className="mb-3">
                          <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-sans tracking-wide uppercase font-medium rounded-full">
                            {product.size}
                          </span>
                        </div>

                        {/* Name */}
                        <h3 className="font-serif text-xl font-semibold text-foreground mb-2 leading-snug">
                          {product.name}
                        </h3>

                        {/* Seller */}
                        {product.seller_name && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Sold by{' '}
                            <span className="font-semibold text-foreground">
                              {product.seller_name}
                            </span>
                            {product.seller_company ? ` | ${product.seller_company}` : ''}
                          </p>
                        )}

                        {/* Pricing row */}
                        {(product.base_price || product.minimum_quantity_kg) && (
                          <div className="flex items-center gap-4 py-2.5 border-t border-border/60 mb-3">
                            {product.base_price && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                  Base Price
                                </p>
                                <p className="text-sm font-bold text-foreground">
                                  {product.base_price_currency === 'USD' ? '$' : '₹'}
                                  {product.base_price.toLocaleString('en-IN')}
                                  <span className="font-normal text-muted-foreground">/kg</span>
                                </p>
                              </div>
                            )}
                            {product.minimum_quantity_kg && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                  Min. Qty
                                </p>
                                <p className="text-sm font-bold text-foreground">
                                  {product.minimum_quantity_kg}{' '}
                                  <span className="font-normal text-muted-foreground">kg</span>
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* CTA */}
                        <span className="text-primary text-sm font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                          View Details &amp; Bid <ArrowRight size={14} />
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Mobile "View All" button */}
          <div className="md:hidden mt-8 text-center">
            <Link
              to="/products"
              data-testid="view-all-products-link-mobile"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium"
            >
              View All Products <ArrowRight size={16} />
            </Link>
          </div>

        </div>
      </section>

    </div>
  );
};

export default Home;
