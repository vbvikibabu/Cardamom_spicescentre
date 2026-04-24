import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, Gavel, Clock, CheckCircle, XCircle, Plus, Pencil, Trash2, X, Upload, Film, ShoppingCart, Timer, Archive, RotateCcw, AlertCircle, Loader2, ArrowRight, Home, ShoppingBag, Megaphone, User } from 'lucide-react';
import { getProductImage } from '../utils/imageHelper';

const getGreeting = (firstName) => {
  const h = new Date().getHours();
  const name = firstName || 'there';
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
};

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
const ACCEPT_STRING = '.jpg,.jpeg,.png,.webp,.mp4,.mov';

const statusBadge = (status) => {
  const map = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    accepted: 'bg-green-100 text-green-700'
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

const listingBadge = (s) => {
  const map = {
    active:           'bg-green-100 text-green-700',
    expired:          'bg-orange-100 text-orange-700',
    sold:             'bg-blue-100 text-blue-700',
    archived:         'bg-gray-100 text-gray-500',
    pending_approval: 'bg-yellow-100 text-yellow-700',
    rejected:         'bg-red-100 text-red-700',
  };
  return map[s] || 'bg-gray-100 text-gray-700';
};

// Small inline countdown for active products
const MiniCountdown = ({ endTime }) => {
  const calc = () => {
    const diff = new Date(endTime) - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, diff };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  });
  if (!time) return <span className="text-xs text-orange-600 font-semibold">Bidding closed</span>;
  const urgent = time.diff < 30 * 60 * 1000;
  return (
    <span className={`text-xs font-mono font-semibold ${urgent ? 'text-red-600 animate-pulse' : 'text-green-700'}`}>
      {String(time.h).padStart(2,'0')}:{String(time.m).padStart(2,'0')}:{String(time.s).padStart(2,'0')}
    </span>
  );
};

