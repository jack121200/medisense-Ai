import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

/**
 * GET /api/v1/doctors
 * Returns list of active doctors with their specialization and consultation fee.
 * Public endpoint — no auth required so patients can see doctors before registering.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const doctors = await prisma.user.findMany({
            where: { role: 'DOCTOR', isActive: true },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                specialization: true,
                consultationFee: true,
                licenseNumber: true,
            },
            orderBy: { firstName: 'asc' },
        });

        const formatted = doctors.map(d => ({
            id: d.id,
            name: `Dr. ${d.firstName} ${d.lastName}`,
            firstName: d.firstName,
            lastName: d.lastName,
            specialization: d.specialization || 'General Physician',
            consultationFee: d.consultationFee || 0,
            licenseNumber: d.licenseNumber,
        }));

        sendSuccess(res, formatted);
    } catch (e) { next(e); }
});

export default router;
