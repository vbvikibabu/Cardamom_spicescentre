import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Package, TrendingUp, Award, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

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
                  <div className="p-8">
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
                    <span className="text-primary text-sm font-semibold hover:underline">View Details & Place Bid</span>
                  </div>
                </Link>
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
    </div>
  );
};

export default Products;
