import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole, requireOwnership } from '../../middleware/rbac.middleware';
import { billingService } from './billing.service';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();
router.use(authenticate);

// Billing is a staff worklist; patients use /patient/my-bills for their own
// invoices, so nothing here needs to allow the PATIENT role.
const STAFF = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTIONIST'] as const;

// List invoices
router.get('/', requireRole(...STAFF), async (req, res, next) => {
    try {
        const isPaid = req.query.isPaid === 'true' ? true : req.query.isPaid === 'false' ? false : undefined;
        sendSuccess(res, await billingService.list({ isPaid, patientId: req.query.patientId as string }));
    } catch (e) { next(e); }
});

// Revenue today (for dashboard)
router.get('/revenue/today', requireRole(...STAFF), async (req, res, next) => {
    try { sendSuccess(res, await billingService.getRevenueToday()); } catch (e) { next(e); }
});

// Get invoice by ID
router.get('/:id', requireOwnership('billing', { allowRoles: [...STAFF] }), async (req, res, next) => {
    try { sendSuccess(res, await billingService.getById(req.params.id)); } catch (e) { next(e); }
});

// Mark as paid
router.patch('/:id/pay', requireRole(...STAFF), async (req, res, next) => {
    try {
        const data = await billingService.markPaid(req.params.id, req.body.paymentMethod);
        sendSuccess(res, data, 'Payment recorded');
    } catch (e) { next(e); }
});

export { router as billingRouter };
