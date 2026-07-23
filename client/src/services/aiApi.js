import api from './api';

export const aiApi = {
  getRecommendations: async (params = {}) => {
    const response = await api.get('/ai/recommendations', { params });
    return response.data;
  }
};
