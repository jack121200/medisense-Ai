import { create } from 'zustand';

interface Alert {
    id: string;
    patientId: string;
    patientName?: string;
    type: string;
    severity: string;
    message: string;
    timestamp: Date;
    isRead: boolean;
    isResolved: boolean;
}

interface AlertState {
    alerts: Alert[];
    unreadCount: number;
    addAlert: (alert: Alert) => void;
    setAlerts: (alerts: Alert[]) => void;
    setUnreadCount: (count: number) => void;
    markRead: (id: string) => void;
    markAllRead: () => void;
    resolve: (id: string) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
    alerts: [],
    unreadCount: 0,

    addAlert: (alert) =>
        set((s) => ({ alerts: [alert, ...s.alerts.slice(0, 99)], unreadCount: s.unreadCount + 1 })),

    setAlerts: (alerts) =>
        set({ alerts }),

    setUnreadCount: (count) =>
        set({ unreadCount: count }),

    markRead: (id) =>
        set((s) => ({
            alerts: s.alerts.map((a) => a.id === id ? { ...a, isRead: true } : a),
            unreadCount: Math.max(0, s.unreadCount - 1),
        })),

    markAllRead: () =>
        set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, isRead: true })), unreadCount: 0 })),

    resolve: (id) =>
        set((s) => ({ alerts: s.alerts.map((a) => a.id === id ? { ...a, isResolved: true } : a) })),
}));
