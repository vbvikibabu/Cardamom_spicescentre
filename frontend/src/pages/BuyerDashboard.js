import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Gavel, Clock, CheckCircle, XCircle, Package, ArrowRight, ShoppingBag } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getGreeting = (firstName) => {
  const h = new Date().getHours();
  const name = firstName || 'there';
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
};

const getStatusMsg = (bids) => {
  const pending = bids.filter(b => b.status === 'pending').length;
  const accepted = bids.filter(b => b.status === 'accepted').length;
  if (accepted > 0) return `🎉 You have ${accepted} accepted bid${accepted > 1 ? 's' : ''}!`;
  if (pending > 0) return `⏳ You have ${pending} bid${pending > 1 ? 's' : ''} waiting for seller review.`;
  if (bids.length > 0) return 'Browse new listings and place your next bid.';
  return 'Ready to source premium cardamom? Browse our active listings.';
};

const statusBadge = (status) => {
  const map = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    accepted: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200'
  };
  return map[status] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}/api/files/${path}`;
};

const BuyerDashboard = () => {
  const { user, token, isApproved } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  const firstName = user?.full_name?.split(' ')[0];
  const greeting = getGreeting(firstName);
  const statusMsg = getStatusMsg(bids);

  return (
    <div data-testid="buyer-dashboard" className="min-h-screen bg-muted pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-12">

        {/* Greeting header */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-foreground mb-1">{greeting} 👋</h1>
          <p className="text-sm md:text-base text-muted-foreground">{statusMsg}</p>
        </div>

        {/* Role Switch for "both" users */}
        {user?.role === 'both' && (
          <div data-testid="role-switch-banner" className="mb-6 bg-white border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Gavel size={16} className="text-purple-600" />
              </div>
              <span className="text-sm text-foreground font-medium">Viewing as <span className="text-purple-600 font-bold">Buyer</span></span>
            </div>
            <Link
              to="/seller"
              data-testid="switch-to-seller-btn"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Package size={14} /> Switch to Seller View
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6">
          {[
            { icon: Gavel, bg: 'bg-purple-100', color: 'text-purple-600', value: bids.length, label: 'Total Bids' },
            { icon: Clock, bg: 'bg-yellow-100', color: 'text-yellow-600', value: bids.filter(b => b.status === 'pending').length, label: 'Pending' },
            { icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600', value: bids.filter(b => b.status === 'accepted').length, label: 'Accepted' },
            { icon: XCircle, bg: 'bg-red-100', color: 'text-red-600', value: bids.filter(b => b.status === 'rejected').length, label: 'Rejected' }
          ].map((s, i) => (
            <div key={i} className="bg-white p-4 md:p-5 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center ${s.bg}`}>
                  <s.icon className={s.color} size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action cards — mobile-first quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6 md:hidden">
          <Link to="/products" className="bg-primary text-white rounded-xl p-4 flex flex-col gap-2 hover:bg-primary/90 transition-colors">
            <ShoppingBag size={22} />
            <span className="font-semibold text-sm">Browse Products</span>
            <ArrowRight size={14} className="opacity-70" />
          </Link>
          <button
            onClick={() => {}}
            className="bg-white border border-border rounded-xl p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors text-left"
          >
            <Gavel size={22} className="text-primary" />
            <span className="font-semibold text-sm text-foreground">My Bids</span>
            <span className="text-xs text-muted-foreground">{bids.length} placed</span>
          </button>
        </div>

        {/* Bids section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-border px-4 md:px-6 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">My Bids</h2>
            <Link to="/products" className="hidden md:inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:gap-2 transition-all">
              Browse Products <ArrowRight size={14} />
            </Link>
          </div>

          <div className="p-4 md:p-6">
            {bids.length === 0 ? (
              <div className="text-center py-12">
                <Gavel className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground mb-1 font-medium">No bids placed yet</p>
                <p className="text-sm text-muted-foreground mb-4">Browse active listings and place your first bid!</p>
                <Link to="/products" data-testid="buyer-browse-products"
                  className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors">
                  Browse Products <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <>
                {/* Mobile: bid cards */}
                <div className="space-y-3 md:hidden">
                  {bids.map(b => {
                    const qty = [b.quantity_kg && `${b.quantity_kg} kg`, b.quantity_lot && `${b.quantity_lot} lots`].filter(Boolean).join(' / ');
                    const price = [b.price_per_kg && `${b.currency} ${b.price_per_kg}/kg`, b.price_per_lot && `${b.currency} ${b.price_per_lot}/lot`].filter(Boolean).join(' / ');
                    return (
                      <div key={b.id} data-testid={`buyer-bid-${b.id}`}
                        className={`border rounded-xl p-4 ${statusBadge(b.status)}`}>
                        <div className="flex items-start gap-3">
                          {/* Product thumbnail placeholder */}
                          <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">🌿</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="font-semibold text-foreground text-sm truncate">{b.product_name}</p>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize flex-shrink-0 ${statusBadge(b.status)}`}>
                                {b.status}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">{b.product_size}</p>
                            {b.seller_name && (
                              <p className="text-xs text-muted-foreground mb-1">
                                Seller: <span className="font-medium text-foreground">{b.seller_name}</span>
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                              {qty && <span className="text-foreground font-medium">{qty}</span>}
                              {price && <span className="text-primary font-semibold">{price}</span>}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{b.bid_date}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table data-testid="buyer-bids-table" className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 font-semibold text-foreground">Product</th>
                        <th className="text-left py-3 px-3 font-semibold text-foreground">Seller</th>
                        <th className="text-left py-3 px-3 font-semibold text-foreground">Quantity</th>
                        <th className="text-left py-3 px-3 font-semibold text-foreground">Price</th>
                        <th className="text-left py-3 px-3 font-semibold text-foreground">Status</th>
                        <th className="text-left py-3 px-3 font-semibold text-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map(b => {
                        const qty = [b.quantity_kg && `${b.quantity_kg} kg`, b.quantity_lot && `${b.quantity_lot} lots`].filter(Boolean).join(' / ');
                        const price = [b.price_per_kg && `${b.price_per_kg}/kg`, b.price_per_lot && `${b.price_per_lot}/lot`].filter(Boolean).join(' / ');
                        return (
                          <tr key={b.id} data-testid={`buyer-bid-${b.id}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-3">
                              <div className="font-medium text-foreground">{b.product_name}</div>
                              <div className="text-xs text-muted-foreground">{b.product_size}</div>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{b.seller_name || '—'}</td>
                            <td className="py-3 px-3 text-foreground">{qty}</td>
                            <td className="py-3 px-3 text-foreground font-medium">{b.currency} {price}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge(b.status)}`}>{b.status}</span>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground">{b.bid_date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;