const SellerDashboard = () => {
  const { user, token, isApproved } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [bids, setBids] = useState([]);
  const [bidsSummary, setBidsSummary] = useState({ total: 0, today: 0, pending: 0, accepted: 0, rejected: 0 });
  const [bidsFilter, setBidsFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('products');
  const [productListFilter, setProductListFilter] = useState('active');

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', size: '', description: '', features: '', bid_duration_hours: 4, base_price: '', base_price_currency: 'INR', minimum_quantity_kg: '', total_quantity_kg: '' });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [existingMedia, setExistingMedia] = useState([]);
  const [saving, setSaving] = useState(false);
  const [productFormErrors, setProductFormErrors] = useState({});
  const fileInputRef = useRef(null);

  // Bid notes
  const [bidNotes, setBidNotes] = useState({});
  // Real-time form validity (FIX 8)
  const [isFormValid, setIsFormValid] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Real-time validation — runs whenever form fields change
  const validateProductFormRealtime = useCallback((form, media, existingMediaArr) => {
    const errs = {};
    const trimName = form.name.trim();
    if (trimName.length < 3) errs.name = 'At least 3 characters';
    else if (trimName.length > 100) errs.name = 'Max 100 characters';

    const trimSize = form.size.trim();
    if (trimSize.length < 2) errs.size = 'At least 2 characters';

    const trimDesc = form.description.trim();
    if (trimDesc.length < 20) errs.description = 'At least 20 characters';
    else if (trimDesc.length > 500) errs.description = 'Max 500 characters';

    const featuresList = form.features.split(',').map(f => f.trim()).filter(Boolean);
    if (featuresList.length < 2) errs.features = 'Enter at least 2 comma-separated features';

    const bpVal = parseFloat(form.base_price);
    if (!form.base_price || isNaN(bpVal) || bpVal <= 0) errs.base_price = 'Enter a positive number';
    else if (bpVal > 999999) errs.base_price = 'Max 6 digits';

    const totalQty = parseFloat(form.total_quantity_kg);
    const minQty = parseFloat(form.minimum_quantity_kg);
    if (!form.total_quantity_kg || isNaN(totalQty) || totalQty <= 0) errs.total_quantity_kg = 'Enter a positive number';
    if (!form.minimum_quantity_kg || isNaN(minQty) || minQty <= 0) errs.minimum_quantity_kg = 'Enter a positive number';
    if (!errs.total_quantity_kg && !errs.minimum_quantity_kg && minQty >= totalQty) {
      errs.minimum_quantity_kg = 'Must be less than total stock';
    }

    const totalMedia = existingMediaArr.length + media.length;
    if (totalMedia < 1) errs.media = 'Add at least 1 image or video';
    if (totalMedia > 4) errs.media = 'Max 4 files';

    return errs;
  }, []);

  useEffect(() => {
    if (!isApproved) { navigate('/pending-approval'); return; }
    fetchData();
  }, [isApproved, navigate]);

  // Re-validate form whenever any field, media, or existingMedia changes
  useEffect(() => {
    if (!showProductForm) return;
    const errs = validateProductFormRealtime(productForm, mediaFiles, existingMedia);
    setIsFormValid(Object.keys(errs).length === 0);
  }, [productForm, mediaFiles, existingMedia, showProductForm, validateProductFormRealtime]);

  const fetchData = async () => {
    try {
      const [productsRes, bidsRes, bidsSumRes] = await Promise.all([
        axios.get(`${API_URL}/api/seller/products`, authHeaders),
        axios.get(`${API_URL}/api/seller/bids`, authHeaders),
        axios.get(`${API_URL}/api/seller/bids/summary`, authHeaders)
      ]);
      setProducts(productsRes.data);
      setBids(bidsRes.data);
      setBidsSummary(bidsSumRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
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
        bid_duration_hours: product.bid_duration_hours || 4,
        base_price: product.base_price ?? '',
        base_price_currency: product.base_price_currency || 'INR',
        minimum_quantity_kg: product.minimum_quantity_kg ?? '',
        total_quantity_kg: product.total_quantity_kg ?? '',
      });
      setExistingMedia(product.media_paths?.length > 0 ? product.media_paths : (product.image_url ? [product.image_url] : []));
    } else {
      setEditingProduct(null);
      setProductForm({ name: '', size: '', description: '', features: '', bid_duration_hours: 4, base_price: '', base_price_currency: 'INR', minimum_quantity_kg: '', total_quantity_kg: '' });
      setExistingMedia([]);
    }
    setMediaFiles([]);
    setProductFormErrors({});
    setIsFormValid(false);
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
      if (!ALLOWED_TYPES.includes(f.type)) { toast.error(`${f.name}: Unsupported format.`); return false; }
      if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name}: File too large. Max 50MB.`); return false; }
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
    setExistingMedia(prev => { const u = [...prev]; u.splice(index, 1); return u; });
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

    // Client-side validation
    const errs = {};
    const trimName = productForm.name.trim();
    if (trimName.length < 3) errs.name = 'Product name must be at least 3 characters';
    else if (trimName.length > 100) errs.name = 'Product name must be under 100 characters';

    const trimSize = productForm.size.trim();
    if (trimSize.length < 2) errs.size = 'Size/Grade must be at least 2 characters';

    const trimDesc = productForm.description.trim();
    if (trimDesc.length < 20) errs.description = 'Description must be at least 20 characters';
    else if (trimDesc.length > 500) errs.description = 'Description must be under 500 characters';

    const featuresList = productForm.features.split(',').map(f => f.trim()).filter(Boolean);
    if (featuresList.length < 2) errs.features = 'Please enter at least 2 comma-separated features';

    const bpVal = parseFloat(productForm.base_price);
    if (!productForm.base_price || isNaN(bpVal) || bpVal <= 0) errs.base_price = 'Base price must be a positive number';
    else if (bpVal > 999999) errs.base_price = 'Base price seems too high — max 6 digits';

    const totalQty = parseFloat(productForm.total_quantity_kg);
    const minQty = parseFloat(productForm.minimum_quantity_kg);
    if (!productForm.total_quantity_kg || isNaN(totalQty) || totalQty <= 0) errs.total_quantity_kg = 'Total stock must be a positive number';
    if (!productForm.minimum_quantity_kg || isNaN(minQty) || minQty <= 0) errs.minimum_quantity_kg = 'Minimum order must be a positive number';
    if (!errs.total_quantity_kg && !errs.minimum_quantity_kg && minQty >= totalQty) {
      errs.minimum_quantity_kg = 'Minimum order must be less than total stock';
    }

    const totalMedia = existingMedia.length + mediaFiles.length;
    if (totalMedia < 1) errs.media = 'Please add at least 1 image or video';
    if (totalMedia > 4) errs.media = 'Maximum 4 files allowed';

    if (Object.keys(errs).length > 0) {
      setProductFormErrors(errs);
      return;
    }
    setProductFormErrors({});

    setSaving(true);
    try {
      const uploadedPaths = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        setMediaFiles(prev => prev.map((m, idx) => idx === i ? { ...m, uploading: true } : m));
        const path = await uploadSingleFile(mediaFiles[i]);
        uploadedPaths.push(path);
        setMediaFiles(prev => prev.map((m, idx) => idx === i ? { ...m, uploading: false, path } : m));
      }
      const allMediaPaths = [...existingMedia, ...uploadedPaths];
      const firstImagePath = allMediaPaths[0] || '';
      const imageUrl = firstImagePath.startsWith('http') ? firstImagePath : (firstImagePath ? `${API_URL}/api/files/${firstImagePath}` : '');

      const payload = {
        name: productForm.name,
        size: productForm.size,
        description: productForm.description,
        features: productForm.features.split(',').map(f => f.trim()).filter(Boolean),
        image_url: imageUrl,
        media_paths: allMediaPaths,
        bid_duration_hours: Number(productForm.bid_duration_hours) || 4,
        base_price: Number(productForm.base_price),
        base_price_currency: productForm.base_price_currency,
        minimum_quantity_kg: Number(productForm.minimum_quantity_kg),
        total_quantity_kg: Number(productForm.total_quantity_kg),
      };

      if (editingProduct) {
        await axios.put(`${API_URL}/api/seller/products/${editingProduct.id}`, payload, authHeaders);
        toast.success('Product updated! It will be reviewed by admin.');
      } else {
        await axios.post(`${API_URL}/api/seller/products`, payload, authHeaders);
        toast.success('Product submitted! It will be live once admin approves.');
      }
      setShowProductForm(false);
      setProductListFilter('pending_approval');
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
      await axios.delete(`${API_URL}/api/seller/products/${id}`, authHeaders);
      toast.success('Product deleted!');
      fetchData();
    } catch { toast.error('Failed to delete product'); }
  };

  const extendTimer = async (id) => {
    try {
      const res = await axios.post(`${API_URL}/api/seller/products/${id}/extend-timer`, {}, authHeaders);
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to extend timer');
    }
  };

  // ─── Bid Actions ───
  const handleBidAction = async (bidId, status) => {
    try {
      await axios.put(`${API_URL}/api/seller/bids/${bidId}`, {
        status,
        notes: bidNotes[bidId] || null
      }, authHeaders);
      toast.success(`Bid ${status}!`);
      setBidNotes(prev => { const n = {...prev}; delete n[bidId]; return n; });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update bid');
    }
  };

  const fetchFilteredBids = async (filter) => {
    setBidsFilter(filter);
    try {
      const url = filter === 'all' ? `${API_URL}/api/seller/bids` : `${API_URL}/api/seller/bids?status=${filter}`;
      const res = await axios.get(url, authHeaders);
      setBids(res.data);
    } catch { toast.error('Failed to filter bids'); }
  };

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
    { key: 'products', label: 'My Products' },
    { key: 'bids', label: 'Bids Received' }
  ];

  const firstName = user?.full_name?.split(' ')[0];
  const greeting = getGreeting(firstName);

  return (
    <div data-testid="seller-dashboard" className="min-h-screen bg-[#f5f0e8] pt-20">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-1 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#1a3a1a]">{greeting} 👋</h1>
              <span className="text-[11px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                Seller
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {products.filter(p => p.listing_status === 'active').length > 0
                ? `${products.filter(p => p.listing_status === 'active').length} active listing${products.filter(p => p.listing_status === 'active').length > 1 ? 's' : ''} · ${bidsSummary.pending || 0} pending bid${bidsSummary.pending !== 1 ? 's' : ''}`
                : 'No active listings. Add your first product to get started.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {user?.role === 'both' && (
              <Link
                to="/dashboard"
                data-testid="switch-to-buyer-btn"
                className="text-xs font-semibold text-[#2d5a27] border border-[#2d5a27]/60 px-3 py-1.5 rounded-full hover:bg-[#2d5a27]/5 transition-colors whitespace-nowrap"
              >
                Switch to Buyer →
              </Link>
            )}
            <button
              data-testid="seller-add-product-btn-header"
              onClick={() => { setActiveTab('products'); openProductForm(); }}
              className="inline-flex items-center gap-2 bg-[#2d5a27] text-white px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-[#1a3a1a] transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="flex gap-2 mb-5 mt-4 overflow-x-auto scrollbar-none">
          {[
            { icon: <Home size={14} />,        label: 'Home',     to: '/'         },
            { icon: <ShoppingBag size={14} />, label: 'Products', to: '/products' },
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

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-100">
            <div className="flex">
              {tabs.map(t => (
                <button key={t.key} data-testid={`seller-tab-${t.key}`} onClick={() => setActiveTab(t.key)}
                  className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === t.key ? 'text-[#2d5a27] border-b-2 border-[#2d5a27]' : 'text-gray-400 hover:text-[#1a3a1a]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* ═══ PRODUCTS TAB ═══ */}
            {activeTab === 'products' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <p className="text-sm text-muted-foreground">{products.length} products</p>
                  <button data-testid="seller-add-product-btn" onClick={() => openProductForm()} className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                    <Plus size={16} /> Add Product
                  </button>
                </div>

                {/* Product Form */}
                {showProductForm && (
                  <form onSubmit={saveProduct} data-testid="seller-product-form" className="border border-primary rounded-xl p-6 mb-6 bg-primary/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-foreground">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
                      <button type="button" onClick={() => setShowProductForm(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Product Name *</label>
                        <input
                          type="text" data-testid="seller-product-name"
                          value={productForm.name}
                          onChange={e => { setProductForm({...productForm, name: e.target.value}); if (productFormErrors.name) setProductFormErrors(prev => ({...prev, name: undefined})); }}
                          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${productFormErrors.name ? 'border-red-400' : 'border-border'}`}
                          placeholder="Green Cardamom - 6 mm to 7 mm"
                        />
                        {productFormErrors.name && <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Size / Grade *</label>
                        <input
                          type="text" data-testid="seller-product-size"
                          value={productForm.size}
                          onChange={e => { setProductForm({...productForm, size: e.target.value}); if (productFormErrors.size) setProductFormErrors(prev => ({...prev, size: undefined})); }}
                          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${productFormErrors.size ? 'border-red-400' : 'border-border'}`}
                          placeholder="6 mm to 7 mm"
                        />
                        {productFormErrors.size && <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.size}</p>}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-foreground">Description *</label>
                        <span className={`text-[10px] font-mono ${productForm.description.length > 480 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {productForm.description.length}/500
                        </span>
                      </div>
                      <textarea
                        data-testid="seller-product-desc"
                        value={productForm.description}
                        onChange={e => { setProductForm({...productForm, description: e.target.value}); if (productFormErrors.description) setProductFormErrors(prev => ({...prev, description: undefined})); }}
                        rows={2}
                        maxLength={500}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white ${productFormErrors.description ? 'border-red-400' : 'border-border'}`}
                        placeholder="Describe your product quality, origin, and characteristics (20-500 chars)"
                      />
                      {productFormErrors.description && <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.description}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Features (comma-separated) *</label>
                      <input
                        type="text" data-testid="seller-product-features"
                        value={productForm.features}
                        onChange={e => { setProductForm({...productForm, features: e.target.value}); if (productFormErrors.features) setProductFormErrors(prev => ({...prev, features: undefined})); }}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${productFormErrors.features ? 'border-red-400' : 'border-border'}`}
                        placeholder="Clean pods, Good aroma, Export quality"
                      />
                      {productFormErrors.features && <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.features}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">Enter at least 2 features, separated by commas</p>
                    </div>

                    {/* Pricing & Quantity */}
                    <div className="p-4 border border-primary/20 rounded-xl bg-primary/3 space-y-3">
                      <p className="text-xs font-bold text-foreground uppercase tracking-wide">Pricing & Quantity</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Base Price * <span className="text-muted-foreground font-normal">(per kg)</span></label>
                          <input
                            type="number" min="0" step="0.01"
                            data-testid="seller-base-price"
                            value={productForm.base_price}
                            onChange={e => { setProductForm({...productForm, base_price: e.target.value}); if (productFormErrors.base_price) setProductFormErrors(prev => ({...prev, base_price: undefined})); }}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${productFormErrors.base_price ? 'border-red-400' : 'border-border'}`}
                            placeholder="e.g. 2400"
                          />
                          {productFormErrors.base_price && <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.base_price}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Currency *</label>
                          <div className="flex rounded-lg overflow-hidden border border-border">
                            {['INR','USD'].map(c => (
                              <button
                                key={c} type="button"
                                onClick={() => setProductForm({...productForm, base_price_currency: c})}
                                className={`flex-1 py-2 text-sm font-semibold transition-colors ${productForm.base_price_currency === c ? 'bg-primary text-white' : 'bg-white text-muted-foreground hover:bg-muted'}`}
                              >{c}</button>
                            ))}
                          </div>
                        </div>
                        {/* Bid duration stays here only when adding */}
                        <div className="md:col-span-1" />
                      </div>
                      {/* Total qty + Min qty side by side */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Total Stock (kg) *</label>
                          <input
                            type="number" min="1" step="0.1"
                            data-testid="seller-total-qty"
                            value={productForm.total_quantity_kg}
                            onChange={e => { setProductForm({...productForm, total_quantity_kg: e.target.value}); if (productFormErrors.total_quantity_kg) setProductFormErrors(prev => ({...prev, total_quantity_kg: undefined, minimum_quantity_kg: undefined})); }}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${productFormErrors.total_quantity_kg ? 'border-red-400' : 'border-border'}`}
                            placeholder="e.g. 1000"
                          />
                          {productFormErrors.total_quantity_kg
                            ? <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.total_quantity_kg}</p>
                            : <p className="text-[10px] text-muted-foreground mt-1">Total stock available for this listing</p>
                          }
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Min. Order (kg) *</label>
                          <input
                            type="number" min="1" step="0.1"
                            data-testid="seller-min-qty"
                            value={productForm.minimum_quantity_kg}
                            onChange={e => { setProductForm({...productForm, minimum_quantity_kg: e.target.value}); if (productFormErrors.minimum_quantity_kg) setProductFormErrors(prev => ({...prev, minimum_quantity_kg: undefined})); }}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white ${productFormErrors.minimum_quantity_kg ? 'border-red-400' : 'border-border'}`}
                            placeholder="e.g. 100"
                          />
                          {productFormErrors.minimum_quantity_kg
                            ? <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.minimum_quantity_kg}</p>
                            : <p className="text-[10px] text-muted-foreground mt-1">Minimum quantity per bid</p>
                          }
                        </div>
                      </div>
                    </div>

                    {/* Bid Duration */}
                    {!editingProduct && (
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          <Timer size={12} className="inline mr-1" />Bidding Window *
                        </label>
                        <select
                          value={productForm.bid_duration_hours}
                          onChange={e => setProductForm({...productForm, bid_duration_hours: Number(e.target.value)})}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          data-testid="seller-bid-duration"
                        >
                          {[1,2,3,4,5,6,7,8].map(h => (
                            <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Bidding closes {productForm.bid_duration_hours} hour{productForm.bid_duration_hours > 1 ? 's' : ''} after submission.
                          You can extend up to 2 times after expiry.
                        </p>
                      </div>
                    )}

                    {/* Media Upload */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-2">
                        Photos & Videos * <span className="text-muted-foreground font-normal">(Min 1, Max 4)</span>
                      </label>

                      {existingMedia.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-3">
                          {existingMedia.map((path, idx) => (
                            <div key={`existing-${idx}`} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border bg-white">
                              {isVideo(path) ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100"><Film size={24} className="text-muted-foreground" /></div>
                              ) : (
                                <img src={getMediaUrl(path)} alt="" className="w-full h-full object-cover" />
                              )}
                              <button type="button" onClick={() => removeExistingMedia(idx)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}

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
                              <button type="button" onClick={() => removeNewFile(idx)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {(existingMedia.length + mediaFiles.length) < 4 && (
                        <button type="button" data-testid="seller-media-upload-btn" onClick={() => fileInputRef.current?.click()} className={`inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors ${productFormErrors.media ? 'border-red-400 text-red-600' : 'border-primary/40 text-primary'}`}>
                          <Upload size={16} /> Add {existingMedia.length + mediaFiles.length === 0 ? 'Photos/Videos' : 'More'} <span className="font-normal opacity-70">({existingMedia.length + mediaFiles.length}/4)</span>
                        </button>
                      )}
                      {productFormErrors.media && <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={11} />{productFormErrors.media}</p>}
                      <input ref={fileInputRef} type="file" accept={ACCEPT_STRING} multiple onChange={handleFileSelect} className="hidden" data-testid="seller-media-file-input" />
                    </div>

                    <div className="p-3 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                      Products are submitted for admin review. Once approved, they will be visible to buyers.
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !isFormValid}
                      data-testid="seller-product-save-btn"
                      className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                        isFormValid
                          ? 'bg-primary text-white hover:bg-primary/90'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      } disabled:opacity-70`}
                    >
                      {saving
                        ? (<><Loader2 size={16} className="animate-spin" /> Saving...</>)
                        : isFormValid
                          ? (editingProduct ? 'Update Product' : 'Submit Product')
                          : 'Fill all required fields'
                      }
                    </button>
                  </form>
                )}

                {/* Product list filter tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[
                    { key: 'pending_approval', label: 'Under Review', color: 'bg-yellow-500' },
                    { key: 'active',           label: 'Active',       color: 'bg-green-500'  },
                    { key: 'expired',          label: 'Expired',      color: 'bg-orange-500' },
                    { key: 'sold',             label: 'Sold',         color: 'bg-blue-500'   },
                    { key: 'archived',         label: 'Archived',     color: 'bg-gray-400'   },
                    { key: 'rejected',         label: 'Rejected',     color: 'bg-red-500'    },
                  ].map(({ key, label, color }) => {
                    const count = products.filter(p => p.listing_status === key).length;
                    return (
                      <button key={key} onClick={() => setProductListFilter(key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${productListFilter === key ? `${color} text-white` : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                        {label}
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${productListFilter === key ? 'bg-white/30' : 'bg-muted-foreground/20'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Product list */}
                <div className="space-y-3">
                  {products.filter(p => p.listing_status === productListFilter).length === 0 && !showProductForm && (
                    <div className="text-center py-12">
                      <Package className="mx-auto text-muted-foreground mb-4" size={48} />
                      <p className="text-muted-foreground mb-4">
                        {productListFilter === 'pending_approval' ? 'No products under review.' :
                         productListFilter === 'active' ? 'No active products. Add your first listing!' :
                         productListFilter === 'expired' ? 'No expired listings.' :
                         productListFilter === 'sold' ? 'No products sold yet.' :
                         productListFilter === 'rejected' ? 'No rejected products.' :
                         'No archived products.'}
                      </p>
                    </div>
                  )}
                  {products.filter(p => p.listing_status === productListFilter).map(p => (
                    <div key={p.id} data-testid={`seller-product-${p.id}`} className="border border-border rounded-xl p-4 hover:border-primary/50 transition-colors bg-white">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail — uses shared imageHelper (handles video poster frames) */}
                        {(() => {
                          const thumbSrc = getProductImage(p);
                          return thumbSrc ? (
                            <img src={thumbSrc} alt={p.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-2xl">🌿</span>
                            </div>
                          );
                        })()}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-1">
                            <h3 className="font-semibold text-foreground text-sm leading-snug">{p.name}</h3>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Actions inline on mobile */}
                              {p.listing_status === 'expired' && (
                                <button
                                  onClick={() => extendTimer(p.id)}
                                  disabled={(p.extension_count || 0) >= 2}
                                  title={(p.extension_count || 0) >= 2 ? 'Max extensions reached' : 'Extend timer by 2h'}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <RotateCcw size={10} /> Extend
                                </button>
                              )}
                              {p.listing_status === 'active' && (
                                <button data-testid={`seller-edit-product-${p.id}`} onClick={() => openProductForm(p)} className="p-1.5 border border-border rounded-lg hover:bg-muted transition-colors" title="Edit"><Pencil size={14} className="text-foreground" /></button>
                              )}
                              <button data-testid={`seller-delete-product-${p.id}`} onClick={() => deleteProduct(p.id)} className="p-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={14} className="text-red-500" /></button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${listingBadge(p.listing_status)}`}>{p.listing_status}</span>
                            <span className="text-xs text-muted-foreground">{p.size}</span>
                          </div>

                          {p.base_price && (
                            <p className="text-xs text-foreground font-medium mb-1">
                              {p.base_price_currency === 'USD' ? '$' : '₹'}{p.base_price.toLocaleString('en-IN')}/kg
                              {p.minimum_quantity_kg ? ` · Min ${p.minimum_quantity_kg} kg` : ''}
                            </p>
                          )}

                          {/* Inventory bar */}
                          {p.total_quantity_kg > 0 && (
                            <div className="mb-1.5">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                <span>Stock: <strong className="text-foreground">{(p.remaining_quantity_kg ?? p.total_quantity_kg).toLocaleString('en-IN')} / {p.total_quantity_kg.toLocaleString('en-IN')} kg</strong></span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden w-full">
                                {(() => {
                                  const pct = Math.round(((p.remaining_quantity_kg ?? p.total_quantity_kg) / p.total_quantity_kg) * 100);
                                  const color = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
                                  return <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />;
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Status line */}
                          {p.listing_status === 'active' && p.bid_end_time && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Timer size={11} className="text-green-600" />
                              <span>Closes in:</span>
                              <MiniCountdown endTime={p.bid_end_time} />
                              <span>• {p.total_bids_received || 0} bids</span>
                            </div>
                          )}
                          {p.listing_status === 'pending_approval' && (
                            <p className="text-[10px] text-yellow-700 font-medium">⏳ Awaiting admin review</p>
                          )}
                          {p.listing_status === 'rejected' && (
                            <p className="text-[10px] text-red-600 font-medium">✗ Rejected by admin</p>
                          )}
                          {p.listing_status === 'expired' && (
                            <div className="flex items-center gap-1.5 text-xs text-orange-600">
                              <AlertCircle size={11} />
                              <span>Bidding ended · {p.total_bids_received || 0} bids</span>
                            </div>
                          )}
                          {(p.listing_status === 'sold' || p.listing_status === 'archived') && p.sold_to_buyer_name && (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600">
                              <CheckCircle size={11} />
                              <span>Sold to <strong>{p.sold_to_buyer_name}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ BIDS TAB ═══ */}
            {activeTab === 'bids' && (() => {
              const bidCounts = {
                all: bids.length,
                pending:  bids.filter(b => b.status === 'pending').length,
                accepted: bids.filter(b => b.status === 'accepted').length,
                rejected: bids.filter(b => b.status === 'rejected').length,
              };
              const visibleBids = bidsFilter === 'all' ? bids : bids.filter(b => b.status === bidsFilter);
              return (
                <div>
                  {/* Filter pills */}
                  <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
                    {['all', 'pending', 'accepted', 'rejected'].map(f => {
                      const active = bidsFilter === f;
                      const label = f.charAt(0).toUpperCase() + f.slice(1);
                      return (
                        <button
                          key={f}
                          data-testid={`seller-bids-filter-${f}`}
                          onClick={() => setBidsFilter(f)}
                          className={`flex-shrink-0 h-9 px-4 rounded-full text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 border ${
                            active
                              ? 'bg-green-800 text-white border-green-800'
                              : 'bg-white border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                          }`}
                        >
                          {label}
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                            active ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'
                          }`}>{bidCounts[f]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {bids.length === 0 ? (
                    <div className="text-center py-12">
                      <Gavel className="mx-auto text-muted-foreground mb-4" size={48} />
                      <p className="text-muted-foreground">No bids received yet</p>
                    </div>
                  ) : visibleBids.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">No {bidsFilter} bids.</p>
                      <button onClick={() => setBidsFilter('all')} className="mt-2 text-primary text-sm font-semibold hover:underline">Show all</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visibleBids.map(b => {
                        const qty = [b.quantity_kg && `${b.quantity_kg} kg`, b.quantity_lot && `${b.quantity_lot} lots`].filter(Boolean).join(' · ');
                        const price = [b.price_per_kg && `${b.currency} ${b.price_per_kg}/kg`, b.price_per_lot && `${b.currency} ${b.price_per_lot}/lot`].filter(Boolean).join(' · ');
                        const badge = b.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : b.status === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700';

                        return (
                          <div
                            key={b.id}
                            data-testid={`seller-bid-${b.id}`}
                            className="border border-border rounded-xl overflow-hidden"
                          >
                            {/* Bid info */}
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="font-semibold text-foreground text-sm">{b.buyer_name}</p>
                                  {b.buyer_company && (
                                    <p className="text-xs text-muted-foreground">{b.buyer_company}</p>
                                  )}
                                  {b.buyer_phone && (
                                    <p className="text-[10px] text-green-700 font-semibold mt-0.5">🟢 Verified</p>
                                  )}
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex-shrink-0 ${badge}`}>
                                  {b.status}
                                </span>
                              </div>

                              <div className="text-xs text-foreground mb-1 font-medium">
                                {b.product_name}
                                {b.product_size && <span className="font-normal text-muted-foreground"> · {b.product_size}</span>}
                              </div>

                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mb-1">
                                {qty && <span className="text-foreground font-medium">{qty}</span>}
                                {price && <span className="text-green-700 font-bold">{price}</span>}
                                {b.market_type && <span className="text-muted-foreground capitalize">{b.market_type}</span>}
                              </div>

                              <p className="text-[10px] text-muted-foreground">Placed: {b.bid_date}</p>

                              {b.additional_notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">"{b.additional_notes}"</p>
                              )}

                              {/* Notes/response from seller */}
                              {b.status !== 'pending' && (b.seller_notes || b.admin_notes) && (
                                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                  Note: {b.seller_notes || b.admin_notes}
                                </p>
                              )}
                            </div>

                            {/* Accept / Reject actions for pending bids */}
                            {b.status === 'pending' && (
                              <div className="border-t border-border p-3 bg-muted/30 space-y-3">
                                <input
                                  type="text"
                                  placeholder="Optional notes to buyer..."
                                  data-testid={`seller-bid-notes-${b.id}`}
                                  value={bidNotes[b.id] || ''}
                                  onChange={e => setBidNotes({ ...bidNotes, [b.id]: e.target.value })}
                                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                                />
                                <div className="flex gap-2">
                                  <button
                                    data-testid={`seller-accept-bid-${b.id}`}
                                    onClick={() => handleBidAction(b.id, 'accepted')}
                                    className="flex-1 min-h-[44px] bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-2"
                                  >
                                    ✅ Accept
                                  </button>
                                  <button
                                    data-testid={`seller-reject-bid-${b.id}`}
                                    onClick={() => handleBidAction(b.id, 'rejected')}
                                    className="flex-1 min-h-[44px] bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors inline-flex items-center justify-center gap-2"
                                  >
                                    ❌ Reject
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;

