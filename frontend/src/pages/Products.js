import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Package, TrendingUp, Award } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API}/products`);
        setProducts(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching products:', error);
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div data-testid="products-loading" className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading products...</p>
        </div>
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
            <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6">
              Our Collection
            </p>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tight leading-tight mb-6 text-foreground">
              Premium Cardamom Varieties
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              From the finest plantations of India, we offer a range of cardamom grades 
              to meet diverse market requirements and culinary applications.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-24" data-testid="products-grid">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
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
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-80 object-cover"
                />
                <div className="p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-sans tracking-wide uppercase font-medium rounded-full">
                      {product.grade}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Leaf size={14} />
                      {product.origin}
                    </span>
                  </div>
                  
                  <h3 className="font-serif text-3xl font-semibold mb-4 text-foreground">
                    {product.name}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {product.description}
                  </p>

                  {/* Features */}
                  <div className="mb-6">
                    <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-3 text-foreground">
                      Key Features
                    </h4>
                    <ul className="grid grid-cols-2 gap-2">
                      {product.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary mt-1">•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Specifications */}
                  <div className="border-t border-border pt-6">
                    <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-4 text-foreground">
                      Specifications
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {Object.entries(product.specifications).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="ml-2 font-medium text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
            <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-6 text-foreground">
              Why Choose Our Cardamom?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                icon: Award,
                title: 'Premium Quality',
                description: 'Hand-selected from the finest plantations'
              },
              {
                icon: Package,
                title: 'Export Ready',
                description: 'Meeting international packaging standards'
              },
              {
                icon: TrendingUp,
                title: 'Consistent Supply',
                description: 'Reliable year-round availability'
              },
              {
                icon: Leaf,
                title: 'Sustainable',
                description: 'Environmentally conscious cultivation'
              }
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
                <h3 className="font-serif text-xl font-semibold mb-2 text-foreground">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Products;
