import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Button from './components/common/Button';
import SplitText from './components/common/SplitText';
import { useAuthStore } from './store/authStore';
import api from './services/api';

// Auth Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import TwoFactorChallenge from './pages/Auth/TwoFactorChallenge';
import AdminLogin from './pages/Auth/AdminLogin';

// Feature Pages
import EventList from './pages/Events/EventList';
import EventDetails from './pages/Events/EventDetails';
import Checkout from './pages/Events/Checkout';

// Dashboard & Protected Pages
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Dashboard/Settings';
import Wishlist from './pages/Wishlist/Wishlist';
import AdminDashboard from './pages/Dashboard/AdminDashboard';
import AdminEvents from './pages/Dashboard/AdminEvents';
import AdminUsers from './pages/Dashboard/AdminUsers';
import AdminBookings from './pages/Dashboard/AdminBookings';
import AdminRevenue from './pages/Dashboard/AdminRevenue';
import CreateEvent from './pages/Dashboard/CreateEvent';
import EditEvent from './pages/Dashboard/EditEvent';

// Static Pages
import PrivacyPolicy from './pages/Static/PrivacyPolicy';
import TermsOfService from './pages/Static/TermsOfService';

// Setup React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Home Page Component
const Home = () => {
  const { isAuthenticated } = useAuthStore();
  
  return (
    <div className="text-center py-24 flex flex-col items-center justify-center">
      <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full text-sm mb-6 border border-indigo-100">
        🎉 Welcome to v2.0 Enterprise
      </div>
      <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight leading-tight max-w-4xl flex flex-col items-center justify-center">
        <SplitText
          text="Discover and Manage"
          className="text-5xl sm:text-6xl font-extrabold text-gray-900"
          delay={30}
          duration={0.8}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 30 }}
          to={{ opacity: 1, y: 0 }}
          textAlign="center"
        />
        <SplitText
          text="Amazing Events"
          className="text-5xl sm:text-6xl font-extrabold text-indigo-600 mt-2"
          delay={40}
          duration={1}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 30 }}
          to={{ opacity: 1, y: 0 }}
          textAlign="center"
        />
      </h1>
      <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
        The most powerful, secure, and beautiful event platform built for millions of users. Now fully powered by AI.
      </p>
      <div className="flex gap-4 justify-center">
        <Button to="/events" variant="primary" className="px-8 py-3 text-lg shadow-lg">Explore Events</Button>
        {!isAuthenticated && (
          <Button to="/register" variant="outline" className="px-8 py-3 text-lg bg-white/50 backdrop-blur-sm">Host an Event</Button>
        )}
      </div>
    </div>
  );
};

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';
  const [csrfLoaded, setCsrfLoaded] = React.useState(false);

  React.useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const response = await api.get('/api/v1/csrf-token');
        const data = response.data;
        if (data.token) {
          localStorage.setItem('csrf_token', data.token);
        }
      } catch (err) {
        console.error("Failed to fetch CSRF token", err);
      } finally {
        setCsrfLoaded(true);
      }
    };
    fetchCsrf();
  }, []);

  if (!csrfLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Toaster 
          position="top-right" 
          toastOptions={{ 
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: '500'
            },
          }} 
        />
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            
            {/* Authentication Routes - Protected against logged-in users */}
            <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
            <Route path="/2fa-challenge" element={!isAuthenticated ? <TwoFactorChallenge /> : <Navigate to="/" />} />
            
            {/* Feature Routes */}
            <Route path="/admin/login" element={!isAdmin ? <AdminLogin /> : <Navigate to="/admin" />} />
            <Route path="/events" element={<EventList />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/checkout" element={isAuthenticated ? <Checkout /> : <Navigate to="/login" />} />
            
            {/* Static Routes */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            
            {/* User Protected Routes */}
            <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} />
            <Route path="/wishlist" element={isAuthenticated ? <Wishlist /> : <Navigate to="/login" />} />
            
            {/* Admin Routes */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/admin/login" />} />
              <Route path="/admin/events" element={isAdmin ? <AdminEvents /> : <Navigate to="/admin/login" />} />
              <Route path="/admin/users" element={isAdmin ? <AdminUsers /> : <Navigate to="/admin/login" />} />
              <Route path="/admin/bookings" element={isAdmin ? <AdminBookings /> : <Navigate to="/admin/login" />} />
              <Route path="/admin/revenue" element={isAdmin ? <AdminRevenue /> : <Navigate to="/admin/login" />} />
              <Route path="/admin/create-event" element={isAdmin ? <CreateEvent /> : <Navigate to="/admin/login" />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
