import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import BackButton from '../../components/common/BackButton';
import { User, Mail, Phone, Calendar, Shield } from 'lucide-react';

const fetchUsers = async () => {
  const response = await api.get('/api/v1/auth/users');
  return response.data?.data;
};

const AdminUsers = () => {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: fetchUsers
  });

  if (isLoading) return <div className="text-center py-20 text-xl font-medium text-gray-500">Loading users...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Failed to load users.</div>;

  return (
    <div className="w-full h-full flex-grow flex flex-col py-8">
      <BackButton />
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Active Users</h1>
        <p className="text-gray-500 mt-1">View and manage platform users.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">Contact Info</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Joined On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!users || users.length === 0) ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">No active users found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-bold text-gray-900">{user.name}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-sm text-gray-600">
                        <span className="flex items-center gap-2"><Mail className="h-3 w-3 text-gray-400" /> {user.email}</span>
                        {user.phone && <span className="flex items-center gap-2"><Phone className="h-3 w-3 text-gray-400" /> {user.phone}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex w-max items-center gap-1 ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {user.role === 'ADMIN' && <Shield className="h-3 w-3" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
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

export default AdminUsers;
