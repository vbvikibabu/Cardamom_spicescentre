import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer data-testid="main-footer" className="bg-[#2d5a27] text-[#f5f0e8] border-t-2 border-[var(--gold)]">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div>
            <img src="/logo/logo-full.png" alt="Spice One Merchants" className="w-[90px] h-[90px] mb-4" />
            <h3 className="font-serif text-2xl font-bold mb-2">Spice One Merchants</h3>
            <p className="text-[#f5f0e8]/70 font-sans leading-relaxed mb-3">
              Premium Green Cardamom - Wholesale & Export Supply
            </p>
            <p className="font-serif italic text-[#f5f0e8]/90 text-sm">
              Purity in every pod, quality in every deal.
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
                  className="text-[#f5f0e8]/70 hover:text-[#f5f0e8] transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/products"
                  data-testid="footer-link-products"
                  className="text-[#f5f0e8]/70 hover:text-[#f5f0e8] transition-colors"
                >
                  Products
                </Link>
              </li>
              <li>
                <Link
                  to="/gallery"
                  data-testid="footer-link-gallery"
                  className="text-[#f5f0e8]/70 hover:text-[#f5f0e8] transition-colors"
                >
                  Gallery
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  data-testid="footer-link-contact"
                  className="text-[#f5f0e8]/70 hover:text-[#f5f0e8] transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
            <div className="mt-6">
              <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-3">
                Operating Regions
              </h4>
              <ul className="space-y-1 text-[#f5f0e8]/70 text-sm">
                <li><MapPin size={14} className="inline mr-2" />Thevaram, Tamil Nadu</li>
                <li><MapPin size={14} className="inline mr-2" />Idukki, Kerala</li>
              </ul>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-4">
              Contact Information
            </h4>
            <ul className="space-y-3 text-[#f5f0e8]/70">
              <li className="flex items-start gap-2">
                <Phone size={16} className="mt-1 flex-shrink-0" />
                <a href="tel:+918838226519" className="hover:text-[#f5f0e8] transition-colors">
                  +91-8838226519
                </a>
              </li>
              <li className="flex items-start gap-2">
                <i className="fab fa-whatsapp mt-1 flex-shrink-0"></i>
                <a href="https://wa.me/918838226519" target="_blank" rel="noopener noreferrer" className="hover:text-[#f5f0e8] transition-colors">
                  WhatsApp: +91-8838226519
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail size={16} className="mt-1 flex-shrink-0" />
                <a href="mailto:cardamomspicescentre@gmail.com" className="hover:text-[#f5f0e8] transition-colors break-all">
                  cardamomspicescentre@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <i className="fab fa-instagram mt-1 flex-shrink-0"></i>
                <a href="https://www.instagram.com/cardamom_spicescentre?igsh=MTFxMGI3N2ZmenB4ZA==" target="_blank" rel="noopener noreferrer" className="hover:text-[#f5f0e8] transition-colors">
                  @cardamom_spicescentre
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Legal identity strip — thin gold rule, then GSTIN/IEC/Udyam in small muted text.
          Bottom padding on mobile clears the fixed BottomNav (h-16 + safe-area-inset-bottom). */}
      <div className="border-t border-[var(--gold)]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:py-4">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[#f5f0e8]/50 text-xs">
            <span className="whitespace-nowrap">GSTIN 33ASJPV7316H1ZG</span>
            <span aria-hidden="true">&middot;</span>
            <span className="whitespace-nowrap">IEC ASJPV7316H</span>
            <span aria-hidden="true">&middot;</span>
            <span className="whitespace-nowrap">Udyam UDYAM-TN-12-0191653</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
