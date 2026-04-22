import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { User, CheckCircle, XCircle, Package, Plus, Pencil, Trash2, X, Upload, Film, Gavel, ChevronDown, ChevronUp, Tag, Scale, Clock, Radio } from 'lucide-react';
import { getProductImage } from '../utils/imageHelper';

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
  const [productListFilter, setProductListFilter] = useState('active');
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

  // Pending product review panel state
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [reviewImageIdxs, setReviewImageIdxs] = useState({});

  // Bid response state
  const [bidNotes, setBidNotes] = useState({});

  // Auction state
  const [auctionEvents, setAuctionEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventLots, setEventLots] = useState([]);
  const [auctionForm, setAuctionForm] = useState({
    title: '', description: '', location: '', agent_name: '', agent_phone: '',
    auction_date: '', registration_deadline: ''
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (activeTab === 'auctions') fetchAuctionEvents(); }, [activeTab]);

  const fetchData = async () => {
    try {
      const [usersRes, productsRes, bidsRes, bidsSumRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users`, authHeaders),
        axios.get(`${API_URL}/api/admin/products`, authHeaders),
        axios.get(`${API_URL}/api/bids`, authHeaders),
        axios.get(`${API_URL}/api/admin/bids/summary`, authHeaders)
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

  // ─── Auction Actions ───
  const fetchAuctionEvents = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auction/events`, authHeaders);
      setAuctionEvents(res.data);
    } catch { toast.error('Failed to load auction events'); }
  };

  const fetchEventLots = async (eventId) => {
    setLoadingLots(true);
    try {
      const res = await axios.get(`${API_URL}/api/auction/events/${eventId}/lots`, authHeaders);
      setEventLots(res.data);
    } catch { toast.error('Failed to load lots'); }
    finally { setLoadingLots(false); }
  };

  const createAuctionEvent = async (e) => {
    e.preventDefault();
    setCreatingEvent(true);
    try {
      await axios.post(`${API_URL}/api/auction/events`, auctionForm, authHeaders);
      toast.success('Auction event created!');
      setAuctionForm({ title: '', description: '', location: '', agent_name: '', agent_phone: '', auction_date: '', registration_deadline: '' });
      fetchAuctionEvents();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create event'); }
    finally { setCreatingEvent(false); }
  };

  const updateEventStatus = async (eventId, status) => {
    try {
      await axios.patch(`${API_URL}/api/auction/events/${eventId}/status?status=${status}`, {}, authHeaders);
      toast.success(`Event status → ${status}`);
      fetchAuctionEvents();
    } catch { toast.error('Failed to update status'); }
  };

  const approveLot = async (lotId) => {
    try {
      await axios.patch(`${API_URL}/api/auction/lots/${lotId}/approve`, {}, authHeaders);
      toast.success('Lot approved!');
      if (selectedEventId) fetchEventLots(selectedEventId);
    } catch { toast.error('Failed to approve lot'); }
  };

  const startLot = async (lotId) => {
    try {
      await axios.post(`${API_URL}/api/auction/lots/${lotId}/start`, {}, authHeaders);
      toast.success('Bidding started!');
      if (selectedEventId) fetchEventLots(selectedEventId);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to start lot'); }
  };

  const closeLot = async (lotId) => {
    try {
      await axios.post(`${API_URL}/api/auction/lots/${lotId}/close`, {}, authHeaders);
      toast.success('Lot closed!');
      if (selectedEventId) fetchEventLots(selectedEventId);
    } catch { toast.error('Failed to close lot'); }
  };

  const tabs = [
    { key: 'users', label: 'Users' },
    { key: 'pending-products', label: `Pending Products (${products.filter(p => p.approval_status === 'pending').length})` },
    { key: 'bids', label: 'Bids' },
    { key: 'products', label: 'All Products' },
    { key: 'auctions', label: 'Auctions' },
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
              <div className="space-y-3">
                {products.filter(p => p.approval_status === 'pending').length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle className="mx-auto text-green-400 mb-3" size={40} />
                    <p className="text-muted-foreground">No products pending approval</p>
                  </div>
                )}
                {products.filter(p => p.approval_status === 'pending').map(p => {
                  const isExpanded = expandedProductId === p.id;
                  const mediaPaths = p.media_paths?.length > 0 ? p.media_paths : (p.image_url ? [p.image_url] : []);
                  const activeImg = reviewImageIdxs[p.id] ?? 0;
                  const mainImgPath = mediaPaths[activeImg] || mediaPaths[0];
                  const mainImgSrc = mainImgPath ? getMediaUrl(mainImgPath) : null;
                  const submittedDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

                  return (
                    <div key={p.id} data-testid={`pending-product-${p.id}`} className="border border-yellow-200 bg-yellow-50/30 rounded-xl overflow-hidden">
                      {/* ── Collapsed row (tap anywhere to expand) ── */}
                      <div
                        className="flex items-center gap-4 p-4 cursor-pointer"
                        onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                      >
                        {/* Thumb — 80×80 using shared imageHelper */}
                        {(() => {
                          const thumbSrc = getProductImage(p);
                          return (
                            <div className="flex-shrink-0">
                              {thumbSrc ? (
                                <img src={thumbSrc} alt={p.name} className="w-20 h-20 rounded-xl object-cover border border-border" />
                              ) : (
                                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                                  <Film size={20} className="text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                            <span className="flex-shrink-0 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wide">{p.size}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{p.seller_name || 'Unknown Seller'}</span>
                            {p.seller_company ? ` · ${p.seller_company}` : ''}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock size={10} /> Submitted {submittedDate}
                          </p>
                        </div>

                        {/* Actions — stop propagation so they don't toggle expand */}
                        <div
                          className="flex items-center gap-2 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            data-testid={`approve-product-${p.id}`}
                            onClick={() => approveProduct(p.id, 'approved')}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors inline-flex items-center gap-1"
                          >
                            <CheckCircle size={13} /> Approve
                          </button>
                          <button
                            data-testid={`reject-product-${p.id}`}
                            onClick={() => approveProduct(p.id, 'rejected')}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors inline-flex items-center gap-1"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                          {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                        </div>
                      </div>

                      {/* ── Expanded review panel ── */}
                      {isExpanded && (
                        <div className="border-t border-yellow-200 bg-white p-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Left: Image gallery */}
                            <div>
                              {/* Main image */}
                              <div className="w-full h-64 rounded-xl overflow-hidden bg-gray-100 mb-3 border border-border">
                                {mainImgSrc ? (
                                  isVideo(mainImgSrc) ? (
                                    <video src={mainImgSrc} controls className="w-full h-full object-cover bg-black" />
                                  ) : (
                                    <img src={mainImgSrc} alt={p.name} className="w-full h-full object-cover" />
                                  )
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <Package size={32} />
                                  </div>
                                )}
                              </div>
                              {/* Thumbnail strip */}
                              {mediaPaths.length > 1 && (
                                <div className="flex gap-2 flex-wrap">
                                  {mediaPaths.map((path, tIdx) => {
                                    const src = getMediaUrl(path);
                                    const isActive = (reviewImageIdxs[p.id] ?? 0) === tIdx;
                                    return (
                                      <button
                                        key={tIdx}
                                        onClick={() => setReviewImageIdxs(prev => ({ ...prev, [p.id]: tIdx }))}
                                        className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                                      >
                                        {isVideo(path) ? (
                                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                            <Film size={16} className="text-muted-foreground" />
                                          </div>
                                        ) : (
                                          <img src={src} alt="" className="w-full h-full object-cover" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Right: Product details */}
                            <div className="space-y-4">
                              {/* Name + size */}
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Product</p>
                                <h4 className="font-serif text-xl font-bold text-foreground">{p.name}</h4>
                                <span className="inline-block mt-1 px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">{p.size}</span>
                              </div>

                              {/* Description */}
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Description</p>
                                <p className="text-sm text-foreground leading-relaxed">{p.description}</p>
                              </div>

                              {/* Features */}
                              {p.features?.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Features</p>
                                  <ul className="space-y-1">
                                    {p.features.map((f, i) => (
                                      <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                                        <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                          <CheckCircle size={10} className="text-green-600" />
                                        </span>
                                        {f}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Pricing */}
                              <div className="grid grid-cols-2 gap-3">
                                {p.base_price && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1"><Tag size={9} /> Base Price</p>
                                    <p className="text-sm font-bold text-foreground">
                                      {p.base_price_currency === 'USD' ? '$' : '₹'}{p.base_price?.toLocaleString('en-IN')}/kg
                                    </p>
                                  </div>
                                )}
                                {p.minimum_quantity_kg && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1"><Scale size={9} /> Min Order</p>
                                    <p className="text-sm font-bold text-foreground">{p.minimum_quantity_kg} kg</p>
                                  </div>
                                )}
                                {p.total_quantity_kg && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1"><Package size={9} /> Total Stock</p>
                                    <p className="text-sm font-bold text-foreground">{p.total_quantity_kg} kg</p>
                                  </div>
                                )}
                                {p.bid_duration_hours && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1"><Clock size={9} /> Bid Duration</p>
                                    <p className="text-sm font-bold text-foreground">{p.bid_duration_hours}h</p>
                                  </div>
                                )}
                              </div>

                              {/* Seller info */}
                              <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Seller</p>
                                <p className="text-sm font-semibold text-foreground">{p.seller_name || '—'}</p>
                                {p.seller_company && <p className="text-xs text-muted-foreground">{p.seller_company}</p>}
                              </div>

                              {/* Quick action buttons — stacked on mobile, side-by-side on sm+ */}
                              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                <button
                                  data-testid={`review-approve-product-${p.id}`}
                                  onClick={() => { approveProduct(p.id, 'approved'); setExpandedProductId(null); }}
                                  className="flex-1 min-h-[44px] py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors inline-flex items-center justify-center gap-2"
                                >
                                  <CheckCircle size={15} /> Approve & Start Timer
                                </button>
                                <button
                                  data-testid={`review-reject-product-${p.id}`}
                                  onClick={() => { approveProduct(p.id, 'rejected'); setExpandedProductId(null); }}
                                  className="flex-1 min-h-[44px] py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors inline-flex items-center justify-center gap-2"
                                >
                                  <XCircle size={15} /> Reject
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

                {/* Listing status filter tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {['active','expired','sold','archived'].map(f => {
                    const count = products.filter(p => p.listing_status === f).length;
                    const colors = { active:'bg-green-500', expired:'bg-orange-500', sold:'bg-blue-500', archived:'bg-gray-400' };
                    return (
                      <button key={f} onClick={() => setProductListFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize flex items-center gap-1.5 ${productListFilter === f ? `${colors[f]} text-white` : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                        {f} <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${productListFilter === f ? 'bg-white/30' : 'bg-muted-foreground/20'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Product list */}
                <div className="space-y-3">
                  {products.filter(p => p.listing_status === productListFilter).length === 0 && !showProductForm && (
                    <p className="text-center text-muted-foreground py-8">No {productListFilter} products</p>
                  )}
                  {products.filter(p => p.listing_status === productListFilter).map(p => (
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
                          {(p.listing_status === 'sold' || p.listing_status === 'archived') && p.sold_to_buyer_name && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              Sold to {p.sold_to_buyer_name}{p.sold_price ? ` @ ${p.sold_price_currency || 'INR'} ${p.sold_price}` : ''}
                              {p.sold_at ? ` · ${new Date(p.sold_at).toLocaleDateString('en-IN')}` : ''}
                            </p>
                          )}
                          {p.listing_status === 'expired' && (
                            <p className="text-xs text-orange-600 mt-0.5">Bidding closed · {p.total_bids_received || 0} bids</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            p.listing_status === 'active' ? 'bg-green-100 text-green-700' :
                            p.listing_status === 'expired' ? 'bg-orange-100 text-orange-700' :
                            p.listing_status === 'sold' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>{p.listing_status}</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            p.approval_status === 'approved' ? 'bg-green-100 text-green-700' : p.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>{p.approval_status || 'approved'}</span>
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

            {/* ═══ AUCTIONS TAB ═══ */}
            {activeTab === 'auctions' && (
              <div className="space-y-8">

                {/* ── Section 1: Create Event ── */}
                <div>
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Radio size={16} className="text-primary" /> Create Auction Event
                  </h3>
                  <form onSubmit={createAuctionEvent} className="border border-border rounded-xl p-5 bg-muted/30 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Title *</label>
                        <input required value={auctionForm.title} onChange={e => setAuctionForm({...auctionForm, title: e.target.value})}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          placeholder="Bodinayakanur Cardamom Auction — June 2026" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Location *</label>
                        <input required value={auctionForm.location} onChange={e => setAuctionForm({...auctionForm, location: e.target.value})}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          placeholder="Bodinayakanur / Thevaram" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Agent Name *</label>
                        <input required value={auctionForm.agent_name} onChange={e => setAuctionForm({...auctionForm, agent_name: e.target.value})}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          placeholder="Agent / Auctioneer name" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Agent Phone *</label>
                        <input required value={auctionForm.agent_phone} onChange={e => setAuctionForm({...auctionForm, agent_phone: e.target.value})}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          placeholder="+91 98765 43210" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Auction Date & Time *</label>
                        <input required type="datetime-local" value={auctionForm.auction_date} onChange={e => setAuctionForm({...auctionForm, auction_date: e.target.value})}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Registration Deadline *</label>
                        <input required type="datetime-local" value={auctionForm.registration_deadline} onChange={e => setAuctionForm({...auctionForm, registration_deadline: e.target.value})}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Description *</label>
                      <textarea required rows={2} value={auctionForm.description} onChange={e => setAuctionForm({...auctionForm, description: e.target.value})}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white"
                        placeholder="Live auction details, rules, etc." />
                    </div>
                    <button type="submit" disabled={creatingEvent}
                      className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                      {creatingEvent ? 'Creating...' : <><Radio size={15} /> Create Auction Event</>}
                    </button>
                  </form>
                </div>

                {/* ── Section 2: Existing Events ── */}
                <div>
                  <h3 className="font-semibold text-foreground mb-4">Auction Events</h3>
                  {auctionEvents.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">No events created yet</p>
                  ) : (
                    <div className="space-y-3">
                      {auctionEvents.map(ev => {
                        const statusColors = {
                          upcoming: 'bg-blue-100 text-blue-700',
                          registration_open: 'bg-green-100 text-green-700',
                          live: 'bg-red-100 text-red-700',
                          completed: 'bg-gray-100 text-gray-500',
                          cancelled: 'bg-gray-100 text-gray-400',
                        };
                        const nextStatuses = {
                          upcoming: ['registration_open', 'cancelled'],
                          registration_open: ['live', 'upcoming', 'cancelled'],
                          live: ['completed', 'cancelled'],
                          completed: [],
                          cancelled: [],
                        };
                        return (
                          <div key={ev.id} className="border border-border rounded-xl p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h4 className="font-semibold text-foreground">{ev.title}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[ev.status] || 'bg-gray-100 text-gray-500'}`}>
                                    {ev.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  📍 {ev.location} · 👤 {ev.agent_name} · 📅 {new Date(ev.auction_date).toLocaleString('en-IN')}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                {nextStatuses[ev.status]?.map(s => (
                                  <button key={s} onClick={() => updateEventStatus(ev.id, s)}
                                    className="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 transition-colors capitalize">
                                    → {s.replace('_', ' ')}
                                  </button>
                                ))}
                                <button
                                  onClick={() => {
                                    setSelectedEventId(ev.id);
                                    fetchEventLots(ev.id);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    selectedEventId === ev.id
                                      ? 'bg-primary text-white'
                                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                                  }`}
                                >
                                  Manage Lots →
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Section 3: Lot Management ── */}
                {selectedEventId && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Gavel size={16} className="text-primary" />
                      Lots for: {auctionEvents.find(e => e.id === selectedEventId)?.title}
                    </h3>
                    {loadingLots ? (
                      <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></div>
                    ) : eventLots.length === 0 ? (
                      <p className="text-muted-foreground text-sm py-4 text-center">No lots registered yet</p>
                    ) : (
                      <div className="space-y-3">
                        {eventLots.map(lot => {
                          const lotStatusColor = {
                            registered: 'bg-yellow-100 text-yellow-700',
                            approved: 'bg-blue-100 text-blue-700',
                            live: 'bg-red-100 text-red-700',
                            sold: 'bg-green-100 text-green-700',
                            unsold: 'bg-gray-100 text-gray-500',
                          };
                          const selectedEvent = auctionEvents.find(e => e.id === selectedEventId);
                          return (
                            <div key={lot.id} className="border border-border rounded-xl p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs text-muted-foreground font-mono">LOT {lot.lot_number}</span>
                                    <h4 className="font-semibold text-foreground">{lot.product_name}</h4>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${lotStatusColor[lot.lot_status] || 'bg-gray-100 text-gray-500'}`}>
                                      {lot.lot_status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {lot.grade} · {lot.quantity_kg} kg · Starting: {lot.currency} {lot.starting_price?.toLocaleString('en-IN')}/kg
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Seller: <span className="font-medium text-foreground">{lot.seller_name}</span>
                                    {lot.seller_company ? ` · ${lot.seller_company}` : ''}
                                  </p>
                                  {lot.lot_status === 'live' && (
                                    <p className="text-xs text-green-700 font-semibold mt-1">
                                      Current bid: {lot.currency} {lot.current_price?.toLocaleString('en-IN')}/kg
                                      {lot.current_winner_name ? ` — ${lot.current_winner_name}` : ''}
                                    </p>
                                  )}
                                  {lot.lot_status === 'sold' && (
                                    <p className="text-xs text-green-700 font-semibold mt-1">
                                      SOLD: {lot.currency} {lot.sold_price?.toLocaleString('en-IN')}/kg to {lot.current_winner_name}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                  {lot.lot_status === 'registered' && (
                                    <button onClick={() => approveLot(lot.id)}
                                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors inline-flex items-center gap-1">
                                      <CheckCircle size={13} /> Approve Lot
                                    </button>
                                  )}
                                  {lot.lot_status === 'approved' && selectedEvent?.status === 'live' && (
                                    <button onClick={() => startLot(lot.id)}
                                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors inline-flex items-center gap-1">
                                      <Radio size={13} /> Start Bidding
                                    </button>
                                  )}
                                  {lot.lot_status === 'live' && (
                                    <button onClick={() => closeLot(lot.id)}
                                      className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors inline-flex items-center gap-1">
                                      <XCircle size={13} /> Close Lot
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
