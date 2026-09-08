/**
 * usePatientSync.ts — S2: Realtime sync for patient portal
 * Polls patient data every 10 seconds and returns refreshed state.
 */
import { useState, useEffect, useRef } from 'react';
import api from '../api/axiosInstance';

const POLL_MS = 10_000;

interface SyncState {
    prescriptions: any[];
    bills: any[];
    reports: any[];
    appointments: any[];
    profile: any | null;
    loading: boolean;
    lastUpdated: Date | null;
    isLive: boolean;
}

export function usePatientSync(patientId?: string) {
    const [state, setState] = useState<SyncState>({
        prescriptions: [],
        bills: [],
        reports: [],
        appointments: [],
        profile: null,
        loading: true,
        lastUpdated: null,
        isLive: false,
    });

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetch = async () => {
        try {
            // Uses the shared axios instance — it already attaches the auth
            // token via its request interceptor and handles 401/refresh, so
            // there's no need to read/parse the auth store's localStorage
            // entry manually here.
            const [prescRes, billRes, apptRes, profileRes] = await Promise.allSettled([
                api.get('/patient/my-prescriptions'),
                api.get('/patient/my-bills'),
                api.get('/patient/my-appointments'),
                api.get('/patient/my-profile'),
            ]);

            setState(prev => ({
                ...prev,
                prescriptions: prescRes.status === 'fulfilled' ? (prescRes.value.data.data || []) : prev.prescriptions,
                bills:         billRes.status === 'fulfilled'  ? (billRes.value.data.data || [])  : prev.bills,
                appointments:  apptRes.status === 'fulfilled'  ? (apptRes.value.data.data || [])  : prev.appointments,
                profile:       profileRes.status === 'fulfilled' ? (profileRes.value.data.data || null) : prev.profile,
                loading: false,
                lastUpdated: new Date(),
                isLive: true,
            }));
        } catch (err) {
            setState(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        fetch(); // initial load
        timerRef.current = setInterval(fetch, POLL_MS);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [patientId]);

    return state;
}
