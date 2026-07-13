import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import BackButton from '../../components/common/BackButton';
import { DollarSign, TrendingUp, Hash, Calendar } from 'lucide-react';

const fetchAllBookings = async () => {
  const response = await api.get('/api/v1/bookings/admin/all');
  return response.data?.data;
};

const AdminRevenue = () => {
  const { data: bookingsData, isLoading, error } = useQuery({
    queryKey: ['adminBookings'], // Re-using the same cache key if they navigated from bookings
    queryFn: fetchAllBookings
  });

  if (isLoading) return <div className="text-center py-20 text-xl font-medium text-gray-500">Loading revenue data...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Failed to load revenue data.</div>;

  const bookings = bookingsData?.data || [];
  
  // Filter only confirmed bookings for revenue
  const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED');
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);

  // Group by event
  const revenueByEvent = confirmedBookings.reduce((acc, b) => {
    if (!acc[b.event_title]) {
      acc[b.event_title] = { title: b.event_title, revenue: 0, tickets: 0 };
    }
    acc[b.event_title].revenue += Number(b.total_amount);
    acc[b.event_title].tickets += Number(b.number_of_seats);
    return acc;
  }, {});

  const groupedRevenue = Object.values(revenueByEvent).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="w-full h-full flex-grow flex flex-col py-8">
      <BackButton />
      
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Revenue & Transactions</h1>
          <p className="text-gray-500 mt-1">Detailed breakdown of platform earnings.</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full">
            <DollarSign className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-green-800 uppercase tracking-wide">Total Confirmed Revenue</p>
            <p className="text-2xl font-black text-green-900">${totalRevenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                <th className="p-4 font-semibold">Event Name</th>
                <th className="p-4 font-semibold">Tickets Sold</th>
                <th className="p-4 font-semibold">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedRevenue.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-gray-500">No transactions recorded yet.</td>
                </tr>
              ) : (
                groupedRevenue.map((event, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{event.title}</td>
                    <td className="p-4 font-medium text-gray-700">{event.tickets} Tickets</td>
                    <td className="p-4">
                      <span className="font-bold text-lg text-green-600">
                        ${event.revenue.toLocaleString()}
                      </span>
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

export default AdminRevenue;
