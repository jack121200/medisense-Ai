import { prisma } from '../../config/database';
import { AppError } from '../../utils/apiResponse';

export const billingService = {

    async list(filters?: { isPaid?: boolean; patientId?: string }) {
        return prisma.invoice.findMany({
            where: {
                ...(filters?.isPaid !== undefined && { isPaid: filters.isPaid }),
                ...(filters?.patientId && { patientId: filters.patientId }),
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async getById(id: string) {
        const inv = await prisma.invoice.findUnique({
            where: { id },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
                items: true,
                consultation: {
                    select: { id: true, diagnosis: true, doctorId: true, symptoms: true },
                },
            },
        });
        if (!inv) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
        return inv;
    },

    async markPaid(id: string, paymentMethod: 'CASH' | 'UPI' | 'CARD') {
        const inv = await prisma.invoice.findUnique({ where: { id } });
        if (!inv) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
        if (inv.isPaid) throw new AppError('Invoice already marked as paid', 400, 'ALREADY_PAID');

        return prisma.invoice.update({
            where: { id },
            data: { isPaid: true, paymentMethod, paidAt: new Date() },
            include: { items: true, patient: { select: { id: true, firstName: true, lastName: true } } },
        });
    },

    async getRevenueToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const result = await prisma.invoice.aggregate({
            where: { isPaid: true, paidAt: { gte: today, lt: tomorrow } },
            _sum: { totalAmount: true },
            _count: true,
        });
        return { revenue: result._sum.totalAmount || 0, paidCount: result._count };
    },
};
