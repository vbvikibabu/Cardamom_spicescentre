import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Gavel, ArrowRight, Home, ShoppingBag, Megaphone, User, Trophy } from 'lucide-react';
import { getProductImage } from '../utils/imageHelper';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getGreeting = (firstName) => {
  const h = new Date().getHours();
  const name = firstName || 'there';
  if (h < 12) return `Good morning, ${name} 👋`;
  if (h < 17) return `Good afternoon, ${name} 👋`;
  return `Good evening, ${name} 👋`;
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
  const [wonLots, setWonLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('bids'); // 'bids' | 'won'
  const [becomingSellerLoading, setBecomingSellerLoading] = useState(false);

  useEffect(() => {
    if (!isApproved) { navigate('/pending-approval'); return; }
    fetchData();
  }, [isApproved, navigate]);

  const fetchData = async () => {
    try {
      const [bidsRes, wonRes] = await Promise.all([
        axios.get(`${API_URL}/api/buyer/bids`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/buyer/won-lots`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setBids(bidsRes.data);
      setWonLots(wonRes.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleBecomeSeller = async () => {
    if (!window.confirm('Add seller access to your account? You\'ll be able to list lots in future auctions.')) return;
    setBecomingSellerLoading(true);
    try {
      await axios.patch(`${API_URL}/api/users/me/become-seller`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Seller access added! Please log out and back in to see your Seller dashboard.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upgrade account');
    } finally {
      setBecomingSellerLoading(false);
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

  const filterCounts = {
    all:      bids.length,
    pending:  bids.filter(b => b.status === 'pending').length,
    accepted: bids.filter(b => b.status === 'accepted').length,
    rejected: bids.filter(b => b.status === 'rejected').length,
  };
  const filteredBids = filter === 'all' ? bids : bids.filter(b => b.status === filter);

  return (
    <div data-testid="buyer-dashboard" className="min-h-screen bg-[#f5f0e8] pt-20">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-1 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#1a3a1a]">{greeting}</h1>
              <span className="text-[11px] font-bold bg-[#2d5a27] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                Buyer
              </span>
              {wonLots.length > 0 && (
                <span className="text-[11px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                  🏆 {wonLots.length} Won
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5 text-gray-500">
              {filterCounts.pending > 0
                ? `⏳ ${filterCounts.pending} pending · ${filterCounts.accepted} accepted bids`
                : filterCounts.accepted > 0
                  ? `🎉 ${filterCounts.accepted} accepted bids`
                  : `${bids.length} bids placed`}
            </p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0 items-end">
            {user?.role === 'both' && (
              <Link
                to="/seller"
                data-testid="switch-to-seller-btn"
                className="text-xs font-semibold text-[#2d5a27] border border-[#2d5a27]/60 px-3 py-1.5 rounded-full hover:bg-[#2d5a27]/5 transition-colors whitespace-nowrap"
              >
                Switch to Seller →
              </Link>
            )}
            {user?.role === 'buyer' && (
              <button
                type="button"
                onClick={handleBecomeSeller}
                disabled={becomingSellerLoading}
                className="text-xs font-semibold text-amber-700 border border-amber-400 px-3 py-1.5 rounded-full hover:bg-amber-50 transition-colors whitespace-nowrap disabled:opacity-60"
              >
                {becomingSellerLoading ? 'Upgrading…' : '+ Become a Seller'}
              </button>
            )}
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="flex gap-2 mb-5 mt-4 overflow-x-auto scrollbar-none">
          {[
            { icon: <Home size={14} />,        label: 'Home',     to: '/'         },
            { icon: <ShoppingBag size={14} />, label: 'Browse',   to: '/products' },
            { icon: <Megaphone size={14} />,   label: 'Auctions', to: '/auctions' },
            { icon: <User size={14} />,        label: 'Profile',  to: '/profile'  },
          ].map(({ icon, label, to }) => (
            <Link
              key={label}
              to={to}
              className="flex-shrink-0 inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#1a3a1a] px-3 py-2 rounded-full text-xs font-semibold hover:border-[#2d5a27] hover:text-[#2d5a27] transition-colors shadow-sm"
            >
              {icon} {label}
            </Link>
          ))}
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          <button
            type="button"
            onClick={() => setActiveTab('bids')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'bids'
                ? 'bg-[#2d5a27] text-white'
                : 'text-gray-500 hover:text-[#1a3a1a]'
            }`}
          >
            My Bids ({bids.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('won')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'won'
                ? 'bg-amber-500 text-white'
                : 'text-gray-500 hover:text-[#1a3a1a]'
            }`}
          >
            <Trophy size={14} /> Won Auctions ({wonLots.length})
          </button>
        </div>

        {/* ── Bids tab ── */}
        {activeTab === 'bids' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-[#1a3a1a]">My Bids</h2>
              <Link
                to="/products"
                className="hidden md:inline-flex items-center gap-1.5 text-sm text-[#2d5a27] font-medium hover:gap-2 transition-all"
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
                      type="button"
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
                  <button type="button" onClick={() => setFilter('all')} className="mt-2 text-primary text-sm font-semibold hover:underline">
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
                        {(() => {
                          const imgSrc = getProductImage({
                            image_url: b.product_image_url,
                            media_paths: b.product_media_paths || []
                          });
                          return imgSrc ? (
                            <img src={imgSrc} alt={b.product_name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-3xl select-none">🌿</span>
                            </div>
                          );
                        })()}
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
                            {price && <span className="text-[12px] font-bold text-green-700">{price}</span>}
                            {qty && <span className="text-[11px] text-muted-foreground">· {qty}</span>}
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
        )}

        {/* ── Won Auctions tab ── */}
        {activeTab === 'won' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              <h2 className="font-semibold text-[#1a3a1a]">Auction Lots Won</h2>
            </div>
            <div className="p-4 md:p-6">
              {wonLots.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-muted-foreground mb-1 font-medium">No auction wins yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Join a live auction and place the winning bid!</p>
                  <Link
                    to="/auctions"
                    className="inline-flex items-center gap-2 bg-[#2d5a27] text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    Browse Auctions <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {wonLots.map(lot => {
                    const imgUrl = (lot.media_paths || []).find(u =>
                      /\.(jpg|jpeg|png|webp)/i.test(u) || u.includes('/image/upload/')
                    );
                    const finalPrice = lot.sold_price || lot.current_price || 0;
                    const currency = lot.currency === 'USD' ? '$' : '₹';
                    return (
                      <div key={lot.id} className="flex items-center gap-3 p-3 border border-amber-200 bg-amber-50/40 rounded-xl">
                        {imgUrl ? (
                          <img src={imgUrl} alt={lot.product_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" onError={e => e.target.style.display='none'} />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <Trophy size={24} className="text-amber-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-sm text-[#1a3a1a] truncate">{lot.product_name}</p>
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">✅ WON</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{lot.event_title}{lot.event_location ? ` · ${lot.event_location}` : ''}</p>
                          <p className="text-xs text-gray-500">{lot.grade} · {lot.quantity_kg} kg</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm font-bold text-[#2d5a27]">{currency}{finalPrice.toLocaleString('en-IN')}/kg</span>
                            <span className="text-xs text-gray-400">Total: {currency}{(finalPrice * lot.quantity_kg).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 text-center pt-2">
                    Our team will contact you to arrange payment and delivery.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BuyerDashboard;
