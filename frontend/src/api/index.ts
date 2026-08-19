import api from './axiosInstance';

export const analyticsApi = {
    getDashboard: () => api.get('/analytics/dashboard'),
    getAdmissionTrend: (period?: string) => api.get('/analytics/admissions/trend', { params: { period } }),
    getWardOccupancy: () => api.get('/analytics/ward/occupancy'),
    getRiskDistribution: () => api.get('/analytics/risk/distribution'),
    getEDA: () => api.get('/analytics/eda/distributions'),
    getStats: () => api.get('/analytics/stats/summary'),
    getHypothesis: () => api.get('/analytics/hypothesis/results'),
    getBigData: () => api.get('/analytics/big-data/report'),
};

export const mlApi = {
    predictAll: (patientId: string) => api.post('/ml/predict/all', { patientId }),
    getPredictions: (patientId: string) => api.get(`/ml/predictions/${patientId}`),
    getClusterResults: () => api.get('/ml/cluster/results'),
    getPatientCluster: (patientId: string) => api.get(`/ml/cluster/${patientId}`),
    generateRecommendations: (patientId: string) => api.post(`/ml/recommend/${patientId}`),
    getModelPerformance: () => api.get('/ml/models/performance'),
    getSHAP: (predictionId: string) => api.get(`/ml/shap/${predictionId}`),
    triggerRetrain: () => api.post('/ml/models/retrain'),
};

export const alertApi = {
    list: (params?: Record<string, unknown>) => api.get('/alerts', { params }),
    getUnreadCount: () => api.get('/alerts/unread/count'),
    markRead: (id: string) => api.patch(`/alerts/${id}/read`),
    resolve: (id: string) => api.patch(`/alerts/${id}/resolve`),
    markAllRead: () => api.patch('/alerts/read-all'),
};

export const vitalsApi = {
    record: (data: Record<string, unknown>) => api.post('/vitals', data),
    getForPatient: (id: string, params?: Record<string, unknown>) => api.get(`/vitals/patient/${id}`, { params }),
    getLatest: (id: string) => api.get(`/vitals/patient/${id}/latest`),
};

export const reportApi = {
    generatePatientPDF: (patientId: string) =>
        api.post(`/reports/patient/${patientId}`, {}, { responseType: 'blob' }),
};
