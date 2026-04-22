import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Gavel, ArrowRight, ShoppingBag } from 'lucide-react';
import { getProductImage } from '../utils/imageHelper';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getGreeting = (firstName) => {
  const h = new Date().getHours();
  const name = firstName || 'there';
  if (h < 12) return `Good morning, ${name} 👋`;
  if (h < 17) return `Good afternoon, ${name} 👋`;
  return `Good evening, ${name} 👋`;
};

const getStatusMsg = (bids) => {
  const pending = bids.filter(b => b.status === 'pending').length;
  const accepted = bids.filter(b => b.status === 'accepted').length;
  if (accepted > 0) return `🎉 You have ${accepted} accepted bid${accepted > 1 ? 's' : ''}!`;
  if (pending > 0) return `⏳ ${pending} bid${pending > 1 ? 's' : ''} awaiting seller review.`;
  if (bids.length > 0) return 'Browse new listings and place your next bid.';
  return 'Ready to source premium cardamom? Browse our active listings.';
};

const statusBadge = (status) => {
  const map = {
    pending:  'bg-amber-100 text-amber-700 border-amber-200',
    accepted: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };
  return map[status] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const BuyerDashboard = () => {
  const { user, token, isApproved } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isApproved) { navigate('/pending-approval'); return; }
    fetchData();
  }, [isApproved, navigate]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/buyer/bids`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBids(res.data);
    } catch {
      toast.error('Failed to load bids');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  const firstName = user?.full_name?.split(' ')[0];
  const greeting = getGreeting(firstName);
  const statusMsg = getStatusMsg(bids);

  const filterCounts = {
    all:      bids.length,
    pending:  bids.filter(b => b.status === 'pending').length,
    accepted: bids.filter(b => b.status === 'accepted').length,
    rejected: bids.filter(b => b.status === 'rejected').length,
  };
  const filteredBids = filter === 'all' ? bids : bids.filter(b => b.status === filter);

  return (
    <div data-testid="buyer-dashboard" className="min-h-screen bg-muted pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-12">

        {/* ── Header row ── */}
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-foreground mb-1">{greeting}</h1>
            <p className="text-sm text-muted-foreground">{statusMsg}</p>
          </div>
          {/* FIX 7 — small role switch pill, only for "both" */}
          {user?.role === 'both' && (
            <Link
              to="/seller"
              data-testid="switch-to-seller-btn"
              className="flex-shrink-0 text-xs font-semibold text-primary border border-primary/60 px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors whitespace-nowrap"
            >
              Switch to Seller →
            </Link>
          )}
        </div>

        {/* ── Quick action buttons (small, single row) ── */}
        <div className="flex gap-3 mb-6">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <ShoppingBag size={15} /> Browse Products
          </Link>
          <div className="inline-flex items-center gap-2 bg-white border border-border px-4 py-2 rounded-full text-sm font-medium text-foreground">
            <Gavel size={15} className="text-primary" /> {bids.length} Bid{bids.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Bids section ── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">My Bids</h2>
            <Link
              to="/products"
              className="hidden md:inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:gap-2 transition-all"
            >
              Browse Products <ArrowRight size={14} />
            </Link>
          </div>

          {/* Filter pills */}
          {bids.length > 0 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-border scrollbar-none">
              {['all', 'pending', 'accepted', 'rejected'].map(f => {
                const active = filter === f;
                const label = f.charAt(0).toUpperCase() + f.slice(1);
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-shrink-0 h-9 px-4 rounded-full text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 border ${
                      active
                        ? 'bg-green-800 text-white border-green-800'
                        : 'bg-white border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                    }`}
                  >
                    {label}
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                      active ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {filterCounts[f]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="p-4 md:p-6">
            {bids.length === 0 ? (
              <div className="text-center py-12">
                <Gavel className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground mb-1 font-medium">No bids placed yet</p>
                <p className="text-sm text-muted-foreground mb-4">Browse active listings and place your first bid!</p>
                <Link
                  to="/products"
                  data-testid="buyer-browse-products"
                  className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Browse Products <ArrowRight size={14} />
                </Link>
              </div>
            ) : filteredBids.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground">No {filter} bids.</p>
                <button onClick={() => setFilter('all')} className="mt-2 text-primary text-sm font-semibold hover:underline">
                  Show all bids
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBids.map(b => {
                  const qty = [
                    b.quantity_kg && `${b.quantity_kg} kg`,
                    b.quantity_lot && `${b.quantity_lot} lots`,
                  ].filter(Boolean).join(' · ');
                  const price = b.price_per_kg
                    ? `${b.currency} ${b.price_per_kg}/kg`
                    : b.price_per_lot
                    ? `${b.currency} ${b.price_per_lot}/lot`
                    : null;

                  return (
                    <Link
                      key={b.id}
                      to={`/products/${b.product_id}`}
                      data-testid={`buyer-bid-${b.id}`}
                      className="flex items-center gap-3 p-3 border border-border rounded-xl hover:border-primary/40 transition-colors group"
                    >
                      {/* Product thumbnail */}
                      {(() => {
                        const imgSrc = getProductImage({
                          image_url: b.product_image_url,
                          media_paths: b.product_media_paths || []
                        });
                        return imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={b.product_name}
                            className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl select-none">🌿</span>
                          </div>
                        );
                      })()}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{b.product_name}</p>
                          <span className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${statusBadge(b.status)}`}>
                            {b.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-0.5">{b.product_size}</p>
                        {b.seller_name && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            Seller: <span className="font-medium text-foreground">{b.seller_name}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {price && (
                            <span className="text-[12px] font-bold text-green-700">{price}</span>
                          )}
                          {qty && (
                            <span className="text-[11px] text-muted-foreground">· {qty}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{b.bid_date}</p>
                      </div>

                      <ArrowRight size={14} className="text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BuyerDashboard;
