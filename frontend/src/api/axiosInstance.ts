import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

// Use empty base so calls go through the Vite dev proxy → backend (no CORS)
const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().accessToken;
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — handle 401 refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refreshToken = useAuthStore.getState().refreshToken;
                if (!refreshToken) throw new Error('No refresh token');
                const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
                useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
                original.headers.Authorization = `Bearer ${data.data.accessToken}`;
                return api(original);
            } catch {
                useAuthStore.getState().logout();
                window.location.href = '/login';
            }
        }
        const message = error.response?.data?.message || 'Something went wrong';
        if (error.response?.status !== 401) toast.error(message);
        return Promise.reject(error);
    }
);

export default api;
