import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerDashboard = () => {
  const { user, token, isApproved } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (!isApproved) {
      navigate('/pending-approval');
      return;
    }
    fetchQuotes();
  }, [user, isApproved, navigate]);

  const fetchQuotes = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/quotes/my-quotes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes(response.data);
    } catch (error) {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted pt-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2">
            Customer Dashboard
          </h1>
          <p className="text-muted-foreground">Welcome, {user?.full_name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{quotes.length}</p>
                <p className="text-sm text-muted-foreground">Total Quotes</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {quotes.filter(q => q.status === 'pending').length}
                </p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {quotes.filter(q => q.status === 'quoted' || q.status === 'accepted').length}
                </p>
                <p className="text-sm text-muted-foreground">Quoted</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="text-red-600" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {quotes.filter(q => q.status === 'rejected').length}
                </p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quotes List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-semibold text-lg text-foreground">My Quote Requests</h2>
          </div>

          <div className="p-6">
            {quotes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground mb-4">No quote requests yet</p>
                <button
                  onClick={() => navigate('/products')}
                  className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Browse Products
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {quotes.map((quote) => (
                  <div key={quote.id} className="border border-border rounded-lg p-6 hover:border-primary transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{quote.product_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(quote.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          quote.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : quote.status === 'quoted'
                            ? 'bg-blue-100 text-blue-700'
                            : quote.status === 'accepted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {quote.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Quantity</p>
                        <p className="font-semibold text-foreground">{quote.quantity} kg</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Market Type</p>
                        <p className="font-semibold text-foreground capitalize">{quote.market_type}</p>
                      </div>
                      {quote.destination_country && (
                        <div>
                          <p className="text-muted-foreground">Destination</p>
                          <p className="font-semibold text-foreground">{quote.destination_country}</p>
                        </div>
                      )}
                      {quote.shipping_method && (
                        <div>
                          <p className="text-muted-foreground">Shipping</p>
                          <p className="font-semibold text-foreground capitalize">{quote.shipping_method}</p>
                        </div>
                      )}
                    </div>

                    {quote.final_price && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-lg font-bold text-primary">
                          Final Price: {quote.currency} {quote.final_price.toLocaleString()}
                        </p>
                        {quote.admin_notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <strong>Admin Notes:</strong> {quote.admin_notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;