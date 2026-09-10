/**
 * Trigger a browser download for a blob response.
 *
 * Object URLs leak until revoked, and every PDF download in the app was
 * about to repeat the same create/click/revoke sequence.
 */
export function downloadBlob(data: Blob, filename: string): void {
    const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
