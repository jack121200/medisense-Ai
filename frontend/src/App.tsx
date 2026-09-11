import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppLayout from './layouts/AppLayout';
import { roleHome } from './utils/roleHome';

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

// Who may open each page. Each group mirrors the backend rule for that page's
// data, so no role is shown a page whose every request comes back 403.
const STAFF = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'ANALYST'];
const HOSPITAL_DASHBOARD = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'ANALYST'];
const PATIENT_MANAGE = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'];
const SCHEDULING = ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'DOCTOR'];
const BILLING = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTIONIST'];
const ADMINS = ['ADMIN', 'SUPER_ADMIN'];
const CLINICAL_CARE = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'];
const RESEARCH = ['DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'ANALYST'];
const LAB = ['LAB_TECHNICIAN', 'ADMIN', 'SUPER_ADMIN'];

// Role-based route guard. An unauthorised role goes to its own home page, not
// a fixed one: a fixed /dashboard sent patients to a staff page they could
// not load.
function RoleRoute({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
    const { user } = useAuthStore();
    if (!user) return <Navigate to="/login" replace />;
    if (!allowed.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
    return <>{children}</>;
}

const guard = (allowed: string[], page: React.ReactNode) => <RoleRoute allowed={allowed}>{page}</RoleRoute>;

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
                    <Route path="/dashboard" element={guard(HOSPITAL_DASHBOARD, <DashboardPage />)} />
                    <Route path="/patients" element={guard(STAFF, <PatientsPage />)} />
                    <Route path="/patients/new" element={guard(PATIENT_MANAGE, <AddPatientPage />)} />
                    <Route path="/patients/:id" element={guard(STAFF, <PatientDetailPage />)} />
                    {/* Unified appointments page — replaces old /appointment-requests */}
                    <Route path="/appointments" element={guard(SCHEDULING, <AppointmentsPage />)} />
                    <Route path="/appointment-requests" element={<Navigate to="/appointments" replace />} />
                    <Route path="/billing" element={guard(BILLING, <BillingPage />)} />
                    <Route path="/users" element={guard(ADMINS, <UsersPage />)} />
                    <Route path="/settings" element={<SettingsPage />} />

                    {/* Doctor */}
                    <Route path="/doctor-dashboard" element={guard(['DOCTOR'], <DoctorDashboardPage />)} />
                    <Route path="/my-patients" element={guard(['DOCTOR'], <DoctorPatientsPage />)} />
                    <Route path="/my-patients/:id" element={guard(['DOCTOR'], <DoctorPatientDetail />)} />
                    <Route path="/consultation/:id" element={guard(CLINICAL_CARE, <ConsultationPage />)} />
                    {/* AI tools — the page itself narrows which tools a patient sees */}
                    <Route path="/ml-predictions" element={guard(['DOCTOR', 'PATIENT', 'ADMIN', 'SUPER_ADMIN'], <MLPredictionsPage />)} />
                    <Route path="/report-analyzer" element={guard(['DOCTOR', 'ADMIN', 'SUPER_ADMIN'], <ReportAnalyzerPage />)} />
                    <Route path="/research-analytics" element={guard(RESEARCH, <ResearchAnalyticsPage />)} />
                    <Route path="/vitals" element={guard(CLINICAL_CARE, <VitalsMonitorPage />)} />
                    <Route path="/analytics" element={guard(HOSPITAL_DASHBOARD, <AnalyticsPage />)} />
                    <Route path="/alerts" element={guard(STAFF, <AlertsPage />)} />

                    {/* Lab Technician */}
                    <Route path="/lab-dashboard" element={guard(LAB, <LabTechDashboardPage />)} />

                    {/* Patient */}
                    <Route path="/patient-portal" element={guard(['PATIENT'], <PatientPortalPage />)} />
                    <Route path="/ai-doctor" element={guard(['PATIENT'], <AiDoctorPage />)} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}
