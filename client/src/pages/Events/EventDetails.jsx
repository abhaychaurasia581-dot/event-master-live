import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEventById } from '../../services/eventApi';
import BackButton from '../../components/common/BackButton';
import Button from '../../components/common/Button';
import { Calendar, MapPin, Users, DollarSign, Clock, Info, Heart } from 'lucide-react';
import { wishlistApi } from '../../services/wishlistApi';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { this.setState({ info }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-red-500 font-mono bg-white min-h-screen z-50 relative">
          <h1 className="text-2xl font-bold">Component Crashed!</h1>
          <pre className="mt-4 bg-gray-100 p-4 overflow-auto">{this.state.error?.toString()}</pre>
          <pre className="mt-4 bg-gray-100 p-4 overflow-auto">{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const EventDetailsContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEventById(id)
  });

  const { data: wishlistResponse } = useQuery({
    queryKey: ['wishlist'],
    queryFn: wishlistApi.getWishlist,
    enabled: isAuthenticated,
  });

  if (isLoading) return <div className="text-center py-20 text-xl font-medium text-gray-500">Loading event details...</div>;
  if (error || !response?.data) return <div className="text-center py-20 text-red-500">Failed to load event. Please try again.</div>;

  const safeWishlistData = wishlistResponse?.data?.events || [];
  const isWishlisted = safeWishlistData.some(item => item.id === id);

  const handleWishlistToggle = async () => {
    try {
      if (isWishlisted) {
        await wishlistApi.removeFromWishlist(id);
        queryClient.invalidateQueries({ queryKey: ['wishlist'] });
        toast.success('Removed from wishlist');
      } else {
        await wishlistApi.addToWishlist(id);
        queryClient.invalidateQueries({ queryKey: ['wishlist'] });
        toast.success('Added to wishlist! ❤️');
      }
    } catch (err) {
      toast.error('Please login to modify wishlist.');
    }
  };

  const event = response.data;
  
  // Base URL for images
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  
  // Format Banner Image URL
  const bannerImage = event.banner_image 
    ? (event.banner_image.startsWith('http') ? event.banner_image : `${API_URL}${event.banner_image}`)
    : 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80';

  // Parse additional images safely
  let additionalImages = [];
  try {
    if (event.additional_images) {
      const parsed = typeof event.additional_images === 'string' ? JSON.parse(event.additional_images) : event.additional_images;
      if (Array.isArray(parsed)) {
        additionalImages = parsed.map(img => img.startsWith('http') ? img : `${API_URL}${img}`);
      }
    }
  } catch (e) {
    console.error('Error parsing additional_images:', e);
  }

  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto py-8 bg-gray-50">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <BackButton />
        
        {/* Banner Section */}
        <div className="w-full h-64 md:h-96 rounded-3xl overflow-hidden relative shadow-md mt-6 bg-gray-900">
          <img src={bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 blur-xl scale-110 pointer-events-none" />
          <img src={bannerImage} alt={event.title} className="relative w-full h-full object-contain z-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 p-8 w-full z-20">
            <div className="inline-block px-3 py-1 bg-indigo-600 text-white font-bold rounded-full text-xs mb-3 shadow-sm uppercase tracking-wider">
              {event.status}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2 drop-shadow-md">
              {event.title}
            </h1>
            <p className="text-gray-200 text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-400" />
              {event.venue} {event.city ? `, ${event.city}` : ''}
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          
          {/* Main Content (Left 2/3) */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="h-6 w-6 text-indigo-600" />
                About This Event
              </h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>

            {/* Additional Images Gallery */}
            {additionalImages.length > 0 && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {additionalImages.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-2xl overflow-hidden shadow-sm">
                      <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500 cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar (Right 1/3) */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 sticky top-24">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Event Details</h3>
              
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Date</p>
                    <p className="text-gray-900 font-bold">{new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Time</p>
                    <p className="text-gray-900 font-bold">{event.start_time} - {event.end_time || 'TBD'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Capacity</p>
                    <p className="text-gray-900 font-bold">{event.available_seats} / {event.capacity} seats left</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Ticket Price</p>
                    <p className="text-gray-900 font-bold text-xl">{Number(event.ticket_price) === 0 ? 'Free' : `$${Number(event.ticket_price).toFixed(2)}`}</p>
                  </div>
                </div>
              </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
                  <Button className="w-full py-4 text-lg shadow-md hover:shadow-lg transition-all" onClick={() => navigate('/checkout', { state: { event } })}>
                    Book Tickets Now
                  </Button>
                  <button 
                    onClick={handleWishlistToggle}
                    className={`w-full py-4 text-lg rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${
                      isWishlisted 
                        ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100' 
                        : 'bg-white text-gray-700 border-gray-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Heart className={`h-6 w-6 ${isWishlisted ? 'fill-current' : ''}`} />
                    {isWishlisted ? 'Saved to Wishlist' : 'Save to Wishlist'}
                  </button>
                </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

const EventDetails = () => (
  <ErrorBoundary>
    <EventDetailsContent />
  </ErrorBoundary>
);

export default EventDetails;
