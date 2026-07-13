import api from './api';

export const wishlistApi = {
  getWishlist: async () => {
    const response = await api.get('/api/v2/wishlist');
    return response.data;
  },

  addToWishlist: async (eventId) => {
    const response = await api.post('/api/v2/wishlist', { eventId });
    return response.data;
  },

  removeFromWishlist: async (eventId) => {
    const response = await api.delete(`/api/v2/wishlist/${eventId}`);
    return response.data;
  },

  checkWishlistStatus: async (eventId) => {
    const response = await api.get(`/api/v2/wishlist/check/${eventId}`);
    return response.data;
  },

  clearWishlist: async () => {
    const response = await api.delete('/api/v2/wishlist');
    return response.data;
  }
};
