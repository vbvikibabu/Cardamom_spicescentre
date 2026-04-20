import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { User, CheckCircle, XCircle, Package, Plus, Pencil, Trash2, X, Upload, Film, Gavel } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
const ACCEPT_STRING = '.jpg,.jpeg,.png,.webp,.mp4,.mov';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bids, setBids] = useState([]);
  const [bidsSummary, setBidsSummary] = useState({ total: 0, today: 0, pending: 0, accepted: 0, rejected: 0 });
  const [bidsFilter, setBidsFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', size: '', description: '', features: '' });
  const [mediaFiles, setMediaFiles] = useState([]); // { file, preview, uploading, path, type }
  const [existingMedia, setExistingMedia] = useState([]); // paths from existing product
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Bid response state
  const [bidNotes, setBidNotes] = useState({});

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [usersRes, productsRes, bidsRes, bidsSumRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users`, authHeaders),
        axios.get(`${API_URL}/api/admin/products`, authHeaders),
        axios.get(`${API_URL}/api/bids`, authHeaders),
        axios.get(`${API_URL}/api/bids/summary`, authHeaders)
      ]);
      setUsers(usersRes.data);
      setProducts(productsRes.data);
      setBids(bidsRes.data);
      setBidsSummary(bidsSumRes.data);
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
        features: product.features.join(', ')
      });
      setExistingMedia(product.media_paths || []);
      // If legacy product has image_url but no media_paths, show image_url
      if ((!product.media_paths || product.media_paths.length === 0) && product.image_url) {
        setExistingMedia([product.image_url]);
      }
    } else {
      setEditingProduct(null);
      setProductForm({ name: '', size: '', description: '', features: '' });
      setExistingMedia([]);
    }
    setMediaFiles([]);
    setShowProductForm(true);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const totalCount = mediaFiles.length + existingMedia.length + files.length;
    
    if (totalCount > 4) {
      toast.error(`Maximum 4 files allowed. You already have ${mediaFiles.length + existingMedia.length}.`);
      return;
    }

    const newMedia = files.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.filename || f.name}: Unsupported format. Use JPG, PNG, WEBP, MP4, or MOV.`);
        return false;
      }
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`${f.name}: File too large. Max 50MB.`);
        return false;
      }
      return true;
    }).map(f => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      type: f.type.startsWith('video/') ? 'video' : 'image',
      uploading: false,
      path: null,
      name: f.name
    }));

    setMediaFiles(prev => [...prev, ...newMedia]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeNewFile = (index) => {
    setMediaFiles(prev => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const removeExistingMedia = (index) => {
    setExistingMedia(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const uploadSingleFile = async (mediaItem) => {
    const formData = new FormData();
    formData.append('file', mediaItem.file);
    const res = await axios.post(`${API_URL}/api/upload`, formData, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
    });
    return res.data.path;
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    const totalMedia = existingMedia.length + mediaFiles.length;
    if (totalMedia < 1) {
      toast.error('Please add at least 1 image or video.');
      return;
    }
    if (totalMedia > 4) {
      toast.error('Maximum 4 files allowed.');
      return;
    }

    setSaving(true);
    try {
      // Upload new files
      const uploadedPaths = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        setMediaFiles(prev => prev.map((m, idx) => idx === i ? { ...m, uploading: true } : m));
        const path = await uploadSingleFile(mediaFiles[i]);
        uploadedPaths.push(path);
        setMediaFiles(prev => prev.map((m, idx) => idx === i ? { ...m, uploading: false, path } : m));
      }

      const allMediaPaths = [...existingMedia, ...uploadedPaths];
      // Use first image as image_url for backward compatibility
      const firstImagePath = allMediaPaths[0] || '';
      const imageUrl = firstImagePath.startsWith('http') ? firstImagePath : (firstImagePath ? `${API_URL}/api/files/${firstImagePath}` : '');

      const payload = {
        name: productForm.name,
        size: productForm.size,
        description: productForm.description,
        features: productForm.features.split(',').map(f => f.trim()).filter(Boolean),
        image_url: imageUrl,
        media_paths: allMediaPaths
      };

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
    } finally {
      setSaving(false);
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

  // ─── Product Approval Actions ───
  const approveProduct = async (productId, approvalStatus) => {
    try {
      await axios.patch(`${API_URL}/api/admin/products/${productId}/status?approval_status=${approvalStatus}`, {}, authHeaders);
      toast.success(`Product ${approvalStatus}!`);
      fetchData();
    } catch { toast.error('Failed to update product status'); }
  };

  // ─── Bid Actions ───
  const handleBidAction = async (bidId, status) => {
    try {
      await axios.put(`${API_URL}/api/bids/${bidId}`, {
        status,
        notes: bidNotes[bidId] || null
      }, authHeaders);
      toast.success(`Bid ${status}!`);
      setBidNotes(prev => { const n = {...prev}; delete n[bidId]; return n; });
      fetchData();
    } catch { toast.error('Failed to update bid'); }
  };

  const fetchFilteredBids = async (filter) => {
    setBidsFilter(filter);
    try {
      const url = filter === 'all' ? `${API_URL}/api/bids` : `${API_URL}/api/bids?status=${filter}`;
      const res = await axios.get(url, authHeaders);
      setBids(res.data);
    } catch { toast.error('Failed to filter bids'); }
  };

  // ─── Helper: get display URL for a media path ───
  const getMediaUrl = (path) => {
    if (path.startsWith('http')) return path;
    return `${API_URL}/api/files/${path}`;
  };

  const isVideo = (path) => {
    const lower = path.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.includes('video');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  const tabs = [
    { key: 'users', label: 'Users' },
    { key: 'pending-products', label: `Pending Products (${products.filter(p => p.approval_status === 'pending').length})` },
    { key: 'bids', label: 'Bids' },
    { key: 'products', label: 'All Products' }
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
            { icon: Gavel, color: 'blue-600', bg: 'blue-100', value: bids.length, label: 'Total Bids' },
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
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 capitalize">{u.role}</span>
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

            {/* ═══ PENDING PRODUCTS TAB ═══ */}
            {activeTab === 'pending-products' && (
              <div className="space-y-4">
                {products.filter(p => p.approval_status === 'pending').length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No products pending approval</p>
                )}
                {products.filter(p => p.approval_status === 'pending').map(p => (
                  <div key={p.id} data-testid={`pending-product-${p.id}`} className="border border-yellow-200 bg-yellow-50/50 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1 flex-shrink-0">
                          {(p.media_paths && p.media_paths.length > 0 ? p.media_paths.slice(0, 2) : [p.image_url]).map((path, idx) => (
                            path && (
                              isVideo(path) ? (
                                <div key={idx} className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center"><Film size={18} className="text-muted-foreground" /></div>
                              ) : (
                                <img key={idx} src={getMediaUrl(path)} alt={p.name} className="w-14 h-14 rounded-lg object-cover" />
                              )
                            )
                          ))}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{p.name}</h3>
                          <p className="text-sm text-muted-foreground">{p.size}</p>
                          <p className="text-xs text-muted-foreground mt-1">By: {p.seller_name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button data-testid={`approve-product-${p.id}`} onClick={() => approveProduct(p.id, 'approved')} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors inline-flex items-center gap-1">
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button data-testid={`reject-product-${p.id}`} onClick={() => approveProduct(p.id, 'rejected')} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors inline-flex items-center gap-1">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {p.features?.map((f, i) => (
                        <span key={i} className="px-2 py-1 bg-white rounded text-xs text-foreground border border-border">{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}



            {/* ═══ BIDS TAB ═══ */}
            {activeTab === 'bids' && (
              <div>
                {/* Bid Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Total', value: bidsSummary.total, bg: 'bg-blue-50', color: 'text-blue-700' },
                    { label: 'Today', value: bidsSummary.today, bg: 'bg-purple-50', color: 'text-purple-700' },
                    { label: 'Pending', value: bidsSummary.pending, bg: 'bg-yellow-50', color: 'text-yellow-700' },
                    { label: 'Accepted', value: bidsSummary.accepted, bg: 'bg-green-50', color: 'text-green-700' },
                    { label: 'Rejected', value: bidsSummary.rejected, bg: 'bg-red-50', color: 'text-red-700' }
                  ].map((s, i) => (
                    <div key={i} className={`${s.bg} rounded-lg p-3 text-center`}>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Filter */}
                <div className="flex gap-2 mb-4">
                  {['all', 'pending', 'accepted', 'rejected'].map(f => (
                    <button key={f} data-testid={`bids-filter-${f}`} onClick={() => fetchFilteredBids(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${bidsFilter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                      {f}
                    </button>
                  ))}
                </div>

                {/* Bids Table */}
                {bids.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No bids found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table data-testid="admin-bids-table" className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Buyer</th>
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Product</th>
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Qty</th>
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Price</th>
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Market</th>
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Date</th>
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Status</th>
                          <th className="text-left py-3 px-2 font-semibold text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bids.map(b => {
                          const qty = [b.quantity_kg && `${b.quantity_kg} kg`, b.quantity_lot && `${b.quantity_lot} lots`].filter(Boolean).join(' / ');
                          const price = [b.price_per_kg && `${b.currency} ${b.price_per_kg}/kg`, b.price_per_lot && `${b.currency} ${b.price_per_lot}/lot`].filter(Boolean).join(' / ');
                          return (
                            <tr key={b.id} data-testid={`admin-bid-${b.id}`} className="border-b border-border last:border-0 hover:bg-muted/50">
                              <td className="py-3 px-2">
                                <div className="font-medium text-foreground">{b.buyer_name}</div>
                                <div className="text-xs text-muted-foreground">{b.buyer_company}</div>
                              </td>
                              <td className="py-3 px-2">
                                <div className="font-medium text-foreground">{b.product_name}</div>
                                <div className="text-xs text-muted-foreground">{b.product_size}</div>
                              </td>
                              <td className="py-3 px-2 text-foreground">{qty}</td>
                              <td className="py-3 px-2 font-medium text-foreground">{price}</td>
                              <td className="py-3 px-2 capitalize text-foreground">{b.market_type}</td>
                              <td className="py-3 px-2 text-muted-foreground">{b.bid_date}</td>
                              <td className="py-3 px-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : b.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>{b.status}</span>
                              </td>
                              <td className="py-3 px-2">
                                {b.status === 'pending' ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      placeholder="Admin notes..."
                                      data-testid={`bid-notes-${b.id}`}
                                      value={bidNotes[b.id] || ''}
                                      onChange={e => setBidNotes({...bidNotes, [b.id]: e.target.value})}
                                      className="w-full px-2 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <div className="flex gap-1">
                                      <button data-testid={`accept-bid-${b.id}`} onClick={() => handleBidAction(b.id, 'accepted')} className="px-2.5 py-1 bg-green-500 text-white rounded text-xs font-semibold hover:bg-green-600 transition-colors">
                                        Accept
                                      </button>
                                      <button data-testid={`reject-bid-${b.id}`} onClick={() => handleBidAction(b.id, 'rejected')} className="px-2.5 py-1 bg-red-500 text-white rounded text-xs font-semibold hover:bg-red-600 transition-colors">
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{b.admin_notes || '—'}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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

                {/* Product Form */}
                {showProductForm && (
                  <form onSubmit={saveProduct} data-testid="product-form" className="border border-primary rounded-xl p-6 mb-6 bg-primary/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-foreground">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
                      <button type="button" onClick={() => setShowProductForm(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Product Name *</label>
                        <input type="text" required data-testid="product-name-input" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white" placeholder="Green Cardamom – 6 mm to 7 mm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Size / Grade *</label>
                        <input type="text" required data-testid="product-size-input" value={productForm.size} onChange={e => setProductForm({...productForm, size: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white" placeholder="6 mm to 7 mm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Description *</label>
                      <textarea required data-testid="product-desc-input" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Features (comma-separated) *</label>
                      <input type="text" required data-testid="product-features-input" value={productForm.features} onChange={e => setProductForm({...productForm, features: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white" placeholder="Clean pods, Good aroma, Export quality" />
                    </div>

                    {/* ─── Media Upload ─── */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">
                        Photos & Videos * <span className="text-muted-foreground font-normal">(Min 1, Max 4 — JPG, PNG, WEBP, MP4, MOV)</span>
                      </label>

                      {/* Existing media previews */}
                      {existingMedia.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-3">
                          {existingMedia.map((path, idx) => (
                            <div key={`existing-${idx}`} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border bg-white">
                              {isVideo(path) ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                  <Film size={24} className="text-muted-foreground" />
                                </div>
                              ) : (
                                <img src={getMediaUrl(path)} alt="" className="w-full h-full object-cover" />
                              )}
                              <button
                                type="button"
                                onClick={() => removeExistingMedia(idx)}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* New file previews */}
                      {mediaFiles.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-3">
                          {mediaFiles.map((m, idx) => (
                            <div key={`new-${idx}`} className="relative group w-24 h-24 rounded-lg overflow-hidden border-2 border-dashed border-primary/40 bg-white">
                              {m.type === 'video' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                  <Film size={20} className="text-primary mb-1" />
                                  <span className="text-[10px] text-muted-foreground px-1 truncate w-full text-center">{m.name}</span>
                                </div>
                              ) : (
                                <img src={m.preview} alt="" className="w-full h-full object-cover" />
                              )}
                              {m.uploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeNewFile(idx)}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload button */}
                      {(existingMedia.length + mediaFiles.length) < 4 && (
                        <button
                          type="button"
                          data-testid="media-upload-btn"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-primary/40 rounded-lg text-sm text-primary font-medium hover:bg-primary/5 transition-colors"
                        >
                          <Upload size={16} />
                          Add {existingMedia.length + mediaFiles.length === 0 ? 'Photos/Videos' : 'More'}
                          <span className="text-muted-foreground font-normal">({existingMedia.length + mediaFiles.length}/4)</span>
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPT_STRING}
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="media-file-input"
                      />
                    </div>

                    <button type="submit" disabled={saving} data-testid="product-save-btn" className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                      {saving ? (
                        <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> Saving...</>
                      ) : (
                        editingProduct ? 'Update Product' : 'Create Product'
                      )}
                    </button>
                  </form>
                )}

                {/* Product list */}
                <div className="space-y-3">
                  {products.map(p => (
                    <div key={p.id} data-testid={`product-row-${p.id}`} className="border border-border rounded-lg p-4 hover:border-primary transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1 flex-shrink-0">
                          {(p.media_paths && p.media_paths.length > 0 ? p.media_paths.slice(0, 2) : [p.image_url]).map((path, idx) => (
                            path && (
                              isVideo(path) ? (
                                <div key={idx} className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                                  <Film size={18} className="text-muted-foreground" />
                                </div>
                              ) : (
                                <img key={idx} src={getMediaUrl(path)} alt={p.name} className="w-14 h-14 rounded-lg object-cover" />
                              )
                            )
                          ))}
                          {p.media_paths && p.media_paths.length > 2 && (
                            <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-muted-foreground font-medium">
                              +{p.media_paths.length - 2}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                          <p className="text-sm text-muted-foreground">{p.size} — {p.seller_name || 'Admin'}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.approval_status === 'approved' ? 'bg-green-100 text-green-700' : p.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>{p.approval_status || 'approved'}</span>
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
