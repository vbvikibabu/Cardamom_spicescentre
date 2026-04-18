import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  if (requiredRole === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'seller' && !['seller', 'both'].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'buyer' && !['buyer', 'both'].includes(user?.role)) {
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'seller') return <Navigate to="/seller" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};
