import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LogOut, User, Calendar, Heart } from 'lucide-react';
import Button from '../common/Button';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="w-full px-4 sm:px-8 lg:px-12">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <Calendar className="h-6 w-6 text-indigo-600" />
              </div>
              <span className="font-bold text-xl text-gray-900 hidden sm:block tracking-tight">
                Event<span className="text-indigo-600">Master</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/events" className="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Events
                </Link>
                <Link to="/wishlist" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                  <Heart className="h-5 w-5" />
                </Link>
                
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                
                <div className="flex items-center gap-3 pl-2">
                  <Link to="/dashboard" className="flex items-center gap-2 text-sm text-gray-700 font-medium hover:text-indigo-600 transition-colors">
                    <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center border border-indigo-200">
                      <User className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="hidden sm:block">{user?.name || 'User'}</span>
                  </Link>
                  <button 
                    onClick={handleLogout} 
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors border border-red-100 ml-2" 
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:block">Logout</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Button to="/login" variant="outline" className="text-sm px-4 py-1.5">Log In</Button>
                <Button to="/register" variant="primary" className="text-sm px-4 py-1.5">Sign Up</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
