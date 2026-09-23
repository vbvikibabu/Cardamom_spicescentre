import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowLeft, ChevronLeft, ChevronRight, Film, Check, BadgeCheck } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { track } from '@vercel/analytics';
import { useAuth } from '../context/AuthContext';
import { useDocumentHead } from '@/hooks/useDocumentHead';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// No seller-level phone/WhatsApp field exists on ProductPublic — every enquiry
// routes through the one business number until per-seller contact is built.
const BUSINESS_WHATSAPP_NUMBER = '918838226519';

const buildWhatsAppEnquiryUrl = (product) => {
  const message = [
    `Hi, I'm interested in ${product.name} — ${product.size}.`,
    `Page: ${window.location.href}`,
    `Quantity needed:`,
    `Delivery location:`,
  ].join('\n');
  return `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
};

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API}/files/${path}`;
};

const isVideoPath = (path) => {
  const lower = (path || '').toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov');
};

// Product names commonly end in a grade like "6-7mm" or "8mm & above" — the
// dash/spaces inside that token are valid browser line-break points, which is
// what causes a wrap like "Green Cardamom 6–" / "7mm". Keep just that trailing
// token unbreakable instead of the whole title.
const GRADE_SUFFIX_RE = /(\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?\s*mm|\d+(?:\.\d+)?\s*mm(?:\s*(?:&|and)\s*above)?)\s*$/i;

const renderTitle = (name) => {
  const match = (name || '').match(GRADE_SUFFIX_RE);
  if (!match) return name;
  const before = name.slice(0, match.index);
  return <>{before}<span style={{ whiteSpace: 'nowrap' }}>{match[0]}</span></>;
};

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMedia, setCurrentMedia] = useState(0);
  const { user, isAuthenticated } = useAuth();

  useDocumentHead({
    title: product ? `${product.size} Green Cardamom — Bulk & Wholesale | Cardamom Spices Centre` : undefined,
    description: product ? `Bulk ${product.size} green cardamom — wholesale supply. Request a price for your required quantity and delivery location.` : undefined,
    path: `/products/${id}`,
  });

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-32 gap-4">
        <p className="text-muted-foreground text-lg">Product not found</p>
        <Link to="/products" className="text-primary font-semibold hover:underline">Back to Products</Link>
      </div>
    );
  }

  const mediaPaths = product.media_paths?.length > 0 ? product.media_paths : (product.image_url ? [product.image_url] : []);

  // No offers/price — prices are never published, per CLAUDE.md.
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    category: product.size,
    image: mediaPaths.filter((p) => !isVideoPath(p)).map(getMediaUrl),
    brand: { '@type': 'Brand', name: 'Cardamom Spices Centre' },
  };

  return (
    <div data-testid="product-detail-page" className="min-h-screen pt-32 bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
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

            <h1 data-testid="product-detail-name" className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-6 leading-tight">{renderTitle(product.name)}</h1>

            {/* Seller info box — the firm, not the listing seller; the actual seller stays admin-only */}
            <div data-testid="product-seller-box" className="flex items-start gap-3 p-4 border border-border rounded-xl mb-5 bg-muted/40">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BadgeCheck size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Sold by</p>
                <p className="text-sm font-bold text-foreground" data-testid="product-seller-name">Spice One Merchants</p>
                <p className="text-[10px] text-green-600 font-semibold mt-1 flex items-center gap-1">
                  <Check size={11} /> GST Registered
                </p>
              </div>
            </div>

            {/* Sold info — no buyer name or price exposed */}
            {product.listing_status === 'sold' && (
              <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">This product has been sold</p>
                  <p className="text-xs text-blue-600">Seller: Spice One Merchants</p>
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

            {/* CTA Buttons — 'expired' is a leftover auction-timer status; listings no longer close on a timer */}
            <div className="mt-auto space-y-3">
              {(product.listing_status === 'active' || product.listing_status === 'expired') ? (
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
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          to={`/contact?grade=${encodeURIComponent(product.size || '')}`}
                          data-testid="product-detail-place-bid"
                          className="flex-1 inline-flex items-center justify-center gap-3 bg-foreground text-white py-4 rounded-xl font-semibold text-base hover:bg-foreground/90 transition-colors"
                        >
                          Request a Price
                        </Link>
                        <a
                          href={buildWhatsAppEnquiryUrl(product)}
                          onClick={() => track('whatsapp_enquiry', { product: product.name, grade: product.size })}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="product-detail-whatsapp-enquiry"
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] text-white py-4 rounded-xl font-semibold text-base hover:bg-[#1ebe57] transition-colors"
                        >
                          <i className="fab fa-whatsapp text-lg" aria-hidden="true"></i>
                          Enquire on WhatsApp
                        </a>
                      </div>
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
    </div>
  );
};

export default ProductDetail;
