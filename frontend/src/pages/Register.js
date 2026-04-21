import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

const phoneRegex = /^(\+\d{7,15}|[6-9]\d{9})$/;

const schema = z.object({
  full_name: z.string().min(3, 'Full name must be at least 3 characters').regex(/^[a-zA-Z\s.'-]+$/, 'Name can only contain letters and spaces'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().regex(phoneRegex, 'Enter a valid mobile number (10 digits starting with 6-9, or international format +XX...)'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirm_password: z.string(),
  company_name: z.string().optional(),
  country: z.string().optional(),
  role: z.enum(['buyer', 'seller', 'both']),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
}).refine(d => {
  if (d.role === 'seller' || d.role === 'both') {
    return d.company_name && d.company_name.trim().length >= 2;
  }
  return true;
}, {
  message: 'Company name is required for sellers',
  path: ['company_name'],
});

const FieldError = ({ msg }) => msg ? (
  <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
    <XCircle size={12} /> {msg}
  </p>
) : null;

const FieldOk = ({ show }) => show ? (
  <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none" />
) : null;

const inputCls = (err, touched) =>
  `w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
    err ? 'border-red-400 focus:ring-red-300 bg-red-50' :
    touched ? 'border-green-400 focus:ring-green-300' :
    'border-border focus:ring-primary'
  }`;

const passwordStrength = (pw) => {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' };
  if (score <= 3) return { label: 'Medium', color: 'bg-amber-500', width: '66%' };
  return { label: 'Strong', color: 'bg-green-500', width: '100%' };
};

const Register = () => {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register: authRegister, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting, touchedFields, dirtyFields } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', phone: '', password: '', confirm_password: '', company_name: '', country: '', role: 'buyer' },
    mode: 'onBlur',
  });

  const role = watch('role');
  const password = watch('password');
  const strength = passwordStrength(password);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data) => {
    try {
      const { confirm_password, ...payload } = data;
      await authRegister(payload);
      toast.success('Registration successful! Awaiting admin approval.');
      navigate('/login');
    } catch (error) {
      const detail = error.response?.data?.detail || '';
      if (detail.toLowerCase().includes('mobile') || detail.toLowerCase().includes('phone')) {
        setError('phone', { message: detail });
      } else if (detail.toLowerCase().includes('email')) {
        setError('email', { message: detail });
      } else {
        toast.error(detail || 'Registration failed. Please try again.');
      }
    }
  };

  if (isAuthenticated) return null;

  return (
    <div data-testid="register-page" className="min-h-screen flex items-center justify-center bg-muted pt-20 px-4 py-12">
      <div className="max-w-2xl w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
        <div className="text-center">
          <h2 className="font-serif text-4xl font-bold text-foreground mb-2">Create B2B Account</h2>
          <p className="text-muted-foreground">Register for wholesale cardamom trading</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} data-testid="register-form" className="space-y-6" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
              <div className="relative">
                <input {...register('full_name')} data-testid="register-fullname-input" type="text"
                  className={inputCls(errors.full_name, touchedFields.full_name)} placeholder="Your full name" />
                <FieldOk show={!errors.full_name && dirtyFields.full_name} />
              </div>
              <FieldError msg={errors.full_name?.message} />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email *</label>
              <div className="relative">
                <input {...register('email')} data-testid="register-email-input" type="email"
                  className={inputCls(errors.email, touchedFields.email)} placeholder="you@company.com" />
                <FieldOk show={!errors.email && dirtyFields.email} />
              </div>
              <FieldError msg={errors.email?.message} />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">WhatsApp Number *</label>
              <div className="relative">
                <input {...register('phone')} data-testid="register-phone-input" type="tel"
                  className={inputCls(errors.phone, touchedFields.phone)} placeholder="9876543210 or +91XXXXXXXXXX" />
                <FieldOk show={!errors.phone && dirtyFields.phone} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Enter your WhatsApp number</p>
              <FieldError msg={errors.phone?.message} />
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Country</label>
              <input {...register('country')} data-testid="register-country-input" type="text"
                className={inputCls(errors.country, touchedFields.country)} placeholder="India" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password *</label>
              <div className="relative">
                <input {...register('password')} data-testid="register-password-input"
                  type={showPw ? 'text' : 'password'}
                  className={`${inputCls(errors.password, touchedFields.password)} pr-10`}
                  placeholder="Min 8 chars, upper+lower+number" />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && strength && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Password strength</span>
                    <span className={`text-xs font-semibold ${strength.label === 'Strong' ? 'text-green-600' : strength.label === 'Medium' ? 'text-amber-600' : 'text-red-600'}`}>{strength.label}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                  </div>
                </div>
              )}
              <FieldError msg={errors.password?.message} />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Confirm Password *</label>
              <div className="relative">
                <input {...register('confirm_password')} type={showConfirm ? 'text' : 'password'}
                  className={`${inputCls(errors.confirm_password, touchedFields.confirm_password)} pr-10`}
                  placeholder="Repeat your password" />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError msg={errors.confirm_password?.message} />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">I want to *</label>
            <div className="grid grid-cols-3 gap-3" data-testid="register-role-selector">
              {[
                { value: 'buyer', label: 'Buy', desc: 'Browse & bid on products' },
                { value: 'seller', label: 'Sell', desc: 'List & sell your products' },
                { value: 'both', label: 'Both', desc: 'Buy and sell products' }
              ].map(opt => (
                <button key={opt.value} type="button" data-testid={`register-role-${opt.value}`}
                  onClick={() => setValue('role', opt.value, { shouldValidate: true })}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    role === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}>
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs mt-1 opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Company Name — shown & required for seller/both */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Company Name {(role === 'seller' || role === 'both') ? '*' : ''}
            </label>
            <div className="relative">
              <input {...register('company_name')} data-testid="register-company-input" type="text"
                className={inputCls(errors.company_name, touchedFields.company_name)} placeholder="Your company or trading name" />
              <FieldOk show={!errors.company_name && dirtyFields.company_name} />
            </div>
            <FieldError msg={errors.company_name?.message} />
          </div>

          <button type="submit" disabled={isSubmitting} data-testid="register-submit-button"
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Registering...</> : 'Register'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" data-testid="register-login-link" className="text-primary font-semibold hover:underline">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
