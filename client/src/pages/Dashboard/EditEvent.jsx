import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, DollarSign, Image as ImageIcon, Users, AlertCircle } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { getEventById, updateEvent } from '../../services/eventApi';

const EditEvent = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    price: '',
    capacity: '',
    description: ''
  });
  
  const [bannerImage, setBannerImage] = useState(null);
  const [additionalImages, setAdditionalImages] = useState([]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await getEventById(id);
        const event = response.data;
        
        // Format date and time
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toISOString().split('T')[0];
        
        setFormData({
          title: event.title || '',
          date: formattedDate || '',
          time: event.start_time || '',
          location: event.venue || '',
          price: event.ticket_price || '0',
          capacity: event.capacity || '',
          description: event.description || ''
        });
      } catch (error) {
        toast.error('Failed to load event details');
        navigate('/admin');
      } finally {
        setFetching(false);
      }
    };
    fetchEvent();
  }, [id, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleBannerChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setBannerImage(e.target.files[0]);
    }
  };

  const handleAdditionalChange = (e) => {
    if (e.target.files) {
      setAdditionalImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      
      if (bannerImage) {
        data.append('banner_image', bannerImage);
      }
      
      additionalImages.forEach((img) => {
        data.append('additional_images', img);
      });

      await updateEvent(id, data);
      toast.success('Event updated successfully!');
      navigate('/admin');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update event');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="w-full h-full flex-grow flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto py-8">
      <BackButton />
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Edit Event</h1>
        <p className="text-gray-500 mt-1">Update your event details and media.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
            <Input 
              label="Event Title" 
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Summer Music Festival 2027"
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Date" 
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
              <Input 
                label="Time" 
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-4 border-b border-gray-100 pb-6">
            <h2 className="text-xl font-bold text-gray-900">Location & Ticketing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Location / Venue" 
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Central Park, NY"
                required
              />
              <Input 
                label="Ticket Capacity" 
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="e.g. 500"
                required
              />
            </div>
            <Input 
              label="Ticket Price ($)" 
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              placeholder="e.g. 150 (Enter 0 for Free)"
              required
            />
          </div>

          <div className="space-y-4 border-b border-gray-100 pb-6">
            <h2 className="text-xl font-bold text-gray-900">Event Media (Optional)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col w-full">
                <label className="mb-1 text-sm font-medium text-gray-700">Banner Image</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">Main cover image for the event.</p>
              </div>
              <div className="flex flex-col w-full">
                <label className="mb-1 text-sm font-medium text-gray-700">Additional Images</label>
                <input 
                  type="file" 
                  accept="image/*"
                  multiple
                  onChange={handleAdditionalChange}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">Select up to 5 additional gallery images.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pb-4">
            <h2 className="text-xl font-bold text-gray-900">Event Description</h2>
            <div className="flex flex-col w-full">
              <label className="mb-1 text-sm font-medium text-gray-700">Description</label>
              <textarea 
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors min-h-[120px] font-sans"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell attendees what to expect..."
                required
              ></textarea>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/admin')}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEvent;
