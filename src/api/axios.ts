import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';

// Create axios instance with default config

const axiosInstance = axios.create({
  baseURL: 'https://pickanddrop.app/backend/api/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = store.getState();
    const token = state.auth.token || state.auth.user?.token;

    // Add token to request headers if it exists
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request for debugging (remove in production)
    if (import.meta.env.DEV) {
      console.log('API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response for debugging (remove in production)
    if (import.meta.env.DEV) {
      console.log('API Response:', {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  (error: AxiosError) => {
    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 401:
          // Unauthorized - redirect to login
          console.error('Unauthorized access - redirecting to login');
          // You can dispatch a logout action here if needed
          // store.dispatch(logout());
          window.location.href = '/login';
          break;

        case 403:
          // Forbidden
          console.error('Access forbidden:', data?.message || 'You do not have permission');
          break;

        case 404:
          // Not found
          console.error('Resource not found:', error.config?.url);
          break;

        case 500:
          // Server error
          console.error('Server error:', data?.message || 'Internal server error');
          break;

        default:
          console.error('API Error:', data?.message || 'An error occurred');
      }

      // Return a formatted error
      return Promise.reject({
        status,
        message: data?.message || 'An error occurred',
        data: data,
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error: No response received');
      return Promise.reject({
        status: 0,
        message: 'Network error - please check your connection',
      });
    } else {
      // Something else happened
      console.error('Error:', error.message);
      return Promise.reject({
        status: 0,
        message: error.message || 'An unexpected error occurred',
      });
    }
  }
);

export default axiosInstance;
