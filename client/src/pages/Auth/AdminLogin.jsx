import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { loginUser } from '../../services/authApi';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, setPending2FA } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      
      // Check if user is actually an admin
      if (data.data?.user?.role !== 'ADMIN') {
        toast.error('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }

      if (data.data?.requires2FA || data.requires2FA) {
        setPending2FA(data.data?.tempToken || data.tempToken);
        toast('Security verification required', { icon: '🛡️' });
        navigate('/2fa-challenge', { state: { redirect: '/admin' } });
      } else {
        login(data.data.user, data.data.accessToken);
        toast.success('Admin authenticated successfully');
        navigate('/admin');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Portal</h2>
          <p className="mt-2 text-sm text-gray-500">
            Secure login for platform administrators
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Admin Email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
