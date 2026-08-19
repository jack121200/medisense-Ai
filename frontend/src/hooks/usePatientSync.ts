/**
 * usePatientSync.ts — S2: Realtime sync for patient portal
 * Polls patient data every 10 seconds and returns refreshed state.
 */
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = '/api/v1';
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
            const headers = (() => {
                try {
                    // Zustand persist name is 'medisense-auth', token field is 'accessToken'
                    const raw = localStorage.getItem('medisense-auth');
                    const parsed = raw ? JSON.parse(raw) : null;
                    const token = parsed?.state?.accessToken;
                    return token ? { Authorization: `Bearer ${token}` } : {};
                } catch { return {}; }
            })();

            const [prescRes, billRes, apptRes, profileRes] = await Promise.allSettled([
                axios.get(`${API}/patient/my-prescriptions`, { headers }),
                axios.get(`${API}/patient/my-bills`, { headers }),
                axios.get(`${API}/patient/my-appointments`, { headers }),
                axios.get(`${API}/patient/my-profile`, { headers }),
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
