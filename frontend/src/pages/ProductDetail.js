import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowLeft, ChevronLeft, ChevronRight, Film, Check, Gavel, Timer, AlertCircle, BadgeCheck, Tag, Scale, Loader2, XCircle } from 'lucide-react';
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

// Large countdown timer for product detail page
const DetailCountdown = ({ endTime, status }) => {
  const calc = () => {
    if (!endTime || status !== 'active') return null;
    const diff = new Date(endTime) - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, diff };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    if (!endTime || status !== 'active') return;
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  });

  if (status === 'sold') return null; // handled separately
  if (status === 'expired' || (status === 'active' && !time)) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl mb-6">
        <AlertCircle size={18} className="text-orange-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-orange-800">Bidding has ended</p>
          <p className="text-xs text-orange-600">This listing has closed. No new bids can be placed.</p>
        </div>
      </div>
    );
  }
  if (!time) return null;
  const urgent = time.diff < 30 * 60 * 1000;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 border ${urgent ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <Timer size={18} className={urgent ? 'text-red-600 animate-pulse' : 'text-green-700'} />
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${urgent ? 'text-red-700' : 'text-green-800'}`}>
          {urgent ? '⚡ Closing soon!' : 'Bidding open'}
        </p>
        <p className={`font-mono text-xl font-bold ${urgent ? 'text-red-700 animate-pulse' : 'text-green-800'}`}>
          {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
        </p>
      </div>
      {urgent && <p className="text-xs text-red-600 ml-auto">Less than 30 min left</p>}
    </div>
  );
};

// ─── Availability Bar ───────────────────────────────────────────────────────
const AvailabilityBar = ({ total, remaining }) => {
  if (!total || total <= 0) return null;
  const rem = remaining ?? total;
  const pct = Math.max(0, Math.min(100, Math.round((rem / total) * 100)));
  const isLow = pct < 20;
  const isMid = pct >= 20 && pct <= 50;
  const barColor = isLow ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-green-500';
  const textColor = isLow ? 'text-red-600' : isMid ? 'text-amber-600' : 'text-green-700';
  const bgColor = isLow ? 'bg-red-50 border-red-200' : isMid ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200';
  return (
    <div className={`p-3 border rounded-xl mb-5 ${bgColor}`}>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-semibold text-foreground uppercase tracking-wide text-[10px]">Stock Availability</span>
        <span className={`font-bold ${textColor}`}>
          {isLow ? `⚠️ Only ${rem.toLocaleString('en-IN')} kg left!` : `${rem.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} kg available`}
        </span>
      </div>
      <div className="h-2 bg-white/60 rounded-full overflow-hidden border border-white/40">
        <div className={`h-full ${barColor} transition-all duration-300 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-[10px] mt-1.5 ${textColor}`}>
        {pct}% remaining — {rem.toLocaleString('en-IN')} kg of {total.toLocaleString('en-IN')} kg
      </p>
    </div>
  );
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
  const [commitmentChecked, setCommitmentChecked] = useState(false);
  const [bidErrors, setBidErrors] = useState({});
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
    setCommitmentChecked(false);
    setBidErrors({});
    setShowBidModal(true);
  });

  const submitBid = async (e) => {
    e.preventDefault();
    const errors = {};
    const hasQty = bidForm.quantity_kg || bidForm.quantity_lot;
    const hasPrice = bidForm.price_per_kg || bidForm.price_per_lot;

    if (!hasQty) errors.qty = 'Please enter quantity in kg or lots';
    if (!hasPrice) errors.price = 'Please enter price per kg or per lot';

    // Remaining quantity check (blocking)
    const remainingQty = product?.remaining_quantity_kg;
    if (bidForm.quantity_kg && remainingQty !== undefined && remainingQty !== null) {
      const qtyKg = parseFloat(bidForm.quantity_kg);
      if (!isNaN(qtyKg) && qtyKg > remainingQty) {
        errors.quantity_kg = `Only ${remainingQty.toLocaleString('en-IN')} kg available`;
      }
    }

    // Minimum quantity check (blocking)
    const minQty = product?.minimum_quantity_kg;
    if (bidForm.quantity_kg && minQty) {
      const qtyKg = parseFloat(bidForm.quantity_kg);
      if (!isNaN(qtyKg) && qtyKg < minQty) {
        errors.quantity_kg = `Minimum order is ${minQty} kg`;
      }
    }

    // Commitment checkbox
    if (!commitmentChecked) {
      errors.commitment = 'Please confirm this is a genuine bid';
    }

    if (Object.keys(errors).length > 0) {
      setBidErrors(errors);
      return;
    }

    setBidErrors({});
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
      const detail = err.response?.data?.detail || 'Failed to place bid';
      // Map API errors back to inline fields
      if (detail.toLowerCase().includes('kg available')) {
        setBidErrors(prev => ({ ...prev, quantity_kg: detail }));
      } else if (detail.toLowerCase().includes('minimum order')) {
        setBidErrors(prev => ({ ...prev, quantity_kg: detail }));
      } else {
        toast.error(detail);
      }
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

            <h1 data-testid="product-detail-name" className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-6 leading-tight">{product.name}</h1>

            {/* Seller info box */}
            {product.seller_name && (
              <div data-testid="product-seller-box" className="flex items-start gap-3 p-4 border border-border rounded-xl mb-5 bg-muted/40">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BadgeCheck size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Sold by</p>
                  <p className="text-sm font-bold text-foreground" data-testid="product-seller-name">{product.seller_name}</p>
                  {product.seller_company && (
                    <p className="text-xs text-muted-foreground">{product.seller_company}</p>
                  )}
                  <p className="text-[10px] text-green-600 font-semibold mt-1 flex items-center gap-1">
                    <Check size={11} /> Verified Seller
                  </p>
                </div>
              </div>
            )}

            {/* Pricing info box */}
            {(product.base_price || product.minimum_quantity_kg) && (
              <div className="p-4 border border-border rounded-xl mb-5 bg-muted/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Listing Details</p>
                <div className="flex flex-wrap gap-6">
                  {product.base_price && (
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-primary" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Base Price</p>
                        <p className="text-sm font-bold text-foreground">
                          {product.base_price_currency === 'USD' ? '$' : '₹'}{product.base_price.toLocaleString('en-IN')}<span className="text-xs font-normal text-muted-foreground">/kg</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {product.minimum_quantity_kg && (
                    <div className="flex items-center gap-2">
                      <Scale size={16} className="text-primary" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Min. Quantity</p>
                        <p className="text-sm font-bold text-foreground">{product.minimum_quantity_kg} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Availability bar */}
            {product.listing_status === 'active' && product.total_quantity_kg > 0 && (
              <AvailabilityBar total={product.total_quantity_kg} remaining={product.remaining_quantity_kg} />
            )}

            {/* Timer / status banner */}
            <DetailCountdown endTime={product.bid_end_time} status={product.listing_status} />

            {/* Sold info — no buyer name or price exposed */}
            {product.listing_status === 'sold' && (
              <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">This product has been sold</p>
                  <p className="text-xs text-blue-600">
                    Seller: {product.seller_name}{product.seller_company ? ` | ${product.seller_company}` : ''}
                  </p>
                  <Link to="/products" className="text-xs text-primary font-semibold hover:underline mt-1 inline-block">
                    Check our other listings →
                  </Link>
                </div>
              </div>
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
              {product.listing_status === 'active' ? (
                <>
                  <button data-testid="product-detail-place-bid" onClick={openBidModal} className="w-full inline-flex items-center justify-center gap-3 bg-foreground text-white py-4 rounded-xl font-semibold text-base hover:bg-foreground/90 transition-colors">
                    <Gavel size={18} /> Place a Bid
                  </button>
                  <p className="text-xs text-center text-muted-foreground">Bids are reviewed by the seller. You will be notified of the outcome.</p>
                </>
              ) : product.listing_status === 'sold' ? (
                <div className="w-full py-4 rounded-xl bg-blue-100 text-blue-700 font-semibold text-base text-center">
                  Product Sold
                </div>
              ) : (
                <div className="w-full py-4 rounded-xl bg-muted text-muted-foreground font-semibold text-base text-center cursor-not-allowed">
                  Bidding Closed
                </div>
              )}
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
            {/* Reference info bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-muted rounded-lg text-xs">
              {product?.base_price && (
                <>
                  <span className="text-muted-foreground">Base Price:</span>
                  <span className="font-bold text-foreground">
                    {product.base_price_currency === 'USD' ? '$' : '₹'}{product.base_price.toLocaleString('en-IN')}/kg
                  </span>
                </>
              )}
              {product?.minimum_quantity_kg && (
                <>
                  {product?.base_price && <span className="text-border">|</span>}
                  <span className="text-muted-foreground">Min. Qty:</span>
                  <span className="font-bold text-foreground">{product.minimum_quantity_kg} kg</span>
                </>
              )}
              {product?.remaining_quantity_kg !== undefined && product?.remaining_quantity_kg !== null && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-muted-foreground">Max available:</span>
                  <span className="font-bold text-green-700">{product.remaining_quantity_kg.toLocaleString('en-IN')} kg</span>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Quantity (kg)
                  {product?.minimum_quantity_kg && (
                    <span className="text-muted-foreground font-normal"> — min {product.minimum_quantity_kg} kg</span>
                  )}
                </label>
                <input
                  type="number" min="0" step="0.01" data-testid="bid-quantity-kg"
                  max={product?.remaining_quantity_kg ?? undefined}
                  value={bidForm.quantity_kg}
                  onChange={e => {
                    setBidForm({...bidForm, quantity_kg: e.target.value});
                    if (bidErrors.quantity_kg || bidErrors.qty) setBidErrors(prev => ({ ...prev, quantity_kg: undefined, qty: undefined }));
                  }}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    bidErrors.quantity_kg ? 'border-red-400 bg-red-50' : 'border-border'
                  }`}
                  placeholder={product?.minimum_quantity_kg ? `Min. ${product.minimum_quantity_kg} kg` : 'e.g. 500'}
                />
                {bidErrors.quantity_kg && (
                  <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <XCircle size={12} />{bidErrors.quantity_kg}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quantity (lots)</label>
                <input
                  type="number" min="0" step="0.01" data-testid="bid-quantity-lot"
                  value={bidForm.quantity_lot}
                  onChange={e => {
                    setBidForm({...bidForm, quantity_lot: e.target.value});
                    if (bidErrors.qty) setBidErrors(prev => ({ ...prev, qty: undefined }));
                  }}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 10"
                />
              </div>
            </div>
            {bidErrors.qty && (
              <p className="flex items-center gap-1 text-xs text-red-600 -mt-2">
                <XCircle size={12} />{bidErrors.qty}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Price per kg
                  {product?.base_price && <span className="text-muted-foreground font-normal"> (base ₹{product.base_price})</span>}
                </label>
                <input
                  type="number" min="0" step="0.01" data-testid="bid-price-kg"
                  value={bidForm.price_per_kg}
                  onChange={e => {
                    setBidForm({...bidForm, price_per_kg: e.target.value});
                    if (bidErrors.price) setBidErrors(prev => ({ ...prev, price: undefined }));
                  }}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    bidErrors.price ? 'border-red-400 bg-red-50' : 'border-border'
                  }`}
                  placeholder={product?.base_price ? `Base: ${product.base_price}` : 'e.g. 2500'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Price per lot</label>
                <input
                  type="number" min="0" step="0.01" data-testid="bid-price-lot"
                  value={bidForm.price_per_lot}
                  onChange={e => {
                    setBidForm({...bidForm, price_per_lot: e.target.value});
                    if (bidErrors.price) setBidErrors(prev => ({ ...prev, price: undefined }));
                  }}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 50000"
                />
              </div>
            </div>
            {bidErrors.price && (
              <p className="flex items-center gap-1 text-xs text-red-600 -mt-2">
                <XCircle size={12} />{bidErrors.price}
              </p>
            )}

            {/* Below-base-price soft warning */}
            {product?.base_price && bidForm.price_per_kg && parseFloat(bidForm.price_per_kg) < product.base_price && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Your bid is below the base price. The seller may still consider it.
              </p>
            )}

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

            {/* Commitment checkbox */}
            <div>
              <label className={`flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border transition-colors ${
                bidErrors.commitment ? 'border-red-400 bg-red-50' : 'border-border bg-muted/40 hover:bg-muted'
              }`}>
                <input
                  type="checkbox"
                  data-testid="bid-commitment-checkbox"
                  checked={commitmentChecked}
                  onChange={e => {
                    setCommitmentChecked(e.target.checked);
                    if (bidErrors.commitment) setBidErrors(prev => ({ ...prev, commitment: undefined }));
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-foreground flex-shrink-0"
                />
                <span className="text-xs text-foreground leading-relaxed">
                  I confirm this is a genuine bid and I am prepared to fulfil it if accepted by the seller.
                </span>
              </label>
              {bidErrors.commitment && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <XCircle size={12} />{bidErrors.commitment}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="bid-submit-btn"
              className="w-full inline-flex items-center justify-center gap-2 bg-foreground text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
              {submitting ? 'Placing Bid...' : 'Place Bid'}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
};

export default ProductDetail;
