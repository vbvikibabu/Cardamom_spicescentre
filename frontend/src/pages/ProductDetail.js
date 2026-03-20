import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Send, ArrowLeft, ChevronLeft, ChevronRight, Film, Check } from 'lucide-react';
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
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    quantity: '', market_type: 'domestic', destination_country: '', shipping_method: '', additional_notes: ''
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

  const openQuoteModal = () => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    if (!isApproved) { toast.error('Your account is pending approval.'); return; }
    setQuoteForm({ quantity: '', market_type: 'domestic', destination_country: '', shipping_method: '', additional_notes: '' });
    setShowQuoteModal(true);
  };

  const submitQuote = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/quotes/request`, {
        product_id: product.id,
        quantity: parseInt(quoteForm.quantity),
        market_type: quoteForm.market_type,
        destination_country: quoteForm.market_type === 'export' ? quoteForm.destination_country : undefined,
        shipping_method: quoteForm.market_type === 'export' && quoteForm.shipping_method ? quoteForm.shipping_method : undefined,
        additional_notes: quoteForm.additional_notes || undefined
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Quote request submitted! We will get back to you soon.');
      setShowQuoteModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit quote request');
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
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8">
        <Link to="/products" data-testid="back-to-products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Back to Products
        </Link>
      </div>

      {/* Product Content */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Media Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Main Image/Video */}
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

            {/* Thumbnails */}
            {mediaPaths.length > 1 && (
              <div className="flex gap-3">
                {mediaPaths.map((path, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentMedia(i)}
                    data-testid={`media-thumbnail-${i}`}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                      i === currentMedia ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                    }`}
                  >
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
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-xs font-sans tracking-wide uppercase font-bold rounded-full">
                {product.size}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Leaf size={14} /> Elettaria cardamomum
              </span>
            </div>

            <h1 data-testid="product-detail-name" className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-6 leading-tight">
              {product.name}
            </h1>

            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              {product.description}
            </p>

            {/* Features */}
            <div className="mb-10">
              <h3 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-4 text-foreground">Key Features</h3>
              <ul className="space-y-3">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-primary" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="mt-auto space-y-4">
              <button
                data-testid="product-detail-request-quote"
                onClick={openQuoteModal}
                className="w-full inline-flex items-center justify-center gap-3 bg-primary text-white py-4 rounded-xl font-semibold text-base hover:bg-primary/90 transition-colors"
              >
                <Send size={18} /> Request a Quote
              </button>
              <p className="text-xs text-center text-muted-foreground">
                Pricing is quote-based for bulk orders. Submit your requirements and we'll respond within 24 hours.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quote Request Modal */}
      <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
        <DialogContent data-testid="quote-request-modal" className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-0">
          <div className="bg-primary px-6 py-5">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">Request a Quote</DialogTitle>
              <DialogDescription className="text-white/80 text-sm">{product.name}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={submitQuote} data-testid="quote-request-form" className="px-6 pb-6 pt-3 space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Quantity (kg) *</label>
              <input type="number" min="1" required data-testid="quote-quantity-input" value={quoteForm.quantity} onChange={e => setQuoteForm({...quoteForm, quantity: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. 500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Market Type *</label>
              <select data-testid="quote-market-type" value={quoteForm.market_type} onChange={e => setQuoteForm({...quoteForm, market_type: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="domestic">Domestic (India)</option>
                <option value="export">Export (International)</option>
              </select>
            </div>
            {quoteForm.market_type === 'export' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Destination Country</label>
                  <input type="text" data-testid="quote-destination-input" value={quoteForm.destination_country} onChange={e => setQuoteForm({...quoteForm, destination_country: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. UAE, USA" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Shipping Method</label>
                  <select data-testid="quote-shipping-method" value={quoteForm.shipping_method} onChange={e => setQuoteForm({...quoteForm, shipping_method: e.target.value})} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select...</option>
                    <option value="air">Air Freight</option>
                    <option value="sea">Sea Freight</option>
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Additional Notes</label>
              <textarea data-testid="quote-notes-input" value={quoteForm.additional_notes} onChange={e => setQuoteForm({...quoteForm, additional_notes: e.target.value})} rows={3} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Packaging preferences, delivery timeline, special requirements..." />
            </div>
            <button type="submit" disabled={submitting} data-testid="quote-submit-btn" className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Quote Request'}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
};

export default ProductDetail;
