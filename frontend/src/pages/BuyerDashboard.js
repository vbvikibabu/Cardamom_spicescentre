import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Gavel, Clock, CheckCircle, XCircle, Package } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusBadge = (status) => {
  const map = {
    pending: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  };
  return map[status] || 'bg-gray-100 text-gray-700';
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

  return (
    <div data-testid="buyer-dashboard" className="min-h-screen bg-muted pt-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2">Buyer Dashboard</h1>
          <p className="text-muted-foreground">Welcome, {user?.full_name}</p>
        </div>

        {/* Role Switch for "both" users */}
        {user?.role === 'both' && (
          <div data-testid="role-switch-banner" className="mb-6 bg-white border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Gavel size={16} className="text-purple-600" />
              </div>
              <span className="text-sm text-foreground font-medium">You're viewing as <span className="text-purple-600 font-bold">Buyer</span></span>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[
            { icon: Gavel, bg: 'bg-purple-100', color: 'text-purple-600', value: bids.length, label: 'Total Bids' },
            { icon: Clock, bg: 'bg-yellow-100', color: 'text-yellow-600', value: bids.filter(b => b.status === 'pending').length, label: 'Pending' },
            { icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600', value: bids.filter(b => b.status === 'accepted').length, label: 'Accepted' },
            { icon: XCircle, bg: 'bg-red-100', color: 'text-red-600', value: bids.filter(b => b.status === 'rejected').length, label: 'Rejected' }
          ].map((s, i) => (
            <div key={i} className="bg-white p-5 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.bg}`}><s.icon className={s.color} size={20} /></div>
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bids Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-semibold text-foreground">My Bids</h2>
          </div>
          <div className="p-6">
            {bids.length === 0 ? (
              <div className="text-center py-12">
                <Gavel className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground mb-4">No bids placed yet</p>
                <button onClick={() => navigate('/products')} data-testid="buyer-browse-products" className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors">Browse Products</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(b.status)}`}>{b.status}</span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">{b.bid_date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;
