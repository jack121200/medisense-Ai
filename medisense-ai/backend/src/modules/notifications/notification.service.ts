import { prisma } from '../../config/database';
import { emitNotification } from '../../config/socket';

export const notificationService = {
    async create(userId: string, title: string, message: string, type = 'INFO', metadata?: object) {
        const notif = await prisma.notification.create({
            data: { userId, title, message, type, metadata: metadata as any },
        });
        // Push real-time
        emitNotification(userId, { id: notif.id, title, message, type, metadata, createdAt: notif.createdAt });
        return notif;
    },

    async listForUser(userId: string) {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    },

    async markRead(id: string, userId: string) {
        return prisma.notification.updateMany({
            where: { id, userId },
            data: { isRead: true },
        });
    },

    async markAllRead(userId: string) {
        return prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    },

    async getUnreadCount(userId: string) {
        return prisma.notification.count({ where: { userId, isRead: false } });
    },
};
