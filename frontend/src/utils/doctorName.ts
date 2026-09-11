/**
 * A doctor's display name with exactly one "Dr." prefix.
 *
 * Some records store the title inside firstName ("Dr. Sarah"), so prefixing
 * blindly rendered "Dr. Dr. Sarah" on the doctor dashboard.
 */
export function doctorName(firstName?: string | null, lastName?: string | null): string {
    const first = (firstName || '').replace(/^\s*dr\.?\s+/i, '').trim();
    const full = [first, (lastName || '').trim()].filter(Boolean).join(' ');
    return full ? `Dr. ${full}` : 'Doctor';
}
