import api from './axiosInstance';

export const appointmentApi = {
    // Patient: create a new appointment request
    create: (data: {
        doctorId: string;
        requestedDate: string;
        timeSlot: 'MORNING' | 'NOON' | 'NIGHT' | 'LATE_NIGHT';
        reason?: string;
    }) => api.post('/appointment-requests', data),

    // Get requests — returns own for PATIENT, all for RECEPTIONIST
    list: () => api.get('/appointment-requests'),

    // Receptionist: approve
    approve: (id: string, data: { scheduledDate: string; scheduledTime: string }) =>
        api.patch(`/appointment-requests/${id}/approve`, data),

    // Receptionist: reject with counter-offer
    reject: (id: string, data: { rejectReason?: string; counterDate?: string; counterTime?: string }) =>
        api.patch(`/appointment-requests/${id}/reject`, data),

    // Patient: respond to counter-offer
    respond: (id: string, accept: boolean) =>
        api.patch(`/appointment-requests/${id}/respond`, { accept }),

    // Receptionist/admin: book directly on behalf of a patient (walk-in/phone),
    // confirmed immediately - no separate patient-approval step.
    bookForPatient: (data: {
        patientId: string;
        doctorId: string;
        requestedDate: string;
        timeSlot: 'MORNING' | 'NOON' | 'NIGHT' | 'LATE_NIGHT';
        reason?: string;
    }) => api.post('/appointment-requests/staff-book', data),
};

export const doctorsPublicApi = {
    list: () => api.get('/doctors'),
};

export const notificationsApi = {
    list: () => api.get('/notifications'),
    unreadCount: () => api.get('/notifications/unread-count'),
    markRead: (id: string) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch('/notifications/read-all'),
};
