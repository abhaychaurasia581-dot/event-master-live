import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, deleteEvent } from '../../services/eventApi';
import BackButton from '../../components/common/BackButton';
import { Calendar, MapPin, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const AdminEvents = () => {
  const queryClient = useQueryClient();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted successfully');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to delete event');
    }
  });

  if (isLoading) return <div className="text-center py-20 text-xl font-medium text-gray-500">Loading events...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Failed to load events.</div>;

  const events = response?.data?.data || [];

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="w-full h-full flex-grow flex flex-col py-8">
      <BackButton />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Manage Events</h1>
          <p className="text-gray-500 mt-1">View, edit, and delete hosted events.</p>
        </div>
        <Link to="/admin/create-event" className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition font-medium">
          + Publish New Event
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                <th className="p-4 font-semibold">Event Name</th>
                <th className="p-4 font-semibold">Date & Time</th>
                <th className="p-4 font-semibold">Location</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">No events found.</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{event.title}</div>
                      <div className="text-sm text-gray-500">${event.ticket_price} • {event.capacity} seats</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Calendar className="h-4 w-4 text-indigo-500" />
                        {new Date(event.event_date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{event.start_time}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <MapPin className="h-4 w-4 text-indigo-500" />
                        {event.venue}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wide">
                        {event.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link 
                        to={`/admin/events/${event.id}/edit`}
                        className="inline-block p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Event"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                      <button 
                        onClick={() => handleDelete(event.id)}
                        disabled={deleteMutation.isLoading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminEvents;
