import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useVitalsStore } from '../store/vitalsStore';
import { useAlertStore } from '../store/alertStore';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance: Socket | null = null;

export function useSocket() {
    const { accessToken, isAuthenticated, user } = useAuthStore();
    const { updateVitals } = useVitalsStore();
    const { addAlert } = useAlertStore();
    const connected = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !accessToken || connected.current) return;

        socketInstance = io(SOCKET_URL, {
            auth: { token: accessToken },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        socketInstance.on('connect', () => {
            connected.current = true;
            console.log('🔌 Socket.IO connected:', socketInstance?.id);

            // Join user-specific room for targeted notifications
            if ((user as any)?.id) {
                socketInstance?.emit('join:user-room', (user as any).id);
            }
            // Join role room for broadcast events
            if (user?.role) {
                socketInstance?.emit('join:role-room', user.role);
            }
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

        // ── Alerts ─────────────────────────────────────────────────────────
        socketInstance.on('alert:new', (data) => {
            addAlert({
                id: data.alertId || crypto.randomUUID(),
                patientId: data.patientId,
                patientName: data.patientName,
                type: data.type,
                severity: data.severity,
                message: data.message,
                timestamp: new Date(data.timestamp),
                isRead: false,
                isResolved: false,
            });

            const prefix = data.severity === 'CRITICAL' ? '🚨' : data.severity === 'WARNING' ? '⚠️' : 'ℹ️';
            const name = data.patientName ? `${data.patientName}: ` : '';
            const label = `${prefix} [${data.severity}] ${name}${data.message}`;

            if (data.severity === 'CRITICAL' || data.severity === 'EMERGENCY') {
                toast.error(label, {
                    duration: 8000,
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #FF2D55', fontSize: '13px' },
                });
            } else if (data.severity === 'WARNING') {
                toast(label, {
                    duration: 5000,
                    icon: '⚠️',
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #FFD166', fontSize: '13px' },
                });
            } else {
                toast(label, {
                    duration: 4000,
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #00B4D8', fontSize: '13px' },
                });
            }
        });

        // ── Risk escalation ─────────────────────────────────────────────────
        socketInstance.on('risk:escalated', (data) => {
            toast.error(
                `⚠️ ${data.patientName}: Risk escalated ${data.previousRisk} → ${data.newRisk}`,
                {
                    duration: 10000,
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #FF2D55' },
                }
            );
        });

        // ── REAL-TIME PATIENT PORTAL EVENTS ────────────────────────────────

        // New prescription written by doctor → patient portal update
        socketInstance.on('prescription:new', (data) => {
            toast.success(
                `💊 New prescription ready (${data.itemCount} medication${data.itemCount > 1 ? 's' : ''})`,
                {
                    duration: 7000,
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #06D6A0', fontSize: '13px' },
                }
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
                {
                    duration: 6000,
                    icon: isPaid ? '✅' : '🧾',
                    style: {
                        background: '#1A2340', color: '#F0F4FF',
                        border: `1px solid ${isPaid ? '#06D6A0' : '#FFD166'}`, fontSize: '13px',
                    },
                }
            );
            window.dispatchEvent(new CustomEvent('medisense:invoice:new', { detail: data }));
        });

        // Lab report uploaded → patient portal update
        socketInstance.on('lab_report:uploaded', (data) => {
            toast.success(
                `🧪 Lab report ready — ${(data.testType as string)?.replace('_', ' ')}`,
                {
                    duration: 7000,
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #06D6A0', fontSize: '13px' },
                }
            );
            window.dispatchEvent(new CustomEvent('medisense:lab_report:uploaded', { detail: data }));
        });

        // Consultation completed → patient portal refresh
        socketInstance.on('consultation:completed', (data) => {
            toast.success(
                `✅ Consultation complete. Check your prescriptions & reports.`,
                {
                    duration: 7000,
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #06D6A0', fontSize: '13px' },
                }
            );
            window.dispatchEvent(new CustomEvent('medisense:consultation:completed', { detail: data }));
        });

        // Appointment events
        socketInstance.on('appointment_request:approved', (data) => {
            toast.success('📅 Appointment approved!', {
                duration: 6000,
                style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #06D6A0', fontSize: '13px' },
            });
            window.dispatchEvent(new CustomEvent('medisense:appointment:approved', { detail: data }));
        });

        socketInstance.on('appointment_request:counter_offer', (data) => {
            toast('📅 New appointment slot offered — accept or decline', {
                duration: 8000,
                icon: '📅',
                style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #FFD166', fontSize: '13px' },
            });
            window.dispatchEvent(new CustomEvent('medisense:appointment:counter_offer', { detail: data }));
        });

        socketInstance.on('appointment_request:new', (data) => {
            toast('📋 New appointment request received', {
                duration: 5000,
                icon: '📋',
                style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #C77DFF', fontSize: '13px' },
            });
            window.dispatchEvent(new CustomEvent('medisense:appointment:new', { detail: data }));
        });

        // In-app notification
        socketInstance.on('notification:new', (data) => {
            toast(data.message || 'New notification', {
                duration: 5000,
                style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #00B4D8', fontSize: '13px' },
            });
        });

        socketInstance.on('disconnect', () => {
            connected.current = false;
            console.log('🔌 Socket.IO disconnected');
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
