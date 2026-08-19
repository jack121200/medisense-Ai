import { create } from 'zustand';

interface VitalsReading {
    patientId: string;
    heartRate: number;
    oxygenSaturation: number;
    systolicBP: number;
    diastolicBP: number;
    temperature: number;
    timestamp: Date;
    isAnomaly?: boolean;
}

interface VitalsState {
    vitals: Record<string, VitalsReading[]>; // patientId → readings (last 60)
    latestVitals: Record<string, VitalsReading>;
    updateVitals: (reading: VitalsReading) => void;
    setVitalsHistory: (patientId: string, readings: VitalsReading[]) => void;
}

export const useVitalsStore = create<VitalsState>((set) => ({
    vitals: {},
    latestVitals: {},

    updateVitals: (reading) =>
        set((s) => {
            const prev = s.vitals[reading.patientId] || [];
            const updated = [...prev.slice(-59), reading]; // keep last 60
            return {
                vitals: { ...s.vitals, [reading.patientId]: updated },
                latestVitals: { ...s.latestVitals, [reading.patientId]: reading },
            };
        }),

    setVitalsHistory: (patientId, readings) =>
        set((s) => ({
            vitals: { ...s.vitals, [patientId]: readings },
            latestVitals: readings.length
                ? { ...s.latestVitals, [patientId]: readings[readings.length - 1] }
                : s.latestVitals,
        })),
}));
