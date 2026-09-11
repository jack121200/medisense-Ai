import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useVitalsStore } from '../store/vitalsStore';
import { useAlertStore } from '../store/alertStore';
import toast from 'react-hot-toast';

// Same host as the API, or — when neither is configured — the page's own
// origin, which nginx proxies /socket.io/ from. A hardcoded localhost:5000
// fallback only worked on the development machine.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;

// Toasts in the forest palette: deep pine ground, mint text, and a border in
// the semantic colour for the event.
const TONE = { critical: '#C8434B', warning: '#C99A2A', info: '#8EB69B', success: '#3F8A66' } as const;
const toastStyle = (tone: keyof typeof TONE) => ({
    background: '#0B2B26', color: '#DAF1DE', border: `1px solid ${TONE[tone]}`, fontSize: '13px',
});

// crypto.randomUUID exists only in secure contexts (HTTPS or localhost). Over
// plain HTTP it is undefined, and calling it threw inside the alert handler,
// losing the alert.
const localId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let socketInstance: Socket | null = null;

export function useSocket() {
    const { accessToken, isAuthenticated } = useAuthStore();
    const { updateVitals } = useVitalsStore();
    const { addAlert } = useAlertStore();
    const connected = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !accessToken || connected.current) return;

        socketInstance = io(SOCKET_URL, {
            // A function, so every connection attempt sends the current token:
            // an automatic reconnect after the access token was refreshed would
            // otherwise replay the expired one and be refused.
            auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        // The server authenticates the connection and places it in this
        // user's and role's rooms itself; the client no longer names rooms.
        socketInstance.on('connect', () => {
            connected.current = true;
        });

        // ── Real-time vitals ────────────────────────────────────────────────
        socketInstance.on('vitals:update', (data) => {
            updateVitals({
                patientId: data.patientId,
                heartRate: data.heartRate,
                oxygenSaturation: data.oxygenSaturation,
                systolicBP: data.systolicBP,
                diastolicBP: data.diastolicBP,
                temperature: data.temperature,
                timestamp: new Date(data.timestamp),
                isAnomaly: data.isAnomaly,
            });
        });

        // ── Alerts (staff only — the server sends these to the staff room) ──
        socketInstance.on('alert:new', (data) => {
            addAlert({
                id: data.alertId || localId(),
                patientId: data.patientId,
                patientName: data.patientName,
                type: data.type,
                severity: data.severity,
                message: data.message,
                timestamp: new Date(data.timestamp),
                isRead: false,
                isResolved: false,
            });

            const prefix = data.severity === 'CRITICAL' || data.severity === 'EMERGENCY' ? '🚨' : data.severity === 'WARNING' ? '⚠️' : 'ℹ️';
            const name = data.patientName ? `${data.patientName}: ` : '';
            const label = `${prefix} [${data.severity}] ${name}${data.message}`;

            if (data.severity === 'CRITICAL' || data.severity === 'EMERGENCY') {
                toast.error(label, { duration: 8000, style: toastStyle('critical') });
            } else if (data.severity === 'WARNING') {
                toast(label, { duration: 5000, icon: '⚠️', style: toastStyle('warning') });
            } else {
                toast(label, { duration: 4000, style: toastStyle('info') });
            }
        });

        // ── Risk escalation ─────────────────────────────────────────────────
        socketInstance.on('risk:escalated', (data) => {
            toast.error(
                `⚠️ ${data.patientName}: Risk escalated ${data.previousRisk} → ${data.newRisk}`,
                { duration: 10000, style: toastStyle('critical') },
            );
        });

        // ── REAL-TIME PATIENT PORTAL EVENTS ────────────────────────────────

        // New prescription written by doctor → patient portal update
        socketInstance.on('prescription:new', (data) => {
            toast.success(
                `💊 New prescription ready (${data.itemCount} medication${data.itemCount > 1 ? 's' : ''})`,
                { duration: 7000, style: toastStyle('success') },
            );
            // Trigger a custom event so patient portal pages can refetch without reload
            window.dispatchEvent(new CustomEvent('medisense:prescription:new', { detail: data }));
        });

        // Invoice created or payment updated → patient portal update
        socketInstance.on('invoice:new', (data) => {
            const isPaid = data.status === 'PAID';
            toast(
                isPaid
                    ? `✅ Payment confirmed — Invoice #${data.invoiceNumber}`
                    : `🧾 Invoice ready — ₹${(data.totalAmount ?? 0).toLocaleString('en-IN')} (Invoice #${data.invoiceNumber})`,
                { duration: 6000, icon: isPaid ? '✅' : '🧾', style: toastStyle(isPaid ? 'success' : 'warning') },
            );
            window.dispatchEvent(new CustomEvent('medisense:invoice:new', { detail: data }));
        });

        // Lab report uploaded → patient portal update
        socketInstance.on('lab_report:uploaded', (data) => {
            toast.success(
                `🧪 Lab report ready — ${(data.testType as string)?.replace('_', ' ')}`,
                { duration: 7000, style: toastStyle('success') },
            );
            window.dispatchEvent(new CustomEvent('medisense:lab_report:uploaded', { detail: data }));
        });

        // Consultation completed → patient portal refresh
        socketInstance.on('consultation:completed', (data) => {
            toast.success('✅ Consultation complete. Check your prescriptions & reports.', { duration: 7000, style: toastStyle('success') });
            window.dispatchEvent(new CustomEvent('medisense:consultation:completed', { detail: data }));
        });

        // Appointment events
        socketInstance.on('appointment_request:approved', (data) => {
            toast.success('📅 Appointment approved!', { duration: 6000, style: toastStyle('success') });
            window.dispatchEvent(new CustomEvent('medisense:appointment:approved', { detail: data }));
        });

        socketInstance.on('appointment_request:counter_offer', (data) => {
            toast('📅 New appointment slot offered — accept or decline', { duration: 8000, icon: '📅', style: toastStyle('warning') });
            window.dispatchEvent(new CustomEvent('medisense:appointment:counter_offer', { detail: data }));
        });

        socketInstance.on('appointment_request:new', (data) => {
            toast('📋 New appointment request received', { duration: 5000, icon: '📋', style: toastStyle('info') });
            window.dispatchEvent(new CustomEvent('medisense:appointment:new', { detail: data }));
        });

        // In-app notification
        socketInstance.on('notification:new', (data) => {
            toast(data.message || 'New notification', { duration: 5000, style: toastStyle('info') });
        });

        socketInstance.on('disconnect', () => {
            connected.current = false;
        });

        return () => {
            socketInstance?.disconnect();
            socketInstance = null;
            connected.current = false;
        };
    }, [isAuthenticated, accessToken]);

    const joinPatientRoom = (patientId: string) => {
        socketInstance?.emit('join:patient-room', patientId);
    };

    const leavePatientRoom = (patientId: string) => {
        socketInstance?.emit('leave:patient', patientId);
    };

    return { joinPatientRoom, leavePatientRoom, socket: socketInstance };
}
