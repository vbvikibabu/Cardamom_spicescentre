import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowLeft, ChevronLeft, ChevronRight, Film, Check, Gavel } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import LoginModal from '../components/LoginModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API}/files/${path}`;
};

const isVideoPath = (path) => {
  const lower = (path || '').toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov');
};

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMedia, setCurrentMedia] = useState(0);
  const { user, token, isAuthenticated, isApproved } = useAuth();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidForm, setBidForm] = useState({
    quantity_kg: '', quantity_lot: '', price_per_kg: '', price_per_lot: '', currency: 'INR', market_type: 'domestic', additional_notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`${API}/products/${id}`);
        setProduct(res.data);
      } catch {
        toast.error('Product not found');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const requireAuth = (callback) => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    if (!isApproved) { toast.error('Your account is pending approval.'); return; }
    callback();
  };

  const openBidModal = () => requireAuth(() => {
    setBidForm({ quantity_kg: '', quantity_lot: '', price_per_kg: '', price_per_lot: '', currency: 'INR', market_type: 'domestic', additional_notes: '' });
    setShowBidModal(true);
  });

  const submitBid = async (e) => {
    e.preventDefault();
    const hasQty = bidForm.quantity_kg || bidForm.quantity_lot;
    const hasPrice = bidForm.price_per_kg || bidForm.price_per_lot;
    if (!hasQty || !hasPrice) {
      toast.error('Please enter at least one quantity (kg or lot) and one price (per kg or per lot).');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        product_id: product.id,
        currency: bidForm.currency,
        market_type: bidForm.market_type,
        additional_notes: bidForm.additional_notes || undefined
      };
      if (bidForm.quantity_kg) payload.quantity_kg = parseFloat(bidForm.quantity_kg);
      if (bidForm.quantity_lot) payload.quantity_lot = parseFloat(bidForm.quantity_lot);
      if (bidForm.price_per_kg) payload.price_per_kg = parseFloat(bidForm.price_per_kg);
      if (bidForm.price_per_lot) payload.price_per_lot = parseFloat(bidForm.price_per_lot);

      await axios.post(`${API}/bids`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Bid placed successfully! The seller will review your bid.');
      setShowBidModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to place bid');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 gap-4">
        <p className="text-muted-foreground text-lg">Product not found</p>
        <Link to="/products" className="text-primary font-semibold hover:underline">Back to Products</Link>
      </div>
    );
  }

  const mediaPaths = product.media_paths?.length > 0 ? product.media_paths : (product.image_url ? [product.image_url] : []);

  return (
    <div data-testid="product-detail-page" className="min-h-screen pt-20 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8">
        <Link to="/products" data-testid="back-to-products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Back to Products
        </Link>
      </div>

      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Media Gallery */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div data-testid="product-media-gallery" className="relative group rounded-2xl overflow-hidden bg-muted mb-4">
              {mediaPaths.length > 0 && (
                isVideoPath(mediaPaths[currentMedia]) ? (
                  <video src={getMediaUrl(mediaPaths[currentMedia])} controls className="w-full aspect-square object-cover bg-black" />
                ) : (
                  <img src={getMediaUrl(mediaPaths[currentMedia])} alt={product.name} className="w-full aspect-square object-cover" />
                )
              )}
              {mediaPaths.length > 1 && (
                <>
                  <button onClick={() => setCurrentMedia((currentMedia - 1 + mediaPaths.length) % mediaPaths.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronLeft size={22} />
                  </button>
                  <button onClick={() => setCurrentMedia((currentMedia + 1) % mediaPaths.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>
            {mediaPaths.length > 1 && (
              <div className="flex gap-3">
                {mediaPaths.map((path, i) => (
                  <button key={i} onClick={() => setCurrentMedia(i)} data-testid={`media-thumbnail-${i}`} className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${i === currentMedia ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}>
                    {isVideoPath(path) ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100"><Film size={20} className="text-muted-foreground" /></div>
                    ) : (
                      <img src={getMediaUrl(path)} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-xs font-sans tracking-wide uppercase font-bold rounded-full">{product.size}</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Leaf size={14} /> Elettaria cardamomum</span>
            </div>

            <h1 data-testid="product-detail-name" className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-4 leading-tight">{product.name}</h1>
            {product.seller_name && (
              <p data-testid="product-seller-name" className="text-sm text-muted-foreground mb-4">
                Sold by <span className="font-semibold text-foreground">{product.seller_name}</span>
              </p>
            )}
            <p className="text-base text-muted-foreground leading-relaxed mb-8">{product.description}</p>

            <div className="mb-10">
              <h3 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-4 text-foreground">Key Features</h3>
              <ul className="space-y-3">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Check size={12} className="text-primary" /></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Buttons */}
            <div className="mt-auto space-y-3">
              <button data-testid="product-detail-place-bid" onClick={openBidModal} className="w-full inline-flex items-center justify-center gap-3 bg-foreground text-white py-4 rounded-xl font-semibold text-base hover:bg-foreground/90 transition-colors">
                <Gavel size={18} /> Place a Bid
              </button>
              <p className="text-xs text-center text-muted-foreground">Bids are reviewed by the seller. You will be notified of the outcome.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Bid Modal ─── */}
      <Dialog open={showBidModal} onOpenChange={setShowBidModal}>
        <DialogContent data-testid="bid-modal" className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-0">
          <div className="bg-foreground px-6 py-5">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">Place a Bid</DialogTitle>
              <DialogDescription className="text-white/70 text-sm">{product?.name} — {product?.size}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={submitBid} data-testid="bid-form" className="px-6 pb-6 pt-3 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quantity (kg)</label>
                <input type="number" min="0" step="0.01" data-testid="bid-quantity-kg" value={bidForm.quantity_kg} onChange={e => setBidForm({...bidForm, quantity_kg: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. 500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quantity (lots)</label>
                <input type="number" min="0" step="0.01" data-testid="bid-quantity-lot" value={bidForm.quantity_lot} onChange={e => setBidForm({...bidForm, quantity_lot: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. 10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Price per kg</label>
                <input type="number" min="0" step="0.01" data-testid="bid-price-kg" value={bidForm.price_per_kg} onChange={e => setBidForm({...bidForm, price_per_kg: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. 2500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Price per lot</label>
                <input type="number" min="0" step="0.01" data-testid="bid-price-lot" value={bidForm.price_per_lot} onChange={e => setBidForm({...bidForm, price_per_lot: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. 50000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Currency *</label>
                <select data-testid="bid-currency" value={bidForm.currency} onChange={e => setBidForm({...bidForm, currency: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Market Type *</label>
                <select data-testid="bid-market-type" value={bidForm.market_type} onChange={e => setBidForm({...bidForm, market_type: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="domestic">Domestic</option>
                  <option value="export">Export</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Additional Notes</label>
              <textarea data-testid="bid-notes" value={bidForm.additional_notes} onChange={e => setBidForm({...bidForm, additional_notes: e.target.value})} rows={2} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Delivery terms, packaging, etc." />
            </div>
            <p className="text-xs text-muted-foreground">Fill at least one quantity (kg or lot) and one price (per kg or per lot).</p>
            <button type="submit" disabled={submitting} data-testid="bid-submit-btn" className="w-full inline-flex items-center justify-center gap-2 bg-foreground text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50">
              <Gavel size={16} /> {submitting ? 'Placing Bid...' : 'Place Bid'}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
};

export default ProductDetail;
