import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppLayout from './layouts/AppLayout';

// Pages — lazy loaded
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage'));
const AddPatientPage = lazy(() => import('./pages/AddPatientPage'));
const VitalsMonitorPage = lazy(() => import('./pages/VitalsMonitorPage'));
const MLPredictionsPage = lazy(() => import('./pages/MLPredictionsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const ReportAnalyzerPage = lazy(() => import('./pages/ReportAnalyzerPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DoctorDashboardPage = lazy(() => import('./pages/DoctorDashboardPage'));
const ConsultationPage = lazy(() => import('./pages/ConsultationPage'));
const LabTechDashboardPage = lazy(() => import('./pages/LabTechDashboardPage'));
const PatientPortalPage = lazy(() => import('./pages/PatientPortalPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DoctorPatientsPage = lazy(() => import('./pages/DoctorPatientsPage'));
const DoctorPatientDetail = lazy(() => import('./pages/DoctorPatientDetail'));
const ResearchAnalyticsPage = lazy(() => import('./pages/ResearchAnalyticsPage'));
const AiDoctorPage = lazy(() => import('./pages/AiDoctorPage'));

const PageLoader = () => (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
            <div className="pulse-critical mb-4 inline-flex w-12 h-12 rounded-full"
                style={{ background: 'var(--accent-primary)', opacity: 0.9 }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading MediSense AI...</div>
        </div>
    </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

// Role-based route guard — redirects unauthorised roles to dashboard
function RoleRoute({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
    const { user } = useAuthStore();
    if (!user || !allowed.includes(user.role)) return <Navigate to="/dashboard" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route
                    element={
                        <ProtectedRoute>
                            <AppLayout />
                        </ProtectedRoute>
                    }
                >
                    {/* No `index` route here: a pathless parent's index child
                        also matches "/", which outranked the public landing
                        page and bounced every logged-out visitor to /login. */}

                    {/* Shared / Receptionist */}
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/patients" element={<PatientsPage />} />
                    <Route path="/patients/new" element={<AddPatientPage />} />
                    <Route path="/patients/:id" element={<PatientDetailPage />} />
                    {/* Unified appointments page — replaces old /appointment-requests */}
                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/appointment-requests" element={<Navigate to="/appointments" replace />} />
                    <Route path="/billing" element={<BillingPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/settings" element={<SettingsPage />} />

                    {/* Doctor */}
                    <Route path="/doctor-dashboard" element={<DoctorDashboardPage />} />
                    <Route path="/my-patients" element={<DoctorPatientsPage />} />
                    <Route path="/my-patients/:id" element={<DoctorPatientDetail />} />
                    <Route path="/consultation/:id" element={<ConsultationPage />} />
                    {/* ML features — Doctor and Patient ONLY */}
                    <Route path="/ml-predictions" element={
                        <RoleRoute allowed={['DOCTOR', 'PATIENT', 'ADMIN', 'SUPER_ADMIN']}>
                            <MLPredictionsPage />
                        </RoleRoute>
                    } />
                    <Route path="/report-analyzer" element={
                        <RoleRoute allowed={['DOCTOR', 'ADMIN', 'SUPER_ADMIN']}>
                            <ReportAnalyzerPage />
                        </RoleRoute>
                    } />
                    {/* Research & Analytics — Doctor ONLY */}
                    <Route path="/research-analytics" element={
                        <RoleRoute allowed={['DOCTOR', 'ADMIN', 'SUPER_ADMIN']}>
                            <ResearchAnalyticsPage />
                        </RoleRoute>
                    } />
                    <Route path="/vitals" element={<VitalsMonitorPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />

                    {/* Lab Technician */}
                    <Route path="/lab-dashboard" element={<LabTechDashboardPage />} />

                    {/* Patient Portal */}
                    <Route path="/patient-portal" element={<PatientPortalPage />} />

                    {/* AI Doctor — PATIENT only */}
                    <Route path="/ai-doctor" element={
                        <RoleRoute allowed={['PATIENT']}>
                            <AiDoctorPage />
                        </RoleRoute>
                    } />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

