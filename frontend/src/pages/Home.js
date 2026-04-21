import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Package, TrendingUp, Users } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Auto-redirect approved users to their dashboard
  useEffect(() => {
    if (user && user.status === 'approved') {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'seller') navigate('/seller');
      else if (user.role === 'buyer') navigate('/dashboard');
      else if (user.role === 'both') navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch live stats silently
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [productsRes, bidsRes] = await Promise.allSettled([
          axios.get(`${API}/products`),
          axios.get(`${API}/bids/summary`),
        ]);

        const activeListings =
          productsRes.status === 'fulfilled'
            ? (productsRes.value.data || []).filter(
                (p) => p.listing_status === 'active'
              ).length
            : null;

        const bidsToday =
          bidsRes.status === 'fulfilled' &&
          bidsRes.value.data?.today != null
            ? bidsRes.value.data.today
            : null;

        const traders =
          productsRes.status === 'fulfilled'
            ? (() => {
                const sellerIds = new Set(
                  (productsRes.value.data || []).map((p) => p.seller_id).filter(Boolean)
                );
                return sellerIds.size > 0 ? sellerIds.size : null;
              })()
            : null;

        setStats({ activeListings, bidsToday, traders });
      } catch {
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Build stat items from whatever succeeded
  const statItems = [];
  if (stats?.traders != null)
    statItems.push({ icon: Users, label: 'Traders', value: stats.traders });
  if (stats?.bidsToday != null)
    statItems.push({ icon: TrendingUp, label: 'Bids Today', value: stats.bidsToday });
  if (stats?.activeListings != null)
    statItems.push({ icon: Package, label: 'Active Listings', value: stats.activeListings });

  const showStats = !statsLoading && statItems.length > 0;
  const showSkeleton = statsLoading;

  return (
    <div data-testid="home-page" className="pt-20">
      {/* ─── Hero ─── */}
      <section
        className="min-h-screen flex items-center pt-20"
        data-testid="hero-section"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* Left: Copy + CTA + Stats */}
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

              {/* Buttons */}
              <div className="flex flex-wrap gap-4 mb-10">
                <Link
                  to="/products"
                  data-testid="hero-cta-products"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-primary/90 transition-colors"
                >
                  View Products
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/contact"
                  data-testid="hero-cta-contact"
                  className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-secondary/80 transition-colors"
                >
                  Contact Us
                </Link>
              </div>

              {/* ─── Stats Bar ─── */}
              {showSkeleton && (
                <div className="flex items-center gap-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 w-28 bg-muted rounded-lg" />
                  ))}
                </div>
              )}

              {showStats && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="inline-flex flex-wrap items-center gap-px bg-border rounded-xl overflow-hidden border border-border"
                >
                  {statItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 px-5 py-3 bg-white ${
                        idx < statItems.length - 1 ? 'border-r border-border' : ''
                      }`}
                    >
                      <item.icon size={15} className="text-primary flex-shrink-0" />
                      <div className="leading-tight">
                        <p className="text-sm font-bold text-foreground tabular-nums">
                          {item.value.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {item.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
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
    </div>
  );
};

export default Home;
