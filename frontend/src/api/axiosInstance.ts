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

// Auth endpoints that return a 401 on their own failure (wrong password, an
// already-used refresh token, …) rather than because a session expired —
// the refresh-and-retry dance below must never run for these, or a plain
// "wrong password" turns into a hard redirect that wipes the form and any
// error on it before the user ever sees it.
const SKIP_REFRESH = ['/auth/login', '/auth/register', '/auth/patient-register', '/auth/refresh'];

// Response interceptor — handle 401 refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        const isAuthEndpoint = SKIP_REFRESH.some((p) => original?.url?.includes(p));
        if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
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
        // A non-auth-endpoint 401 already means the refresh attempt above
        // failed and the page is redirecting — a toast would just flash
        // and vanish. Auth-endpoint 401s (bad login/register credentials)
        // are real errors the caller displays inline, but they're worth a
        // toast too, same as any other failure.
        if (error.response?.status !== 401 || isAuthEndpoint) toast.error(message);
        return Promise.reject(error);
    }
);

export default api;
