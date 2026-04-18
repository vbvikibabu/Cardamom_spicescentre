import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Clock, CheckCircle, Gavel } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusBadge = (status) => {
  const map = {
    pending: 'bg-yellow-100 text-yellow-700',
    quoted: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

const BuyerDashboard = () => {
  const { user, token, isApproved } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bids');

  useEffect(() => {
    if (!isApproved) { navigate('/pending-approval'); return; }
    fetchData();
  }, [isApproved, navigate]);

  const fetchData = async () => {
    const headers = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const [quotesRes, bidsRes] = await Promise.all([
        axios.get(`${API_URL}/api/quotes/my-quotes`, headers),
        axios.get(`${API_URL}/api/bids/my`, headers)
      ]);
      setQuotes(quotesRes.data);
      setBids(bidsRes.data);
    } catch {
      toast.error('Failed to load data');
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

  const tabs = [
    { key: 'bids', label: 'My Bids' },
    { key: 'quotes', label: 'My Quotes' }
  ];

  return (
    <div data-testid="buyer-dashboard" className="min-h-screen bg-muted pt-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2">Buyer Dashboard</h1>
          <p className="text-muted-foreground">Welcome, {user?.full_name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[
            { icon: Gavel, bg: 'bg-purple-100', color: 'text-purple-600', value: bids.length, label: 'Total Bids' },
            { icon: FileText, bg: 'bg-blue-100', color: 'text-blue-600', value: quotes.length, label: 'Total Quotes' },
            { icon: Clock, bg: 'bg-yellow-100', color: 'text-yellow-600', value: bids.filter(b => b.status === 'pending').length + quotes.filter(q => q.status === 'pending').length, label: 'Pending' },
            { icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600', value: bids.filter(b => b.status === 'accepted').length + quotes.filter(q => q.status === 'accepted' || q.status === 'quoted').length, label: 'Accepted / Quoted' }
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

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-border">
            <div className="flex">
              {tabs.map(t => (
                <button key={t.key} data-testid={`buyer-tab-${t.key}`} onClick={() => setActiveTab(t.key)}
                  className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* BIDS TAB */}
            {activeTab === 'bids' && (
              bids.length === 0 ? (
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
              )
            )}

            {/* QUOTES TAB */}
            {activeTab === 'quotes' && (
              quotes.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto text-muted-foreground mb-4" size={48} />
                  <p className="text-muted-foreground mb-4">No quote requests yet</p>
                  <button onClick={() => navigate('/products')} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors">Browse Products</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {quotes.map(q => (
                    <div key={q.id} data-testid={`buyer-quote-${q.id}`} className="border border-border rounded-lg p-5 hover:border-primary transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground">{q.product_name}</h3>
                          <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(q.status)}`}>{q.status}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Quantity:</span> <span className="font-medium">{q.quantity} kg</span></div>
                        <div><span className="text-muted-foreground">Market:</span> <span className="font-medium capitalize">{q.market_type}</span></div>
                        {q.destination_country && <div><span className="text-muted-foreground">Destination:</span> <span className="font-medium">{q.destination_country}</span></div>}
                        {q.shipping_method && <div><span className="text-muted-foreground">Shipping:</span> <span className="font-medium capitalize">{q.shipping_method}</span></div>}
                      </div>
                      {q.final_price && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-sm font-bold text-primary">Final Price: {q.currency} {q.final_price.toLocaleString()}</p>
                          {q.admin_notes && <p className="text-xs text-muted-foreground mt-1">Note: {q.admin_notes}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;
