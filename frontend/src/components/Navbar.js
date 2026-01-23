import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone, Mail, MessageCircle, Instagram } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav
      data-testid="main-navbar"
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled ? 'navbar-glass shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link
            to="/"
            data-testid="nav-logo"
            className="flex flex-col"
          >
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl md:text-3xl font-bold text-foreground tracking-tight">Cardamom Spices Centre</span>
            </div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Spiceboard Registered Cardamom Exporter</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                data-testid={`nav-link-${link.name.toLowerCase()}`}
                className={`font-sans text-sm tracking-wide uppercase font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.name}
              </Link>
            ))}
            
            {/* Contact Icons */}
            <div className="flex items-center gap-2">
              <a
                href="tel:+918838226519"
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all"
                title="Call Us"
              >
                <Phone size={16} />
              </a>
              <a
                href="https://wa.me/918838226519"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-all"
                title="WhatsApp"
              >
                <MessageCircle size={16} />
              </a>
              <a
                href="mailto:cardamomspicescentre@gmail.com"
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all"
                title="Email Us"
              >
                <Mail size={16} />
              </a>
              <a
                href="https://www.instagram.com/cardamom_spicescentre?igsh=MTFxMGI3N2ZmenB4ZA=="
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white flex items-center justify-center hover:opacity-90 transition-all"
                title="Instagram"
              >
                <Instagram size={16} />
              </a>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            data-testid="mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-foreground"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div
          data-testid="mobile-menu"
          className="md:hidden navbar-glass border-t border-border"
        >
          <div className="px-6 py-4 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                data-testid={`mobile-nav-link-${link.name.toLowerCase()}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block font-sans text-sm tracking-wide uppercase font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {link.name}
              </Link>
            ))}
            
            {/* Mobile Contact Buttons */}
            <div className="pt-4 space-y-2">
              <a
                href="tel:+918838226519"
                className="flex items-center gap-3 px-4 py-3 bg-primary text-white rounded-lg"
              >
                <Phone size={18} />
                <span>+91-8838226519</span>
              </a>
              <a
                href="https://wa.me/918838226519"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-green-500 text-white rounded-lg"
              >
                <MessageCircle size={18} />
                <span>WhatsApp</span>
              </a>
              <a
                href="mailto:cardamomspicescentre@gmail.com"
                className="flex items-center gap-3 px-4 py-3 bg-primary text-white rounded-lg"
              >
                <Mail size={18} />
                <span>Email Us</span>
              </a>
              <a
                href="https://www.instagram.com/cardamom_spicescentre?igsh=MTFxMGI3N2ZmenB4ZA=="
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white rounded-lg"
              >
                <Instagram size={18} />
                <span>Instagram</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
