import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// ============================================================================
// Core Axios Instance
// Connects to the Node.js Enterprise Backend
// ============================================================================
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true, // Critical for receiving and sending Secure HttpOnly Cookies
});

// ============================================================================
// Request Interceptor: Inject JWT and CSRF Tokens
// ============================================================================
api.interceptors.request.use(
  (config) => {
    // 1. JWT Injection (Zustand Global State)
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // 2. CSRF Token Injection (Double-Submit Pattern)
    // The backend provides a raw CSRF token via a setup endpoint.
    // We attach it to the X-CSRF-Token header for all state-changing requests.
    const csrfToken = localStorage.getItem('csrf_token');
    const methodsRequiringCsrf = ['post', 'put', 'patch', 'delete'];
    
    if (csrfToken && methodsRequiringCsrf.includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================================================
// Response Interceptor: Global Error Handling
// ============================================================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Detect expired or invalid tokens automatically
    if (error.response && error.response.status === 401) {
      const errorMessage = error.response.data?.message;
      
      // If the error isn't explicitly part of the 2FA login challenge, log the user out
      if (errorMessage !== 'Pending 2FA token required' && errorMessage !== 'Invalid OTP or Backup Code') {
        useAuthStore.getState().logout();
        // Redirect to login could be handled here or in the UI layer
      }
    }
    
    // Bubble up the error so the specific component can handle it (e.g. show Toast)
    return Promise.reject(error);
  }
);

export default api;
