import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Clock } from 'lucide-react';

const PendingApproval = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted pt-20 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
            <Clock className="text-yellow-600" size={40} />
          </div>
        </div>

        <div>
          <h2 className="font-serif text-3xl font-bold text-foreground mb-2">
            Account Pending Approval
          </h2>
          <p className="text-muted-foreground mb-4">
            Thank you for registering, {user?.full_name}!
          </p>
          <p className="text-sm text-muted-foreground">
            Your account is currently under review by our admin team. 
            You'll receive access to view products and request quotes once approved.
          </p>
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">
            This usually takes 24-48 hours. We'll notify you via email once your account is approved.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Need urgent access? Contact us:</p>
          <p className="font-semibold text-foreground mt-1">+91-8838226519</p>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;