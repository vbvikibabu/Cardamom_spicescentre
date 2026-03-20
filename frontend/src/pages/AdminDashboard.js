import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { User, CheckCircle, XCircle, FileText, Package, Plus, Pencil, Trash2, X, Send } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', size: '', description: '', features: '', image_url: '' });

  // Quote response state
  const [respondingQuote, setRespondingQuote] = useState(null);
  const [quoteForm, setQuoteForm] = useState({ base_price: '', freight_cost: '', final_price: '', currency: 'INR', admin_notes: '', status: 'quoted' });

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [usersRes, quotesRes, productsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users`, authHeaders),
        axios.get(`${API_URL}/api/admin/quotes`, authHeaders),
        axios.get(`${API_URL}/api/products`)
      ]);
      setUsers(usersRes.data);
      setQuotes(quotesRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ─── User Actions ───
  const approveUser = async (userId, status) => {
    try {
      await axios.patch(`${API_URL}/api/admin/users/${userId}/status?status=${status}`, {}, authHeaders);
      toast.success(`User ${status}!`);
      fetchData();
    } catch { toast.error('Failed to update user'); }
  };

  // ─── Product Actions ───
  const openProductForm = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        size: product.size,
        description: product.description,
        features: product.features.join(', '),
        image_url: product.image_url
      });
    } else {
      setEditingProduct(null);
      setProductForm({ name: '', size: '', description: '', features: '', image_url: '' });
    }
    setShowProductForm(true);
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      ...productForm,
      features: productForm.features.split(',').map(f => f.trim()).filter(Boolean)
    };
    try {
      if (editingProduct) {
        await axios.put(`${API_URL}/api/admin/products/${editingProduct.id}`, payload, authHeaders);
        toast.success('Product updated!');
      } else {
        await axios.post(`${API_URL}/api/admin/products`, payload, authHeaders);
        toast.success('Product created!');
      }
      setShowProductForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save product');
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/products/${id}`, authHeaders);
      toast.success('Product deleted!');
      fetchData();
    } catch { toast.error('Failed to delete product'); }
  };

  // ─── Quote Actions ───
  const openQuoteResponse = (quote) => {
    setRespondingQuote(quote);
    setQuoteForm({
      base_price: quote.base_price || '',
      freight_cost: quote.freight_cost || '',
      final_price: quote.final_price || '',
      currency: quote.currency || 'INR',
      admin_notes: quote.admin_notes || '',
      status: quote.status === 'pending' ? 'quoted' : quote.status
    });
  };

  const submitQuoteResponse = async (e) => {
    e.preventDefault();
    const payload = {};
    if (quoteForm.base_price) payload.base_price = parseFloat(quoteForm.base_price);
    if (quoteForm.freight_cost) payload.freight_cost = parseFloat(quoteForm.freight_cost);
    if (quoteForm.final_price) payload.final_price = parseFloat(quoteForm.final_price);
    payload.currency = quoteForm.currency;
    payload.admin_notes = quoteForm.admin_notes;
    payload.status = quoteForm.status;
    try {
      await axios.patch(`${API_URL}/api/admin/quotes/${respondingQuote.id}`, payload, authHeaders);
      toast.success('Quote updated!');
      setRespondingQuote(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update quote');
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
    { key: 'users', label: 'Users Management' },
    { key: 'quotes', label: 'Quote Requests' },
    { key: 'products', label: 'Products' }
  ];

  return (
    <div data-testid="admin-dashboard" className="min-h-screen bg-muted pt-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.full_name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[
            { icon: User, color: 'primary', value: users.length, label: 'Total Users' },
            { icon: User, color: 'yellow-600', bg: 'yellow-100', value: users.filter(u => u.status === 'pending').length, label: 'Pending Approval' },
            { icon: FileText, color: 'blue-600', bg: 'blue-100', value: quotes.length, label: 'Total Quotes' },
            { icon: Package, color: 'orange-600', bg: 'orange-100', value: products.length, label: 'Products' }
          ].map((s, i) => (
            <div key={i} className="bg-white p-5 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.bg ? `bg-${s.bg}` : 'bg-primary/10'}`}>
                  <s.icon className={`${s.bg ? `text-${s.color}` : 'text-primary'}`} size={20} />
                </div>
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
                <button
                  key={t.key}
                  data-testid={`admin-tab-${t.key}`}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-6 py-4 font-semibold text-sm transition-colors ${
                    activeTab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* ═══ USERS TAB ═══ */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                {users.filter(u => u.role !== 'admin').length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No registered users yet</p>
                )}
                {users.filter(u => u.role !== 'admin').map(u => (
                  <div key={u.id} data-testid={`user-row-${u.id}`} className="border border-border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{u.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">{u.company_name} {u.country && `• ${u.country}`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          u.status === 'approved' ? 'bg-green-100 text-green-700' : u.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>{u.status}</span>
                        {u.status === 'pending' && (
                          <>
                            <button data-testid={`approve-user-${u.id}`} onClick={() => approveUser(u.id, 'approved')} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors" title="Approve">
                              <CheckCircle size={18} />
                            </button>
                            <button data-testid={`reject-user-${u.id}`} onClick={() => approveUser(u.id, 'rejected')} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors" title="Reject">
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ QUOTES TAB ═══ */}
            {activeTab === 'quotes' && (
              <div className="space-y-4">
                {quotes.length === 0 && <p className="text-center text-muted-foreground py-8">No quote requests yet</p>}
                {quotes.map(quote => (
                  <div key={quote.id} data-testid={`quote-row-${quote.id}`} className="border border-border rounded-lg p-5 hover:border-primary transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{quote.product_name}</h3>
                        <p className="text-sm text-muted-foreground">{quote.customer_name} ({quote.customer_email})</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        quote.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : quote.status === 'quoted' ? 'bg-blue-100 text-blue-700' : quote.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{quote.status}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                      <div><span className="text-muted-foreground">Quantity:</span> <span className="font-medium">{quote.quantity} kg</span></div>
                      <div><span className="text-muted-foreground">Market:</span> <span className="font-medium capitalize">{quote.market_type}</span></div>
                      {quote.destination_country && <div><span className="text-muted-foreground">Destination:</span> <span className="font-medium">{quote.destination_country}</span></div>}
                      {quote.shipping_method && <div><span className="text-muted-foreground">Shipping:</span> <span className="font-medium capitalize">{quote.shipping_method}</span></div>}
                    </div>
                    {quote.additional_notes && <p className="text-sm text-muted-foreground mb-3">Note: {quote.additional_notes}</p>}
                    {quote.final_price && (
                      <div className="bg-green-50 rounded-lg p-3 mb-3 text-sm">
                        <span className="font-semibold text-green-700">Quoted: {quote.currency} {quote.final_price.toLocaleString()}</span>
                        {quote.admin_notes && <span className="text-muted-foreground ml-3">— {quote.admin_notes}</span>}
                      </div>
                    )}

                    {/* Inline quote response form */}
                    {respondingQuote?.id === quote.id ? (
                      <form onSubmit={submitQuoteResponse} data-testid={`quote-response-form-${quote.id}`} className="border-t border-border pt-4 mt-3 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Base Price</label>
                            <input type="number" step="0.01" data-testid="quote-base-price" value={quoteForm.base_price} onChange={e => setQuoteForm({...quoteForm, base_price: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0.00" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Freight Cost</label>
                            <input type="number" step="0.01" data-testid="quote-freight-cost" value={quoteForm.freight_cost} onChange={e => setQuoteForm({...quoteForm, freight_cost: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0.00" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Final Price *</label>
                            <input type="number" step="0.01" required data-testid="quote-final-price" value={quoteForm.final_price} onChange={e => setQuoteForm({...quoteForm, final_price: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0.00" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Currency</label>
                            <select data-testid="quote-currency" value={quoteForm.currency} onChange={e => setQuoteForm({...quoteForm, currency: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                              <option value="INR">INR</option>
                              <option value="USD">USD</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                            <select data-testid="quote-status" value={quoteForm.status} onChange={e => setQuoteForm({...quoteForm, status: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                              <option value="quoted">Quoted</option>
                              <option value="accepted">Accepted</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Admin Notes</label>
                          <textarea data-testid="quote-admin-notes" value={quoteForm.admin_notes} onChange={e => setQuoteForm({...quoteForm, admin_notes: e.target.value})} rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Add pricing notes, terms, validity..." />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" data-testid="quote-submit-response" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                            <Send size={14} /> Send Response
                          </button>
                          <button type="button" onClick={() => setRespondingQuote(null)} className="px-5 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-muted transition-colors">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button data-testid={`quote-respond-btn-${quote.id}`} onClick={() => openQuoteResponse(quote)} className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors mt-1">
                        <Send size={14} /> {quote.status === 'pending' ? 'Respond to Quote' : 'Update Quote'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ═══ PRODUCTS TAB ═══ */}
            {activeTab === 'products' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <p className="text-sm text-muted-foreground">{products.length} products</p>
                  <button data-testid="add-product-btn" onClick={() => openProductForm()} className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                    <Plus size={16} /> Add Product
                  </button>
                </div>

                {/* Product Form (inline) */}
                {showProductForm && (
                  <form onSubmit={saveProduct} data-testid="product-form" className="border border-primary rounded-xl p-6 mb-6 bg-primary/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-foreground">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
                      <button type="button" onClick={() => setShowProductForm(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Product Name *</label>
                        <input type="text" required data-testid="product-name-input" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Green Cardamom – 6 mm to 7 mm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Size / Grade *</label>
                        <input type="text" required data-testid="product-size-input" value={productForm.size} onChange={e => setProductForm({...productForm, size: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="6 mm to 7 mm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Description *</label>
                      <textarea required data-testid="product-desc-input" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Features (comma-separated) *</label>
                      <input type="text" required data-testid="product-features-input" value={productForm.features} onChange={e => setProductForm({...productForm, features: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Clean pods, Good aroma, Export quality" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Image URL *</label>
                      <input type="url" required data-testid="product-image-input" value={productForm.image_url} onChange={e => setProductForm({...productForm, image_url: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
                    </div>
                    <button type="submit" data-testid="product-save-btn" className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                      {editingProduct ? 'Update Product' : 'Create Product'}
                    </button>
                  </form>
                )}

                {/* Product list */}
                <div className="space-y-3">
                  {products.map(p => (
                    <div key={p.id} data-testid={`product-row-${p.id}`} className="border border-border rounded-lg p-4 hover:border-primary transition-colors">
                      <div className="flex items-center gap-4">
                        <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                          <p className="text-sm text-muted-foreground">{p.size} — {p.features.length} features</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button data-testid={`edit-product-${p.id}`} onClick={() => openProductForm(p)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors" title="Edit">
                            <Pencil size={16} className="text-foreground" />
                          </button>
                          <button data-testid={`delete-product-${p.id}`} onClick={() => deleteProduct(p.id)} className="p-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
