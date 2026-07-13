import api from './api';

export const bookingApi = {
  createBooking: async (bookingData) => {
    const response = await api.post('/api/v1/bookings', bookingData);
    return response.data;
  },

  getUserBookings: async () => {
    const response = await api.get('/api/v1/bookings/my-bookings');
    return response.data;
  },

  getBookingById: async (id) => {
    const response = await api.get(`/api/v1/bookings/${id}`);
    return response.data;
  },

  cancelBooking: async (id) => {
    const response = await api.put(`/api/v1/bookings/${id}/cancel`);
    return response.data;
  }
};
