import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';

const LoginModal = ({ open, onOpenChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userData = await login(email, password);
      toast.success(`Welcome back, ${userData.full_name}!`);
      onOpenChange(false);
      setEmail('');
      setPassword('');

      if (userData.role === 'admin') {
        navigate('/admin');
      } else if (userData.status === 'approved') {
        if (userData.role === 'seller') {
          navigate('/seller');
        } else if (userData.role === 'both') {
          navigate('/seller');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/pending-approval');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="login-modal" className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-0">
        <div className="bg-primary px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-bold text-white">
              Welcome Back
            </DialogTitle>
            <DialogDescription className="text-white/80 text-sm">
              Login to your B2B account
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} data-testid="login-modal-form" className="px-6 pb-6 pt-2 space-y-5">
          <div>
            <label htmlFor="modal-email" className="block text-sm font-medium text-foreground mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              id="modal-email"
              data-testid="login-modal-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="modal-password" className="block text-sm font-medium text-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              id="modal-password"
              data-testid="login-modal-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="login-modal-submit-button"
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to="/register"
              data-testid="login-modal-register-link"
              onClick={() => onOpenChange(false)}
              className="text-primary font-semibold hover:underline"
            >
              Register here
            </Link>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
