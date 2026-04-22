import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Gavel, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BottomNav = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) return null;

  const isActive = (path) => location.pathname === path;

  // Admin tabs
  if (isAdmin) {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16">
          <NavTab to="/admin" icon={<ShieldCheck size={22} />} label="Admin" active={isActive('/admin')} />
          <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
          <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
        </div>
      </nav>
    );
  }

  // Seller-only tabs
  if (user.role === 'seller') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16">
          <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
          <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
          <NavTab to="/seller" icon={<LayoutDashboard size={22} />} label="Dashboard" active={isActive('/seller')} />
        </div>
      </nav>
    );
  }

  // Buyer-only tabs
  if (user.role === 'buyer') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16">
          <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
          <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
          <NavTab to="/dashboard" icon={<Gavel size={22} />} label="My Bids" active={isActive('/dashboard')} />
        </div>
      </nav>
    );
  }

  // Both roles tabs
  if (user.role === 'both') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16">
          <NavTab to="/" icon={<Home size={22} />} label="Home" active={isActive('/')} />
          <NavTab to="/products" icon={<Package size={22} />} label="Products" active={isActive('/products')} />
          <NavTab to="/dashboard" icon={<Gavel size={22} />} label="My Bids" active={isActive('/dashboard')} />
          <NavTab to="/seller" icon={<LayoutDashboard size={22} />} label="Selling" active={isActive('/seller')} />
        </div>
      </nav>
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
