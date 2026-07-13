import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import BackButton from '../../components/common/BackButton';
import { Ticket, Calendar, DollarSign, User, Hash } from 'lucide-react';

const fetchAllBookings = async () => {
  const response = await api.get('/api/v1/bookings/admin/all');
  return response.data?.data;
};

const AdminBookings = () => {
  const { data: bookingsData, isLoading, error } = useQuery({
    queryKey: ['adminBookings'],
    queryFn: fetchAllBookings
  });

  if (isLoading) return <div className="text-center py-20 text-xl font-medium text-gray-500">Loading tickets sold...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Failed to load bookings.</div>;

  const bookings = bookingsData?.data || [];
  const total = bookingsData?.total || 0;

  return (
    <div className="w-full h-full flex-grow flex flex-col py-8">
      <BackButton />
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Tickets Sold</h1>
          <p className="text-gray-500 mt-1">View all platform bookings and ticket sales.</p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold">
          Total: {total} Records
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                <th className="p-4 font-semibold">Booking ID</th>
                <th className="p-4 font-semibold">Event</th>
                <th className="p-4 font-semibold">Buyer</th>
                <th className="p-4 font-semibold">Tickets</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">No tickets sold yet.</td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm font-mono text-gray-500">
                        <Hash className="h-3 w-3" />
                        {booking.id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="p-4 font-bold text-gray-900">{booking.event_title}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 flex items-center gap-1"><User className="h-3 w-3" /> {booking.user_name}</span>
                        <span className="text-xs text-gray-500">{booking.user_email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold text-sm">
                        <Ticket className="h-3 w-3" /> {booking.number_of_seats}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                        ${booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 
                          booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="p-4 text-right text-sm text-gray-500">
                      {new Date(booking.created_at).toLocaleString()}
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

export default AdminBookings;
