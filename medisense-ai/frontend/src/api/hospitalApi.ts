import axios from './axiosInstance';

export const consultationApi = {
    create: (data: any) => axios.post('/consultations', data),
    getById: (id: string) => axios.get(`/consultations/${id}`),
    getByDoctor: (doctorId: string, date?: string) =>
        axios.get(`/consultations/doctor/${doctorId}`, { params: { date } }),
    getByPatient: (patientId: string) => axios.get(`/consultations/patient/${patientId}`),
    update: (id: string, data: any) => axios.patch(`/consultations/${id}`, data),
    savePrescription: (id: string, data: any) => axios.post(`/consultations/${id}/prescription`, data),
    closeAndBill: (id: string, patientId: string) => axios.post(`/consultations/${id}/close`, { patientId }),
};

export const labApi = {
    createRequest: (data: any) => axios.post('/lab', data),
    getPending: () => axios.get('/lab/pending'),
    getMyTests: () => axios.get('/lab/my'),   // for patient portal — own tests only
    getAll: (filters?: { patientId?: string; status?: string }) => axios.get('/lab', { params: filters }),
    getById: (id: string) => axios.get(`/lab/${id}`),
    accept: (id: string) => axios.patch(`/lab/${id}/accept`, {}),
    markSampleCollected: (id: string) => axios.patch(`/lab/${id}/sample-collected`, {}),
    uploadResult: (id: string, data: any) => axios.post(`/lab/${id}/results`, data),
};

export const billingApi = {
    list: (filters?: { isPaid?: boolean; patientId?: string }) => axios.get('/billing', { params: filters }),
    getById: (id: string) => axios.get(`/billing/${id}`),
    markPaid: (id: string, paymentMethod: string) => axios.patch(`/billing/${id}/pay`, { paymentMethod }),
    revenueToday: () => axios.get('/billing/revenue/today'),
};
