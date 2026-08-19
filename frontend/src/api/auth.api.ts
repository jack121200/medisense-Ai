import api from './axiosInstance';

export const authApi = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    register: (data: Record<string, unknown>) =>
        api.post('/auth/register', data),
    registerPatient: (data: Record<string, unknown>) =>
        api.post('/auth/patient-register', data),

    refresh: (refreshToken: string) =>
        api.post('/auth/refresh', { refreshToken }),
    logout: (refreshToken: string) =>
        api.post('/auth/logout', { refreshToken }),
    getMe: () => api.get('/auth/me'),
    updateProfile: (data: Record<string, unknown>) =>
        api.patch('/auth/me', data),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.patch('/auth/me/password', { currentPassword, newPassword }),
};
