/**
 * Where each role lands after login, and where it is sent when it opens a
 * page it may not use. Each home must be a route that role is allowed on,
 * or the redirect would bounce straight back to itself.
 */
export function roleHome(role?: string | null): string {
    switch (role) {
        case 'PATIENT': return '/patient-portal';
        case 'DOCTOR': return '/doctor-dashboard';
        case 'LAB_TECHNICIAN': return '/lab-dashboard';
        default: return '/dashboard';
    }
}
