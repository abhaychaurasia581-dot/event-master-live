import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { getEvents } from '../../services/eventApi';
import { Calendar, MapPin, Heart, Sparkles } from 'lucide-react';
import Button from '../../components/common/Button';
import BackButton from '../../components/common/BackButton';
import { wishlistApi } from '../../services/wishlistApi';
import { aiApi } from '../../services/aiApi';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const EventCard = ({ event, isInitiallyWishlisted }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isWishlisted, setIsWishlisted] = React.useState(isInitiallyWishlisted);

  React.useEffect(() => {
    setIsWishlisted(isInitiallyWishlisted);
  }, [isInitiallyWishlisted]);

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    try {
      if (isWishlisted) {
        await wishlistApi.removeFromWishlist(event.id);
        setIsWishlisted(false);
        queryClient.invalidateQueries({ queryKey: ['wishlist'] });
        toast.success('Removed from wishlist');
      } else {
        await wishlistApi.addToWishlist(event.id);
        setIsWishlisted(true);
        queryClient.invalidateQueries({ queryKey: ['wishlist'] });
        toast.success('Added to wishlist! ❤️');
      }
    } catch (err) {
      toast.error('Please login to modify wishlist.');
    }
  };

  return (
    <div 
      onClick={() => navigate(`/events/${event.id}`)}
      className="bg-white cursor-pointer rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col h-full relative"
    >
      <button 
        onClick={handleWishlistToggle}
        className={`absolute top-3 right-3 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm transition-colors ${
          isWishlisted ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
        }`}
      >
        <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`} />
      </button>
      
      <div className="h-48 overflow-hidden relative bg-gray-200 flex items-center justify-center">
        {event.banner_image ? (
          <img src={event.banner_image.startsWith('http') ? event.banner_image : `${API_URL}${event.banner_image}`} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <span className="text-gray-400 font-medium">No Image</span>
        )}
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-gray-900 truncate pr-2 hover:text-indigo-600 transition-colors">{event.title}</h3>
        </div>
        
        <div className="flex flex-col gap-2 text-sm text-gray-600 mb-6 flex-grow">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500 flex-shrink-0" />
            <span className="truncate">{event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-indigo-500 flex-shrink-0" />
            <span className="truncate">{event.venue || 'TBD'} {event.city ? `, ${event.city}` : ''}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
          <div className="font-extrabold text-xl text-gray-900">
            {Number(event.ticket_price) === 0 ? 'Free' : `$${Number(event.ticket_price).toFixed(2)}`}
          </div>
          <Button 
            className="px-6 py-2" 
            onClick={(e) => {
              e.stopPropagation();
              navigate('/checkout', { state: { event } });
            }}
          >
            Book Now
          </Button>
        </div>
      </div>
    </div>
  );
};

const EventList = () => {
  const { isAuthenticated } = useAuthStore();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
  });

  const { data: wishlistResponse } = useQuery({
    queryKey: ['wishlist'],
    queryFn: wishlistApi.getWishlist,
    enabled: isAuthenticated,
  });

  const [isAiMode, setIsAiMode] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiEvents, setAiEvents] = React.useState([]);

  const handleAiRecommendations = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to get personalized AI recommendations!');
      return;
    }
    
    if (isAiMode) {
      // Toggle off
      setIsAiMode(false);
      return;
    }

    try {
      setAiLoading(true);
      const res = await aiApi.getRecommendations();
      setAiEvents(res.data || []);
      setIsAiMode(true);
      toast.success('Generated personalized recommendations! 🚀');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate AI recommendations. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading) return <div className="text-center py-20 text-xl font-medium text-gray-500">Loading amazing events...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Failed to load events. Please try again later.</div>;

  // The backend returns an ApiResponse where data.data is the actual array of events
  const normalEvents = response?.data?.data || [];
  const displayEvents = isAiMode ? aiEvents : normalEvents;
  
  // Create a Set of wishlisted event IDs for O(1) lookup safely
  const safeWishlistData = Array.isArray(wishlistResponse?.data?.events) ? wishlistResponse.data.events : [];
  const wishlistedIds = new Set(safeWishlistData.map(item => item.id));

  return (
    <div className="w-full h-full flex-grow flex flex-col py-4">
      <BackButton />
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Discover Events</h1>
          <p className="text-gray-500 mt-1">Find the best experiences happening around you</p>
        </div>
        
        <Button 
          variant={isAiMode ? "solid" : "outline"}
          onClick={handleAiRecommendations}
          disabled={aiLoading}
          className={`flex items-center gap-2 px-5 ${isAiMode ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
        >
          <Sparkles className={`h-4 w-4 ${isAiMode ? 'text-white' : 'text-indigo-600'}`} />
          {aiLoading ? 'AI is thinking...' : (isAiMode ? 'Clear Recommendations' : 'AI Recommendations')}
        </Button>
      </div>

      {aiLoading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-indigo-600 font-medium">Analyzing your preferences...</p>
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-lg">No events found. Check back later or create one!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayEvents.map((event) => (
            <EventCard 
              key={event.id} 
              event={event} 
              isInitiallyWishlisted={wishlistedIds.has(event.id)} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EventList;
