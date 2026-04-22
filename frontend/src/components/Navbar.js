import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Phone, Mail, MessageCircle, Instagram, LogIn, LogOut, LayoutDashboard, User } from 'lucide-react';

const DARK_GREEN = '#2d5a27';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isSeller, isAdmin } = useAuth();

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

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const openLogin = () => {
    setIsMobileMenuOpen(false);
    setShowLoginModal(true);
  };

  return (
    <>
      <nav
        data-testid="main-navbar"
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled ? 'navbar-glass shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" data-testid="nav-logo" className="flex flex-col">
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
              
              {/* Desktop: Phone · WhatsApp · Auth only */}
              <div className="flex items-center gap-2">
                <a
                  href="tel:+918838226519"
                  style={{ backgroundColor: DARK_GREEN }}
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center hover:opacity-85 transition-all"
                  title="Call Us"
                >
                  <Phone size={16} />
                </a>
                <a
                  href="https://wa.me/918838226519"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundColor: DARK_GREEN }}
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center hover:opacity-85 transition-all"
                  title="WhatsApp"
                >
                  <MessageCircle size={16} />
                </a>

                {/* Auth Buttons */}
                {isAuthenticated ? (
                  <>
                    <Link
                      to={isAdmin ? '/admin' : isSeller ? '/seller' : '/dashboard'}
                      data-testid="nav-dashboard-button"
                      style={{ backgroundColor: DARK_GREEN }}
                      className="w-10 h-10 rounded-full text-white flex items-center justify-center hover:opacity-85 transition-all"
                      title="Dashboard"
                    >
                      <LayoutDashboard size={16} />
                    </Link>
                    <button
                      onClick={handleLogout}
                      data-testid="nav-logout-button"
                      style={{ backgroundColor: DARK_GREEN }}
                      className="w-10 h-10 rounded-full text-white flex items-center justify-center hover:opacity-85 transition-all"
                      title="Logout"
                    >
                      <LogOut size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={openLogin}
                    data-testid="nav-login-button"
                    style={{ backgroundColor: DARK_GREEN }}
                    className="w-10 h-10 rounded-full text-white flex items-center justify-center hover:opacity-85 transition-all"
                    title="Login"
                  >
                    <LogIn size={16} />
                  </button>
                )}
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
          <div data-testid="mobile-menu" className="md:hidden navbar-glass border-t border-border">
            <div className="px-6 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  data-testid={`mobile-nav-link-${link.name.toLowerCase()}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block py-2.5 font-sans text-sm tracking-wide font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Mobile Auth Links */}
              <div className="pt-3 border-t border-border">
                {isAuthenticated ? (
                  <>
                    <Link
                      to={isAdmin ? '/admin' : isSeller ? '/seller' : '/dashboard'}
                      data-testid="mobile-dashboard-button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2 py-2.5 text-sm font-medium text-primary"
                    >
                      <LayoutDashboard size={16} />
                      <span>Dashboard</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      data-testid="mobile-logout-button"
                      className="flex items-center gap-2 py-2.5 text-sm font-medium text-red-500 w-full text-left"
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={openLogin}
                      data-testid="mobile-login-button"
                      className="flex items-center gap-2 py-2.5 text-sm font-medium text-primary w-full text-left"
                    >
                      <LogIn size={16} />
                      <span>Login</span>
                    </button>
                    <Link
                      to="/register"
                      data-testid="mobile-register-button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2 py-2.5 text-sm font-medium text-muted-foreground"
                    >
                      <User size={16} />
                      <span>Register</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Contact Links */}
              <div className="pt-3 border-t border-border flex items-center gap-4">
                <a href="tel:+918838226519" title="Call Us" className="text-primary hover:text-primary/80 transition-colors">
                  <Phone size={18} />
                </a>
                <a href="https://wa.me/918838226519" target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-primary hover:text-primary/80 transition-colors">
                  <MessageCircle size={18} />
                </a>
                <a href="mailto:cardamomspicescentre@gmail.com" title="Email Us" className="text-primary hover:text-primary/80 transition-colors">
                  <Mail size={18} />
                </a>
                <a href="https://www.instagram.com/cardamom_spicescentre?igsh=MTFxMGI3N2ZmenB4ZA==" target="_blank" rel="noopener noreferrer" title="Instagram" className="text-primary hover:text-primary/80 transition-colors">
                  <Instagram size={18} />
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Login Modal */}
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </>
  );
};

export default Navbar;
