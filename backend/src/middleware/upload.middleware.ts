import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

export const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
export const LAB_REPORTS_DIR = path.join(UPLOAD_ROOT, 'lab-reports');
fs.mkdirSync(LAB_REPORTS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LAB_REPORTS_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.pdf';
        // Unpredictable filename — this is now only an internal disk key;
        // files are served exclusively through the authenticated
        // GET /lab/reports/:id/file route, never as a static/guessable URL.
        cb(null, `${crypto.randomUUID()}${ext}`);
    },
});

export const uploadLabPdf = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    },
});
