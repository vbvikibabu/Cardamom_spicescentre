import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Which roles satisfy each requiredRole guard
const ROLE_ACCESS = {
  admin:  ['admin'],
  seller: ['seller', 'both', 'admin'],
  buyer:  ['buyer',  'both', 'admin'],
};

// Where to redirect a logged-in user who fails the role check
function roleHome(role) {
  if (role === 'admin')  return '/admin';
  if (role === 'seller') return '/seller';
  if (role === 'buyer' || role === 'both') return '/dashboard';
  return '/';
}

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Non-admin users who are not yet approved get the holding page
  if (user?.role !== 'admin' && user?.status !== 'approved') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Check role permission
  const allowed = ROLE_ACCESS[requiredRole] ?? [];
  if (!allowed.includes(user?.role)) {
    return <Navigate to={roleHome(user?.role)} replace />;
  }

  return children;
};
