import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, MapPin, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import Button from '../../components/common/Button';
import { wishlistApi } from '../../services/wishlistApi';
import { useQueryClient } from '@tanstack/react-query';

const Wishlist = () => {
  const [savedEvents, setSavedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const response = await wishlistApi.getWishlist();
      setSavedEvents(response.data?.events || []);
    } catch (err) {
      setError('Failed to load wishlist.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (eventId) => {
    try {
      await wishlistApi.removeFromWishlist(eventId);
      setSavedEvents(savedEvents.filter(event => event.id !== eventId));
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full h-full flex-grow flex flex-col py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-6 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3 mb-8">
        <Heart className="h-8 w-8 text-red-500 fill-current" />
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Wishlist</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-500 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">{error}</div>
      ) : savedEvents.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Heart className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your wishlist is empty</h2>
          <p className="text-gray-500">Discover events and tap the heart icon to save them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {savedEvents.map((event) => (
              <div 
                key={event.id} 
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col h-full relative cursor-pointer"
                onClick={() => navigate(`/events/${event.id}`)}
              >
                
                {/* Active Wishlist Icon */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(event.id);
                  }}
                  className="absolute top-3 right-3 z-10 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-sm text-red-500 hover:scale-110 transition-transform"
                >
                  <Trash2 className="h-5 w-5 text-red-500" />
                </button>
                
                <div className="h-48 overflow-hidden relative bg-gray-200 flex items-center justify-center">
                  {event.banner_image ? (
                    <img src={event.banner_image.startsWith('http') ? event.banner_image : `${API_URL}${event.banner_image}`} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <span className="text-gray-400 font-medium">No Image</span>
                  )}
                </div>
              
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-4 truncate pr-2">{event.title}</h3>
                
                <div className="flex flex-col gap-2 text-sm text-gray-600 mb-6 flex-grow">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <span className="truncate">{event.event_date ? new Date(event.event_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    <span className="truncate">{event.venue || 'TBA'}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                  <div className="font-extrabold text-xl text-gray-900">
                    ${event.ticket_price || 0}
                  </div>
                  <Button className="px-6 py-2" onClick={() => navigate('/checkout', { state: { event } })}>Book Now</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
