import api from './api';

export const loginUser = async (email, password) => {
  const response = await api.post('/api/v1/auth/login', { email, password });
  return response.data;
};

export const registerUser = async (name, email, password) => {
  const response = await api.post('/api/v1/auth/register', { name, email, password });
  return response.data;
};

export const verify2FALogin = async (token, tempToken) => {
  // Pass the temporary token if needed by backend, or just use the OTP
  const response = await api.post('/api/v2/2fa/verify-login', { token }, {
    headers: { Authorization: `Bearer ${tempToken}` }
  });
  return response.data;
};
