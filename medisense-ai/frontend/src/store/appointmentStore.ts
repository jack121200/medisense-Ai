import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Appointment {
    id: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorId: string;
    doctorName: string;
    doctorDept: string;
    date: string;          // YYYY-MM-DD
    time: string;          // HH:mm
    reason: string;
    status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    notes?: string;
    createdAt: string;
    smsSent: boolean;
}

export interface ManualPatient {
    id: string;
    registeredAt: string;
}

interface AppointmentState {
    appointments: Appointment[];
    manualPatientIds: string[];   // IDs of patients added by receptionist
    addAppointment: (a: Appointment) => void;
    updateStatus: (id: string, status: Appointment['status']) => void;
    cancel: (id: string) => void;
    markSMSSent: (id: string) => void;
    addManualPatientId: (id: string) => void;
}

export const useAppointmentStore = create<AppointmentState>()(
    persist(
        (set) => ({
            appointments: [],
            manualPatientIds: [],

            addAppointment: (a) =>
                set((s) => ({ appointments: [a, ...s.appointments] })),

            updateStatus: (id, status) =>
                set((s) => ({
                    appointments: s.appointments.map((a) =>
                        a.id === id ? { ...a, status } : a
                    ),
                })),

            cancel: (id) =>
                set((s) => ({
                    appointments: s.appointments.map((a) =>
                        a.id === id ? { ...a, status: 'CANCELLED' } : a
                    ),
                })),

            markSMSSent: (id) =>
                set((s) => ({
                    appointments: s.appointments.map((a) =>
                        a.id === id ? { ...a, smsSent: true } : a
                    ),
                })),

            addManualPatientId: (id) =>
                set((s) => ({
                    manualPatientIds: [...new Set([...s.manualPatientIds, id])],
                })),
        }),
        { name: 'medisense-appointments' }
    )
);
