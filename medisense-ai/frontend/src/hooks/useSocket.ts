import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useVitalsStore } from '../store/vitalsStore';
import { useAlertStore } from '../store/alertStore';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance: Socket | null = null;

export function useSocket() {
    const { accessToken, isAuthenticated } = useAuthStore();
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
        });

        // Real-time vitals
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

        // New alert — plain string toast (no JSX needed in .ts file)
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

        // Risk escalation
        socketInstance.on('risk:escalation', (data) => {
            toast.error(
                `⚠️ ${data.patientName}: Risk escalated ${data.previousRisk} → ${data.newRisk}`,
                {
                    duration: 10000,
                    style: { background: '#1A2340', color: '#F0F4FF', border: '1px solid #FF2D55' },
                }
            );
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
        socketInstance?.emit('join:patient', patientId);
    };

    const leavePatientRoom = (patientId: string) => {
        socketInstance?.emit('leave:patient', patientId);
    };

    return { joinPatientRoom, leavePatientRoom, socket: socketInstance };
}
