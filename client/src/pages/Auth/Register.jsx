import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { registerUser, loginUser } from '../../services/authApi';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error('Please fill in all fields');
    
    setLoading(true);
    try {
      await registerUser(name, email, password);
      // Automatically log in the user after successful registration
      const loginData = await loginUser(email, password);
      
      if (loginData.data?.requires2FA || loginData.requires2FA) {
        navigate('/login');
      } else {
        login(loginData.data.user, loginData.data.accessToken);
        toast.success('Account created successfully! 🎉');
        navigate('/');
      }
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.errors && errorData.errors.length > 0) {
        toast.error(errorData.errors[0].message);
      } else {
        toast.error(errorData?.message || 'Registration failed. Please try again.');
      }
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
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Create an Account</h2>
        <p className="text-gray-500 mt-2 text-sm">Join EventMaster to discover and book premium events</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input 
          label="Full Name" 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          disabled={loading}
          required
        />
        <Input 
          label="Email Address" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          required
        />
        <Input 
          label="Password" 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          required
          minLength={6}
        />
        <Button type="submit" variant="primary" className="w-full py-2.5 text-base mt-2" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>
      
      <div className="mt-8 text-center border-t border-gray-100 pt-6">
        <p className="text-gray-600 text-sm">
          Already have an account? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Log in here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
