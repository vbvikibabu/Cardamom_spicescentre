import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer data-testid="main-footer" className="bg-foreground text-background py-24">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Large Get in Touch */}
        <div className="mb-16">
          <h2 className="font-serif text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight leading-none">
            Get in Touch
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* About */}
          <div>
            <h3 className="font-serif text-2xl font-bold mb-4">Cardamom.</h3>
            <p className="text-background/70 font-sans leading-relaxed">
              Premium quality cardamom export from the finest plantations of India. 
              The Queen of Spices for discerning global markets.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  data-testid="footer-link-home"
                  className="text-background/70 hover:text-background transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/products"
                  data-testid="footer-link-products"
                  className="text-background/70 hover:text-background transition-colors"
                >
                  Products
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  data-testid="footer-link-contact"
                  className="text-background/70 hover:text-background transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-4">
              Contact Information
            </h4>
            <ul className="space-y-3 text-background/70">
              <li className="flex items-start gap-2">
                <MapPin size={16} className="mt-1 flex-shrink-0" />
                <span>Kerala, India</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail size={16} className="mt-1 flex-shrink-0" />
                <span>info@cardamomexport.com</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone size={16} className="mt-1 flex-shrink-0" />
                <span>+91 123 456 7890</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-background/20">
          <p className="text-center text-background/60 text-sm">
            &copy; {new Date().getFullYear()} Cardamom Export India. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
