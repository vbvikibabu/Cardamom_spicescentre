import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Package, TrendingUp, Award, Send, ChevronLeft, ChevronRight, Film } from 'lucide-react';
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

const MediaGallery = ({ mediaPaths, imageUrl, name }) => {
  const [current, setCurrent] = useState(0);
  const paths = mediaPaths && mediaPaths.length > 0 ? mediaPaths : (imageUrl ? [imageUrl] : []);
  
  if (paths.length === 0) return <div className="w-full h-80 bg-gray-100 flex items-center justify-center text-muted-foreground">No media</div>;

  const src = getMediaUrl(paths[current]);
  const video = isVideoPath(paths[current]);

  return (
    <div className="relative group">
      {video ? (
        <video src={src} controls className="w-full h-80 object-cover bg-black" />
      ) : (
        <img src={src} alt={name} className="w-full h-80 object-cover" />
      )}
      {paths.length > 1 && (
        <>
          <button onClick={() => setCurrent((current - 1 + paths.length) % paths.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCurrent((current + 1) % paths.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {paths.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, token, isAuthenticated, isApproved } = useAuth();
  const navigate = useNavigate();

  // Quote request modal state
  const [quoteProduct, setQuoteProduct] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    quantity: '',
    market_type: 'domestic',
    destination_country: '',
    shipping_method: '',
    additional_notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API}/products`);
        setProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const openQuoteModal = (product) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (!isApproved) {
      toast.error('Your account is pending approval. Please wait for admin approval to request quotes.');
      return;
    }
    setQuoteProduct(product);
    setQuoteForm({ quantity: '', market_type: 'domestic', destination_country: '', shipping_method: '', additional_notes: '' });
  };

  const submitQuote = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        product_id: quoteProduct.id,
        quantity: parseInt(quoteForm.quantity),
        market_type: quoteForm.market_type,
        destination_country: quoteForm.market_type === 'export' ? quoteForm.destination_country : undefined,
        shipping_method: quoteForm.market_type === 'export' && quoteForm.shipping_method ? quoteForm.shipping_method : undefined,
        additional_notes: quoteForm.additional_notes || undefined
      };
      await axios.post(`${API}/quotes/request`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Quote request submitted! We will get back to you soon.');
      setQuoteProduct(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit quote request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="products-loading" className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div data-testid="products-page" className="pt-20">
      {/* Hero */}
      <section className="py-24 bg-muted" data-testid="products-hero">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6">Our Collection</p>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tight leading-tight mb-6 text-foreground">Green Cardamom Varieties</h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Premium quality Green Cardamom (Elettaria cardamomum) in three different size grades to meet diverse market requirements.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-24" data-testid="products-grid">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                data-testid={`product-card-${index}`}
                className="product-card bg-white rounded-lg overflow-hidden border border-primary/10"
              >
                <Link to={`/products/${product.id}`} className="block cursor-pointer">
                  <MediaGallery mediaPaths={product.media_paths} imageUrl={product.image_url} name={product.name} />
                  <div className="p-8 pb-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-sans tracking-wide uppercase font-medium rounded-full">
                        {product.size}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Leaf size={14} /> Elettaria cardamomum
                      </span>
                    </div>
                    <h3 className="font-serif text-2xl md:text-3xl font-semibold mb-4 text-foreground">{product.name}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4 line-clamp-3">{product.description}</p>
                    <span className="text-primary text-sm font-semibold hover:underline">View Details</span>
                  </div>
                </Link>
                <div className="px-8 pb-8">
                  <button
                    data-testid={`request-quote-btn-${index}`}
                    onClick={() => openQuoteModal(product)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
                  >
                    <Send size={16} /> Request a Quote
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-24 bg-muted" data-testid="why-choose-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-6 text-foreground">Why Choose Our Cardamom?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: Award, title: 'Premium Quality', description: 'Hand-selected from the finest plantations' },
              { icon: Package, title: 'Export Ready', description: 'Meeting international packaging standards' },
              { icon: TrendingUp, title: 'Consistent Supply', description: 'Reliable year-round availability' },
              { icon: Leaf, title: 'Sustainable', description: 'Environmentally conscious cultivation' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                data-testid={`why-choose-${index}`}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                  <item.icon size={28} />
                </div>
                <h3 className="font-serif text-xl font-semibold mb-2 text-foreground">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Quote Request Modal ─── */}
      <Dialog open={!!quoteProduct} onOpenChange={(open) => { if (!open) setQuoteProduct(null); }}>
        <DialogContent data-testid="quote-request-modal" className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-0">
          <div className="bg-primary px-6 py-5">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">Request a Quote</DialogTitle>
              <DialogDescription className="text-white/80 text-sm">{quoteProduct?.name}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={submitQuote} data-testid="quote-request-form" className="px-6 pb-6 pt-3 space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Quantity (kg) *</label>
              <input
                type="number" min="1" required data-testid="quote-quantity-input"
                value={quoteForm.quantity}
                onChange={e => setQuoteForm({...quoteForm, quantity: e.target.value})}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. 500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Market Type *</label>
              <select
                data-testid="quote-market-type"
                value={quoteForm.market_type}
                onChange={e => setQuoteForm({...quoteForm, market_type: e.target.value})}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="domestic">Domestic (India)</option>
                <option value="export">Export (International)</option>
              </select>
            </div>
            {quoteForm.market_type === 'export' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Destination Country</label>
                  <input
                    type="text" data-testid="quote-destination-input"
                    value={quoteForm.destination_country}
                    onChange={e => setQuoteForm({...quoteForm, destination_country: e.target.value})}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. UAE, USA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Shipping Method</label>
                  <select
                    data-testid="quote-shipping-method"
                    value={quoteForm.shipping_method}
                    onChange={e => setQuoteForm({...quoteForm, shipping_method: e.target.value})}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="air">Air Freight</option>
                    <option value="sea">Sea Freight</option>
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Additional Notes</label>
              <textarea
                data-testid="quote-notes-input"
                value={quoteForm.additional_notes}
                onChange={e => setQuoteForm({...quoteForm, additional_notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Packaging preferences, delivery timeline, special requirements..."
              />
            </div>
            <button
              type="submit" disabled={submitting} data-testid="quote-submit-btn"
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Quote Request'}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Login Modal for unauthenticated users */}
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
};

export default Products;
