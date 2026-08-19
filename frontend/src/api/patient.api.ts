import api from './axiosInstance';

export const patientApi = {
    list: (params?: Record<string, unknown>) => api.get('/patients', { params }),
    getById: (id: string) => api.get(`/patients/${id}`),
    create: (data: Record<string, unknown>) => api.post('/patients', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/patients/${id}`, data),
    delete: (id: string) => api.delete(`/patients/${id}`),
    getHighRisk: () => api.get('/patients/high-risk'),
    getAdmissions: (id: string) => api.get(`/patients/${id}/admissions`),
    createAdmission: (id: string, data: Record<string, unknown>) => api.post(`/patients/${id}/admissions`, data),
    getVitals: (id: string, params?: Record<string, unknown>) => api.get(`/patients/${id}/vitals`, { params }),
    getTimeline: (id: string) => api.get(`/patients/${id}/timeline`),
    getPredictions: (id: string) => api.get(`/patients/${id}/predictions`),
    getRecommendations: (id: string) => api.get(`/patients/${id}/recommendations`),
    getAlerts: (id: string) => api.get(`/patients/${id}/alerts`),
};
