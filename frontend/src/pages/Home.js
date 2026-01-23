import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Leaf, Shield, Globe } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API}/products`);
        setProducts(response.data.slice(0, 3));
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const features = [
    {
      icon: Leaf,
      title: 'Premium Quality',
      description: 'Hand-picked from the finest plantations of South India'
    },
    {
      icon: Shield,
      title: 'Export Standards',
      description: 'Meeting international quality and safety certifications'
    },
    {
      icon: Globe,
      title: 'Global Reach',
      description: 'Delivering excellence to markets worldwide'
    }
  ];

  return (
    <div data-testid="home-page" className="pt-20">
      {/* Hero Section - Immersive Split */}
      <section className="min-h-screen flex items-center" data-testid="hero-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Typography */}
            <motion.div {...fadeInUp}>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6"
              >
                Premium Export Quality
              </motion.p>
              <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl tracking-tight leading-[0.9] mb-8 text-foreground">
                The Queen of Spices
              </h1>
              <p className="text-base md:text-lg font-sans leading-relaxed text-muted-foreground mb-12 max-w-lg">
                Discover the finest Green Cardamom (Elettaria cardamomum) from Thevaram (Tamil Nadu) and Nedumkandam (Kerala), India. 
                We bring you premium quality in three different size grades, 
                cultivated with care and exported with pride.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/products"
                  data-testid="hero-cta-products"
                  className="btn-primary inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-primary/90 transition-colors"
                >
                  View Products
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/contact"
                  data-testid="hero-cta-contact"
                  className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-secondary/80 transition-colors"
                >
                  Get Quote
                </Link>
              </div>
            </motion.div>

            {/* Right: Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative h-[500px] lg:h-[600px]"
            >
              <img
                src="https://images.pexels.com/photos/6086300/pexels-photo-6086300.jpeg"
                alt="Fresh cardamom pods"
                className="hero-image w-full h-full object-cover rounded-lg shadow-sm"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24" data-testid="features-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                data-testid={`feature-${index}`}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
                  <feature.icon size={28} />
                </div>
                <h3 className="font-serif text-2xl font-semibold mb-4 text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section - Editorial Layout */}
      <section className="py-32 bg-muted" data-testid="about-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <img
                src="https://images.pexels.com/photos/16166178/pexels-photo-16166178.jpeg"
                alt="Cardamom plantation"
                className="w-full h-[500px] object-cover rounded-lg shadow-sm"
              />
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6">
                Our Story
              </p>
              <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-8 text-foreground">
                Cultivated with Tradition, Exported with Pride
              </h2>
              <div className="space-y-6 text-muted-foreground leading-relaxed">
                <p>
                  Nestled in the finest plantations of India, our Green Cardamom 
                  benefits from ideal climatic conditions that produce the world's 
                  finest spice.
                </p>
                <p>
                  We specialize in three premium size grades of Green Cardamom (Elettaria cardamomum): 
                  6-7mm for retail & wholesale, 7-8mm for premium export markets, and 8mm+ super bold 
                  pods for discerning buyers seeking the finest quality.
                </p>
                <p>
                  Our commitment to quality standards at every stage—from harvesting to packaging—ensures 
                  that only premium grade cardamom reaches international markets.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Products Preview - Bento Grid */}
      <section className="py-32" data-testid="products-preview-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex justify-between items-end mb-12">
            <div>
              <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-4">
                Our Range
              </p>
              <h2 className="font-serif text-4xl md:text-6xl tracking-tight text-foreground">
                Premium Products
              </h2>
            </div>
            <Link
              to="/products"
              data-testid="view-all-products-link"
              className="hidden md:inline-flex items-center gap-2 text-primary font-sans text-sm tracking-wide uppercase font-medium hover:gap-3 transition-all"
            >
              View All
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Tetris Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {products.map((product, index) => {
              const colSpans = ['md:col-span-8', 'md:col-span-4', 'md:col-span-12'];
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  data-testid={`product-preview-${index}`}
                  className={`product-card bg-white rounded-lg overflow-hidden border border-primary/10 ${colSpans[index]}`}
                >
                  <div className={index === 2 ? 'grid md:grid-cols-2' : ''}>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-80 object-cover"
                    />
                    <div className="p-8">
                      <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-sans tracking-wide uppercase font-medium rounded-full mb-4">
                        {product.grade}
                      </span>
                      <h3 className="font-serif text-2xl md:text-3xl font-semibold mb-3 text-foreground">
                        {product.name}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {product.description}
                      </p>
                      <Link
                        to="/products"
                        data-testid={`product-preview-link-${index}`}
                        className="inline-flex items-center gap-2 text-primary font-sans text-sm tracking-wide uppercase font-medium hover:gap-3 transition-all"
                      >
                        Learn More
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="md:hidden mt-8 text-center">
            <Link
              to="/products"
              data-testid="view-all-products-link-mobile"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium"
            >
              View All Products
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-primary text-primary-foreground" data-testid="cta-section">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-6">
              Ready to Import Premium Cardamom?
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-12 leading-relaxed">
              Contact us today for bulk orders, custom quotes, and export inquiries.
            </p>
            <Link
              to="/contact"
              data-testid="cta-contact-button"
              className="inline-flex items-center gap-2 bg-white text-primary px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-white/90 transition-colors"
            >
              Get in Touch
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
