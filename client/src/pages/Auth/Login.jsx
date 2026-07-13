import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { loginUser } from '../../services/authApi';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

const Login = () => {
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
      
      // Step 3 (2FA): Intercept login if backend requests Two-Factor Authentication
      if (data.data?.requires2FA || data.requires2FA) {
        setPending2FA(data.data?.tempToken || data.tempToken);
        toast('Security verification required', { icon: '🔐' });
        navigate('/2fa-challenge');
      } else {
        login(data.data.user, data.data.accessToken);
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto mt-16 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative">
      <button onClick={() => navigate(-1)} className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-indigo-600 transition-colors font-medium text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="text-center mb-8 mt-4">
        <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Welcome Back</h2>
        <p className="text-gray-500 mt-2 text-sm">Sign in to your EventMaster account</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input 
          label="Email Address" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          required
        />
        <div>
          <Input 
            label="Password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            required
          />
          <div className="flex justify-end mt-1">
            <a href="#" className="text-xs text-indigo-600 font-medium hover:underline">Forgot password?</a>
          </div>
        </div>
        <Button type="submit" variant="primary" className="w-full py-2.5 text-base mt-2" disabled={loading}>
          {loading ? 'Authenticating...' : 'Sign In'}
        </Button>
      </form>
      
      <div className="mt-8 text-center border-t border-gray-100 pt-6">
        <p className="text-gray-600 text-sm">
          Don't have an account? <Link to="/register" className="text-indigo-600 font-bold hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
