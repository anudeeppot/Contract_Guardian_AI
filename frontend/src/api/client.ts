import axios from 'axios';

const defaultApiBaseUrl = `${window.location.protocol}//127.0.0.1:8000/api/v1`;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('contract_guardian_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message = error.response?.data?.error?.message ?? error.response?.data?.detail ?? error.message;
    if (error.response?.status === 401) {
      window.localStorage.removeItem('contract_guardian_token');
    }
    return Promise.reject(new Error(message));
  },
);

