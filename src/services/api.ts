import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  // baseURL: import.meta.env.VITE_API_URL || 'https://api.leox24.com/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData - let axios set it automatically with boundary
    if (config.data instanceof FormData) {
      // Axios 1.x uses AxiosHeaders, whose normalized key may be lowercase.
      // Use its delete method so a stale JSON content type cannot be sent with
      // a binary multipart upload (especially .xls/.xlsx files).
      if (config.headers && typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      } else if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    } else if (error.response?.status === 402) {
      // Payment Required - redirect to subscription page
      const isSubscriptionPage = window.location.pathname.startsWith('/subscribe') || 
                                 window.location.pathname.startsWith('/subscription');
      if (!isSubscriptionPage) {
        window.location.href = '/subscribe';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
