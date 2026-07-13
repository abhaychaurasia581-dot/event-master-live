import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Ticket, Calendar, Clock, MapPin, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import BackButton from '../../components/common/BackButton';

const Dashboard = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const data = await bookingApi.getUserBookings();
        setTickets(data.data || []);
      } catch (err) {
        setError('Failed to load tickets.');
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  return (
    <div className="w-full h-full flex-grow flex flex-col py-8">
      <BackButton />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Welcome back, {user?.name || 'User'}! 👋</h1>
          <p className="text-gray-500 mt-1 text-lg">Here is a summary of your upcoming events and tickets.</p>
        </div>
        <Link to="/settings" className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm">
          Security Settings
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Ticket className="h-6 w-6 text-indigo-600" />
          My Tickets
        </h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3 font-medium">Loading tickets...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 font-medium">{error}</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">You haven't booked any tickets yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="border border-gray-200 rounded-2xl p-6 flex flex-col hover:border-indigo-300 transition-all bg-gradient-to-br from-white to-gray-50 hover:shadow-md">
                <div className="flex justify-between items-start mb-4 border-b border-gray-200 pb-4">
                  <h3 className="text-xl font-bold text-gray-900 pr-4">{ticket.event_title || 'Unknown Event'}</h3>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">{ticket.ticket_number || 'General'}</span>
                </div>
                
                <div className="space-y-4 mb-6 flex-grow">
                  <div className="flex items-center gap-3 text-gray-700 font-medium text-sm">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100"><Calendar className="h-4 w-4 text-indigo-500" /></div>
                    <span>{ticket.event_date ? new Date(ticket.event_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700 font-medium text-sm">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100"><Clock className="h-4 w-4 text-indigo-500" /></div>
                    <span>{ticket.start_time || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700 font-medium text-sm">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100"><MapPin className="h-4 w-4 text-indigo-500" /></div>
                    <span>{ticket.venue || 'TBA'}</span>
                  </div>
                </div>
                
                <div className="mt-auto pt-4 border-t border-dashed border-gray-300 flex justify-between items-center bg-white -mx-6 -mb-6 p-6 rounded-b-2xl">
                  <span className="text-xs text-gray-400 font-mono tracking-wider">Ref: {ticket.booking_reference}</span>
                  <button className="text-indigo-600 text-sm font-bold hover:text-indigo-800 transition-colors">View QR Code &rarr;</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
