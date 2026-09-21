import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer data-testid="main-footer" className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24">
        {/* Large Get in Touch */}
        <div className="mb-16">
          <h2 className="font-serif text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight leading-none">
            Get in Touch
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* About */}
          <div>
            <h3 className="font-serif text-2xl font-bold mb-4">Cardamom Spices Centre</h3>
            <p className="text-background/70 font-sans leading-relaxed">
              Premium Green Cardamom - Wholesale & Export Supply
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
            <div className="mt-6">
              <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-3">
                Operating Regions
              </h4>
              <ul className="space-y-1 text-background/70 text-sm">
                <li><MapPin size={14} className="inline mr-2" />Thevaram, Tamil Nadu</li>
                <li><MapPin size={14} className="inline mr-2" />Nedumkandam, Kerala</li>
              </ul>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-sans text-xs tracking-[0.2em] uppercase font-bold mb-4">
              Contact Information
            </h4>
            <ul className="space-y-3 text-background/70">
              <li className="flex items-start gap-2">
                <Phone size={16} className="mt-1 flex-shrink-0" />
                <a href="tel:+918838226519" className="hover:text-background transition-colors">
                  +91-8838226519
                </a>
              </li>
              <li className="flex items-start gap-2">
                <i className="fab fa-whatsapp mt-1 flex-shrink-0"></i>
                <a href="https://wa.me/918838226519" target="_blank" rel="noopener noreferrer" className="hover:text-background transition-colors">
                  WhatsApp: +91-8838226519
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail size={16} className="mt-1 flex-shrink-0" />
                <a href="mailto:cardamomspicescentre@gmail.com" className="hover:text-background transition-colors break-all">
                  cardamomspicescentre@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <i className="fab fa-instagram mt-1 flex-shrink-0"></i>
                <a href="https://www.instagram.com/cardamom_spicescentre?igsh=MTFxMGI3N2ZmenB4ZA==" target="_blank" rel="noopener noreferrer" className="hover:text-background transition-colors">
                  @cardamom_spicescentre
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Letterhead-style legal/contact band — full-bleed dark green, modelled
          on the printed letterhead footer, not the near-black bg above it. */}
      <div className="bg-[#2d5a27] border-t-2 border-[var(--gold)]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-5">
            <img src="/logo/logo-full.png" alt="Spice One Merchants" className="w-[90px] h-[90px] flex-shrink-0" />
            <div className="text-[#f5f0e8] text-sm leading-relaxed">
              <p className="font-semibold">Spice One Merchants · Trading as Cardamom Spices Centre</p>
              <p className="text-[#f5f0e8]/70 text-xs mt-1">
                GSTIN 33ASJPV7316H1ZG · IEC ASJPV7316H · Udyam UDYAM-TN-12-0191653
              </p>
              <p className="mt-2">
                <a href="tel:+918838226519" className="hover:underline">+91-8838226519</a>
                <span className="mx-2 text-[#f5f0e8]/50">·</span>
                <a href="mailto:cardamomspicescentre@gmail.com" className="hover:underline break-all">cardamomspicescentre@gmail.com</a>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-end">
            <p className="font-serif italic text-[#f5f0e8] text-base">
              Purity in every pod, quality in every deal.
            </p>
            <div className="h-px w-24 bg-[var(--gold)] mt-3" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
