import { prisma } from '../../config/database';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { Prisma } from '@prisma/client';

export const alertService = {
    async list(params: { page?: string; limit?: string; severity?: string; type?: string; resolved?: string }) {
        const { page, limit, skip } = getPagination(params.page, params.limit);
        const where: Prisma.AlertWhereInput = {};
        if (params.severity) where.severity = params.severity as any;
        if (params.type) where.type = params.type as any;
        if (params.resolved !== undefined) where.isResolved = params.resolved === 'true';

        const [alerts, total] = await Promise.all([
            prisma.alert.findMany({
                where, skip, take: limit,
                orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
                include: { patient: { select: { firstName: true, lastName: true, patientCode: true } } },
            }),
            prisma.alert.count({ where }),
        ]);
        return { alerts, pagination: buildPaginationMeta(total, page, limit) };
    },

    async getUnreadCount() {
        return prisma.alert.count({ where: { isRead: false, isResolved: false } });
    },

    async markRead(alertId: string) {
        return prisma.alert.update({ where: { id: alertId }, data: { isRead: true } });
    },

    async resolve(alertId: string, resolvedBy: string) {
        return prisma.alert.update({
            where: { id: alertId },
            data: { isResolved: true, resolvedBy, resolvedAt: new Date(), isRead: true },
        });
    },

    async markAllRead() {
        return prisma.alert.updateMany({ where: { isRead: false }, data: { isRead: true } });
    },
};
