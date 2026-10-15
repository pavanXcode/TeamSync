import axios from 'axios';

/**
 * TeamSync - Centralized Axios HTTP Client
 * Configured with environment-based baseURL and default headers.
 * Ready for Part 2 & Part 3 backend integration (FastAPI).
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor (prepared for future auth tokens / headers)
api.interceptors.request.use(
  (config) => {
    // Note: Future auth token injection can be handled here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (prepared for error handling / notifications)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Note: Centralized error handling for 401, 403, 500 can be wired here
    return Promise.reject(error);
  }
);

export default api;
