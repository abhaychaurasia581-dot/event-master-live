import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { verify2FALogin } from '../../services/authApi';
import Button from '../../components/common/Button';
import BackButton from '../../components/common/BackButton';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';

const TwoFactorChallenge = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const { is2FAPending, pendingToken, login, logout } = useAuthStore();
  const navigate = useNavigate();

  // Route protection: If user navigates here without a pending token, kick them to login
  useEffect(() => {
    if (!is2FAPending || !pendingToken) {
      navigate('/login');
    }
  }, [is2FAPending, pendingToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (token.length < 6) return toast.error('Invalid token length');
    
    setLoading(true);
    try {
      const data = await verify2FALogin(token, pendingToken);
      // Finalize login on success
      login(data.user, data.token);
      toast.success('Verification successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto mt-20 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative">
      <BackButton className="absolute top-6 left-6" />
      <div className="text-center mb-8">
        <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h2>
        <p className="text-gray-500 mt-2 text-sm px-4">
          Your account is protected. Please enter the 6-digit code from your authenticator app.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center px-4">
          <Input 
            className="text-center text-3xl tracking-widest font-mono py-4 text-indigo-900 bg-gray-50"
            type="text" 
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\s/g, ''))}
            placeholder="000000"
            maxLength={8} // 6 for OTP, 8 for Backup codes
            disabled={loading}
            autoFocus
            required
          />
        </div>
        
        <div className="flex flex-col gap-3">
          <Button type="submit" variant="primary" className="w-full py-3" disabled={loading || token.length < 6}>
            {loading ? 'Verifying...' : 'Verify Secure Login'}
          </Button>
          <Button type="button" variant="outline" className="w-full border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300" onClick={handleCancel} disabled={loading}>
            Cancel Login
          </Button>
        </div>
      </form>
      
      <p className="mt-8 text-center text-xs text-gray-400">
        Lost access to your app? Enter one of your 8-digit emergency recovery codes instead.
      </p>
    </div>
  );
};

export default TwoFactorChallenge;
