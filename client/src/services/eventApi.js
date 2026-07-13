import api from './api';

export const getEvents = async () => {
  const response = await api.get('/api/v1/events');
  return response.data;
};

export const getEventById = async (id) => {
  const response = await api.get(`/api/v1/events/${id}`);
  return response.data;
};

export const createEvent = async (eventData) => {
  const response = await api.post('/api/v1/events', eventData);
  return response.data;
};

export const updateEvent = async (id, eventData) => {
  const response = await api.put(`/api/v1/events/${id}`, eventData);
  return response.data;
};

export const deleteEvent = async (id) => {
  const response = await api.delete(`/api/v1/events/${id}`);
  return response.data;
};

export const getWishlist = async () => {
  const response = await api.get('/api/v2/wishlist');
  return response.data;
};

export const toggleWishlist = async (eventId) => {
  const response = await api.post(`/api/v2/wishlist/${eventId}`);
  return response.data;
};

export const getAIRecommendations = async (preferences) => {
  const response = await api.post('/api/v2/ai/recommend', { preferences });
  return response.data;
};
