import { Request } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface AuditLogInput {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    req?: Request;
}

/**
 * Fire-and-forget audit trail write. Never throws into the caller's
 * request path — an audit-log failure shouldn't fail the underlying
 * action, but it is logged so a broken audit trail doesn't go unnoticed.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: input.userId,
                action: input.action,
                resource: input.resource,
                resourceId: input.resourceId,
                details: input.details as any,
                ipAddress: input.req?.ip,
                userAgent: input.req?.header('user-agent'),
            },
        });
    } catch (err) {
        logger.error('Failed to write audit log', err);
    }
}
