import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowLeft, ChevronLeft, ChevronRight, Film, Check, Gavel, Timer, AlertCircle, BadgeCheck, Scale, Loader2, XCircle } from 'lucide-react';
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

const FieldError = ({ msg }) => msg ? (
  <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={12} />{msg}</p>
) : null;

// Pure validator — recomputed on every render so errors appear as the user types, not just on submit.
const computeBidErrors = (form, product, isAuthenticated, commitmentChecked) => {
  const errors = {};
  const isLot = form.quantity_unit === 'lot';
  const qtyValue = isLot ? form.quantity_lot : form.quantity_kg;
  const priceValue = isLot ? form.price_per_lot : form.price_per_kg;
  const qtyNum = parseFloat(qtyValue);
  const priceNum = parseFloat(priceValue);

  if (!qtyValue || isNaN(qtyNum) || qtyNum <= 0) {
    errors.quantity = 'Enter a quantity greater than 0';
  } else if (!isLot) {
    const minQty = product?.minimum_quantity_kg;
    const remainingQty = product?.remaining_quantity_kg;
    if (minQty && qtyNum < minQty) {
      errors.quantity = `Minimum order is ${minQty} kg`;
    } else if (remainingQty !== undefined && remainingQty !== null && qtyNum > remainingQty) {
      errors.quantity = `Only ${remainingQty.toLocaleString('en-IN')} kg available`;
    }
  }

  if (!priceValue || isNaN(priceNum) || priceNum <= 0) {
    errors.price = 'Enter a price greater than 0';
  }

  if (!isAuthenticated) {
    if (!form.guest_name.trim()) errors.guest_name = 'Enter your name';
    if (!form.guest_phone.trim()) errors.guest_phone = 'Enter a phone number';
    if (!form.guest_email.trim()) {
      errors.guest_email = 'Enter your email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guest_email.trim())) {
      errors.guest_email = 'Enter a valid email address';
    }
  }

  if (!commitmentChecked) {
    errors.commitment = 'Confirm this is a genuine offer';
  }

  return errors;
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
      <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl mb-4">
        <AlertCircle size={18} className="text-orange-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-orange-800">Enquiries have closed</p>
          <p className="text-xs text-orange-600">This listing has closed. No new enquiries can be submitted.</p>
        </div>
      </div>
    );
  }
  if (!time) return null;
  const urgent = time.diff < 30 * 60 * 1000;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border ${urgent ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <Timer size={18} className={urgent ? 'text-red-600 animate-pulse' : 'text-green-700'} />
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${urgent ? 'text-red-700' : 'text-green-800'}`}>
          {urgent ? '⚡ Closing soon!' : 'Enquiries open'}
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
    <div className={`p-3 border rounded-xl mb-4 ${bgColor}`}>
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
  const emptyBidForm = {
    quantity_unit: 'kg', quantity_kg: '', quantity_lot: '', price_per_kg: '', price_per_lot: '', currency: 'INR', market_type: 'domestic', additional_notes: '',
    guest_name: '', guest_company: '', guest_phone: '', guest_email: '', website: ''
  };
  const [bidForm, setBidForm] = useState(emptyBidForm);
  const [commitmentChecked, setCommitmentChecked] = useState(false);
  const [touched, setTouched] = useState({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Recomputed every render — errors update live as the user types, not just on submit.
  const bidFormErrors = useMemo(
    () => computeBidErrors(bidForm, product, isAuthenticated, commitmentChecked),
    [bidForm, product, isAuthenticated, commitmentChecked]
  );
  const isBidFormValid = Object.keys(bidFormErrors).length === 0;
  const markTouched = (field) => setTouched(prev => (prev[field] ? prev : { ...prev, [field]: true }));
  const showFieldError = (field) => (touched[field] || attemptedSubmit) ? bidFormErrors[field] : undefined;

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
    if (!isAuthenticated) {
      // Save current product page so user is returned here after login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      setShowLoginModal(true);
      return;
    }
    if (!isApproved) { toast.error('Your account is pending approval.'); return; }
    callback();
  };

  const resetAndOpenBidModal = () => {
    setBidForm(emptyBidForm);
    setCommitmentChecked(false);
    setTouched({});
    setAttemptedSubmit(false);
    setShowBidModal(true);
  };

  // Logged-in buyers still go through the approval gate; guests skip straight to the form.
  const openBidModal = () => {
    if (isAuthenticated) {
      requireAuth(resetAndOpenBidModal);
    } else {
      resetAndOpenBidModal();
    }
  };

  const submitBid = async (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!isBidFormValid) return;

    setSubmitting(true);
    try {
      const isLot = bidForm.quantity_unit === 'lot';
      const payload = {
        product_id: product.id,
        currency: bidForm.currency,
        market_type: bidForm.market_type,
        additional_notes: bidForm.additional_notes || undefined,
        website: bidForm.website || undefined
      };
      if (isLot) {
        payload.quantity_lot = parseFloat(bidForm.quantity_lot);
        payload.price_per_lot = parseFloat(bidForm.price_per_lot);
      } else {
        payload.quantity_kg = parseFloat(bidForm.quantity_kg);
        payload.price_per_kg = parseFloat(bidForm.price_per_kg);
      }
      if (!isAuthenticated) {
        payload.guest_name = bidForm.guest_name.trim();
        payload.guest_company = bidForm.guest_company.trim() || undefined;
        payload.guest_phone = bidForm.guest_phone.trim();
        payload.guest_email = bidForm.guest_email.trim();
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/bids`, payload, { headers });
      toast.success('Enquiry sent successfully! The seller will review your request.');
      setShowBidModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send enquiry');
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

            {/* Listing details box */}
            {product.minimum_quantity_kg && (
              <div className="p-4 border border-border rounded-xl mb-5 bg-muted/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Listing Details</p>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Scale size={16} className="text-primary" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Min. Quantity</p>
                      <p className="text-sm font-bold text-foreground">{product.minimum_quantity_kg} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                    </div>
                  </div>
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
                (() => {
                  const isOwnProduct = isAuthenticated && user?.id === product.seller_id;
                  const isSellerOnly = isAuthenticated && user?.role === 'seller';
                  const cannotBid = isOwnProduct || isSellerOnly;
                  if (cannotBid) {
                    return (
                      <div className="w-full py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm text-center">
                        {isOwnProduct ? '🚫 This is your listing — you cannot request a price on it.' : '🚫 Sellers cannot request prices.'}
                      </div>
                    );
                  }
                  return (
                    <>
                      <button data-testid="product-detail-place-bid" onClick={openBidModal} className="w-full inline-flex items-center justify-center gap-3 bg-foreground text-white py-4 rounded-xl font-semibold text-base hover:bg-foreground/90 transition-colors">
                        <Gavel size={18} /> Request a Price
                      </button>
                      <p className="text-xs text-center text-muted-foreground">Enquiries are reviewed by the seller. You will be notified of the outcome.</p>
                    </>
                  );
                })()
              ) : product.listing_status === 'sold' ? (
                <div className="w-full py-4 rounded-xl bg-blue-100 text-blue-700 font-semibold text-base text-center">
                  Product Sold
                </div>
              ) : (
                <div className="w-full py-4 rounded-xl bg-muted text-muted-foreground font-semibold text-base text-center cursor-not-allowed">
                  Enquiries Closed
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Bid Modal ─── */}
      <Dialog open={showBidModal} onOpenChange={setShowBidModal}>
        <DialogContent data-testid="bid-modal" className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-0 flex flex-col max-h-[90vh]">
          <div className="bg-foreground px-6 py-5 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">Request a Price</DialogTitle>
              <DialogDescription className="text-white/70 text-sm">{product?.name} — {product?.size}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={submitBid} data-testid="bid-form" className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 pt-3 pb-4 space-y-4">
              {/* Reference info bar */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-muted rounded-lg text-xs">
                {product?.minimum_quantity_kg && (
                  <>
                    <span className="text-muted-foreground">Min. Qty:</span>
                    <span className="font-bold text-foreground">{product.minimum_quantity_kg} kg</span>
                  </>
                )}
                {product?.remaining_quantity_kg !== undefined && product?.remaining_quantity_kg !== null && (
                  <>
                    {product?.minimum_quantity_kg && <span className="text-border">|</span>}
                    <span className="text-muted-foreground">Max available:</span>
                    <span className="font-bold text-green-700">{product.remaining_quantity_kg.toLocaleString('en-IN')} kg</span>
                  </>
                )}
              </div>

              {/* Guest contact details — only shown to logged-out visitors */}
              {!isAuthenticated && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                  <p className="text-xs text-blue-800 font-medium">No account needed — we'll contact you directly about this enquiry.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Your Name *</label>
                      <input
                        type="text" data-testid="bid-guest-name"
                        value={bidForm.guest_name}
                        onChange={e => setBidForm({...bidForm, guest_name: e.target.value})}
                        onBlur={() => markTouched('guest_name')}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                          showFieldError('guest_name') ? 'border-red-400 bg-red-50' : 'border-border'
                        }`}
                        placeholder="Full name"
                      />
                      <FieldError msg={showFieldError('guest_name')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Company (optional)</label>
                      <input
                        type="text" data-testid="bid-guest-company"
                        value={bidForm.guest_company}
                        onChange={e => setBidForm({...bidForm, guest_company: e.target.value})}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Company name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Phone *</label>
                      <input
                        type="tel" data-testid="bid-guest-phone"
                        value={bidForm.guest_phone}
                        onChange={e => setBidForm({...bidForm, guest_phone: e.target.value})}
                        onBlur={() => markTouched('guest_phone')}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                          showFieldError('guest_phone') ? 'border-red-400 bg-red-50' : 'border-border'
                        }`}
                        placeholder="+91 98765 43210"
                      />
                      <FieldError msg={showFieldError('guest_phone')} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                      <input
                        type="email" data-testid="bid-guest-email"
                        value={bidForm.guest_email}
                        onChange={e => setBidForm({...bidForm, guest_email: e.target.value})}
                        onBlur={() => markTouched('guest_email')}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                          showFieldError('guest_email') ? 'border-red-400 bg-red-50' : 'border-border'
                        }`}
                        placeholder="you@example.com"
                      />
                      <FieldError msg={showFieldError('guest_email')} />
                    </div>
                  </div>
                  {/* Honeypot — invisible to real visitors, left for bots that autofill every field */}
                  <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                    <label htmlFor="bid-website">Website</label>
                    <input
                      type="text" id="bid-website" name="website" tabIndex={-1} autoComplete="off"
                      value={bidForm.website}
                      onChange={e => setBidForm({...bidForm, website: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* Quantity unit — kg and lots are mutually exclusive, pick one */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quote In *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBidForm(prev => ({ ...prev, quantity_unit: 'kg' }))}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      bidForm.quantity_unit === 'kg' ? 'border-foreground bg-foreground text-white' : 'border-border text-muted-foreground hover:border-foreground/40'
                    }`}
                  >
                    Per kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setBidForm(prev => ({ ...prev, quantity_unit: 'lot' }))}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      bidForm.quantity_unit === 'lot' ? 'border-foreground bg-foreground text-white' : 'border-border text-muted-foreground hover:border-foreground/40'
                    }`}
                  >
                    Per lot
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Quantity ({bidForm.quantity_unit === 'kg' ? 'kg' : 'lots'})
                    {bidForm.quantity_unit === 'kg' && product?.minimum_quantity_kg && (
                      <span className="text-muted-foreground font-normal"> — min {product.minimum_quantity_kg} kg</span>
                    )}
                  </label>
                  <input
                    type="number" min="0.01" step="0.01" data-testid="bid-quantity"
                    max={bidForm.quantity_unit === 'kg' ? (product?.remaining_quantity_kg ?? undefined) : undefined}
                    value={bidForm.quantity_unit === 'kg' ? bidForm.quantity_kg : bidForm.quantity_lot}
                    onChange={e => setBidForm(prev => prev.quantity_unit === 'kg'
                      ? { ...prev, quantity_kg: e.target.value }
                      : { ...prev, quantity_lot: e.target.value })}
                    onBlur={() => markTouched('quantity')}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      showFieldError('quantity') ? 'border-red-400 bg-red-50' : 'border-border'
                    }`}
                    placeholder={bidForm.quantity_unit === 'kg' && product?.minimum_quantity_kg ? `Min. ${product.minimum_quantity_kg} kg` : 'e.g. 500'}
                  />
                  <FieldError msg={showFieldError('quantity')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Price per {bidForm.quantity_unit === 'kg' ? 'kg' : 'lot'}
                  </label>
                  <input
                    type="number" min="0.01" step="0.01" data-testid="bid-price"
                    value={bidForm.quantity_unit === 'kg' ? bidForm.price_per_kg : bidForm.price_per_lot}
                    onChange={e => setBidForm(prev => prev.quantity_unit === 'kg'
                      ? { ...prev, price_per_kg: e.target.value }
                      : { ...prev, price_per_lot: e.target.value })}
                    onBlur={() => markTouched('price')}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      showFieldError('price') ? 'border-red-400 bg-red-50' : 'border-border'
                    }`}
                    placeholder="e.g. 2500"
                  />
                  <FieldError msg={showFieldError('price')} />
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
            </div>

            {/* Sticky footer — commitment + submit stay visible while the fields above scroll */}
            <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 space-y-3">
              <div>
                <label className={`flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border transition-colors ${
                  showFieldError('commitment') ? 'border-red-400 bg-red-50' : 'border-border bg-muted/40 hover:bg-muted'
                }`}>
                  <input
                    type="checkbox"
                    data-testid="bid-commitment-checkbox"
                    checked={commitmentChecked}
                    onChange={e => {
                      setCommitmentChecked(e.target.checked);
                      markTouched('commitment');
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-foreground flex-shrink-0"
                  />
                  <span className="text-xs text-foreground leading-relaxed">
                    I confirm this is a genuine offer and I am prepared to fulfil it if accepted by the seller.
                  </span>
                </label>
                <FieldError msg={showFieldError('commitment')} />
              </div>

              {!isBidFormValid && (
                <p className="text-[11px] text-muted-foreground text-center" data-testid="bid-missing-summary">
                  Complete: {[
                    bidFormErrors.quantity && 'quantity',
                    bidFormErrors.price && 'price',
                    bidFormErrors.guest_name && 'your name',
                    bidFormErrors.guest_phone && 'phone',
                    bidFormErrors.guest_email && 'email',
                    bidFormErrors.commitment && 'confirmation checkbox',
                  ].filter(Boolean).join(', ')}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !isBidFormValid}
                data-testid="bid-submit-btn"
                className="w-full inline-flex items-center justify-center gap-2 bg-foreground text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
                {submitting ? 'Sending Request...' : 'Request Price'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
};

export default ProductDetail;
