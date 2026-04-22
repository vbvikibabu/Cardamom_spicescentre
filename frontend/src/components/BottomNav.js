import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Gavel, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Hammer icon for auctions (inline SVG — lucide doesn't have one)
const HammerIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
    <path d="m18 15 4-4" />
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
  </svg>
);

const BottomNav = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavBar = ({ children }) => (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex h-16">{children}</div>
    </nav>
  );

  // Not logged in — show Auctions too
  if (!isAuthenticated || !user) {
    return (
      <NavBar>
        <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
        <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
        <NavTab to="/auctions" icon={<HammerIcon size={22} />} label="Auctions" active={isActive('/auctions')} />
      </NavBar>
    );
  }

  // Admin
  if (isAdmin) {
    return (
      <NavBar>
        <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
        <NavTab to="/auctions" icon={<HammerIcon size={22} />} label="Auctions" active={isActive('/auctions')} />
        <NavTab to="/admin" icon={<ShieldCheck size={22} />} label="Admin" active={isActive('/admin')} />
      </NavBar>
    );
  }

  // Seller-only
  if (user.role === 'seller') {
    return (
      <NavBar>
        <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
        <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
        <NavTab to="/auctions" icon={<HammerIcon size={22} />} label="Auctions" active={isActive('/auctions')} />
        <NavTab to="/seller" icon={<LayoutDashboard size={22} />} label="My Lots" active={isActive('/seller')} />
      </NavBar>
    );
  }

  // Buyer-only
  if (user.role === 'buyer') {
    return (
      <NavBar>
        <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
        <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
        <NavTab to="/auctions" icon={<HammerIcon size={22} />} label="Auctions" active={isActive('/auctions')} />
        <NavTab to="/dashboard" icon={<Gavel size={22} />} label="My Bids" active={isActive('/dashboard')} />
      </NavBar>
    );
  }

  // Both roles
  if (user.role === 'both') {
    return (
      <NavBar>
        <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
        <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
        <NavTab to="/auctions" icon={<HammerIcon size={22} />} label="Auctions" active={isActive('/auctions')} />
        <NavTab to="/dashboard" icon={<LayoutDashboard size={22} />} label="Dashboard" active={isActive('/dashboard')} />
      </NavBar>
    );
  }

  return null;
};

const NavTab = ({ to, icon, label, active }) => (
  <Link
    to={to}
    className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    <span className={active ? 'text-primary' : ''}>{icon}</span>
    <span className={`text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-primary' : ''}`}>
      {label}
    </span>
    {active && <span className="absolute bottom-0 w-10 h-0.5 bg-primary rounded-t-full" />}
  </Link>
);

export default BottomNav;
