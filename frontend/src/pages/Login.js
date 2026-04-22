import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, XCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const FieldError = ({ msg }) => msg ? (
  <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={12} /> {msg}</p>
) : null;

const inputCls = (err) =>
  `w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm transition-colors ${
    err ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-border focus:ring-primary'
  }`;

const Login = () => {
  const [open, setOpen] = useState(true);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Save the path the user was trying to reach before being redirected to login
  useEffect(() => {
    const ref = document.referrer;
    const current = window.location.pathname;
    if (current === '/login' && ref) {
      try {
        const refUrl = new URL(ref);
        if (refUrl.origin === window.location.origin && refUrl.pathname !== '/login') {
          sessionStorage.setItem('redirectAfterLogin', refUrl.pathname + refUrl.search);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.status === 'approved') {
        if (user.role === 'seller' || user.role === 'both') navigate('/seller', { replace: true });
        else navigate('/dashboard', { replace: true });
      } else navigate('/pending-approval', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const onSubmit = async ({ email, password }) => {
    try {
      const userData = await login(email, password);
      toast.success(`Welcome back, ${userData.full_name}!`);

      // Check for saved redirect path
      const savedPath = sessionStorage.getItem('redirectAfterLogin');
      if (savedPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(savedPath);
        return;
      }

      if (userData.role === 'admin') navigate('/admin');
      else if (userData.status === 'approved') {
        if (userData.role === 'seller' || userData.role === 'both') navigate('/seller');
        else navigate('/dashboard');
      } else navigate('/pending-approval');
    } catch (error) {
      const detail = error.response?.data?.detail || 'Login failed';
      if (detail.toLowerCase().includes('password') || detail.toLowerCase().includes('invalid')) {
        setError('password', { message: detail });
      } else if (detail.toLowerCase().includes('email')) {
        setError('email', { message: detail });
      } else {
        toast.error(detail);
      }
    }
  };

  const handleClose = (isOpen) => {
    setOpen(isOpen);
    if (!isOpen) navigate(-1);
  };

  if (isAuthenticated) return null;

  return (
    <div data-testid="login-page" className="min-h-screen pt-20">
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent data-testid="login-modal" className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-0">
          <div className="bg-primary px-6 py-5">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">Welcome Back</DialogTitle>
              <DialogDescription className="text-white/80 text-sm">Login to your B2B account</DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} data-testid="login-modal-form" className="px-6 pb-6 pt-4 space-y-5" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
              <input {...register('email')} id="login-email" data-testid="login-modal-email-input"
                type="email" placeholder="your@email.com" className={inputCls(errors.email)} />
              <FieldError msg={errors.email?.message} />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input {...register('password')} id="login-password" data-testid="login-modal-password-input"
                type="password" placeholder="Enter your password" className={inputCls(errors.password)} />
              <FieldError msg={errors.password?.message} />
            </div>

            <button type="submit" disabled={isSubmitting} data-testid="login-modal-submit-button"
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Logging in...</> : 'Login'}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" data-testid="login-modal-register-link" className="text-primary font-semibold hover:underline">Register here</Link>
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
