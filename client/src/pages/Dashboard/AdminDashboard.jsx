import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Users, DollarSign, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import Button from '../../components/common/Button';
import { Link } from 'react-router-dom';
import BackButton from '../../components/common/BackButton';

const fetchAdminStats = async () => {
  const response = await api.get('/api/v1/dashboards/admin');
  return response.data?.data;
};

const AdminDashboard = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  });

  if (isLoading) return <div className="text-center py-20 text-xl font-medium text-gray-500">Loading Dashboard Analytics...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Failed to load admin stats. Ensure you are logged in as an Admin.</div>;

  const overview = data?.overview || {};

  const stats = [
    { title: 'Total Revenue', value: `$${Number(overview.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100', link: '/admin/revenue' },
    { title: 'Active Users', value: Number(overview.totalUsers || 0).toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', link: '/admin/users' },
    { title: 'Events Hosted', value: Number(overview.totalEvents || 0).toLocaleString(), icon: CalendarIcon, color: 'text-purple-600', bg: 'bg-purple-100', link: '/admin/events' },
    { title: 'Tickets Sold', value: Number(overview.confirmedBookings || 0).toLocaleString(), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100', link: '/admin/bookings' }
  ];

  return (
    <div className="w-full h-full flex-grow flex flex-col py-8">
      <BackButton />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Dashboard 👑</h1>
          <p className="text-gray-500 mt-1">Platform overview, revenue, and management.</p>
        </div>
        <Button to="/admin/create-event" variant="primary" className="shadow-md">
          + Publish New Event
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <Link to={stat.link} key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className={`p-4 rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.title}</p>
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Recent Activity Log */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Live System Activity</h2>
        <div className="space-y-4">
          <div className="p-4 border border-gray-100 rounded-xl flex justify-between items-center bg-gray-50">
            <div>
              <span className="font-bold text-gray-900 block">New User Registration</span>
              <p className="text-sm text-gray-500 mt-0.5">user@example.com joined the platform securely.</p>
            </div>
            <span className="text-xs font-mono text-gray-400 bg-gray-200 px-2 py-1 rounded">Just now</span>
          </div>
          <div className="p-4 border border-gray-100 rounded-xl flex justify-between items-center bg-gray-50">
            <div>
              <span className="font-bold text-green-700 block">Successful Payment Received</span>
              <p className="text-sm text-gray-500 mt-0.5">Stripe processed $598 for 2x VIP Passes (Tech Summit).</p>
            </div>
            <span className="text-xs font-mono text-gray-400 bg-gray-200 px-2 py-1 rounded">5 mins ago</span>
          </div>
          <div className="p-4 border border-gray-100 rounded-xl flex justify-between items-center bg-gray-50">
            <div>
              <span className="font-bold text-red-600 block">Security Event: 2FA Failed</span>
              <p className="text-sm text-gray-500 mt-0.5">Invalid TOTP code entered 3 times by IP 192.168.1.1</p>
            </div>
            <span className="text-xs font-mono text-gray-400 bg-gray-200 px-2 py-1 rounded">1 hr ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
