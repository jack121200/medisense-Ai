jest.mock('../src/config/env', () => ({
    env: {
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        JWT_ACCESS_EXPIRY: '15m',
        JWT_REFRESH_EXPIRY: '7d',
        FRONTEND_URL: 'http://localhost:3000',
    },
}));

jest.mock('../src/config/database', () => ({
    prisma: {
        user: { findUnique: jest.fn(), update: jest.fn() },
        refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    },
}));

jest.mock('../src/config/redis', () => ({
    redis: { get: jest.fn(), incr: jest.fn(), expire: jest.fn(), del: jest.fn(), setex: jest.fn() },
}));

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn().mockResolvedValue('hashed'),
}));

jest.mock('../src/utils/mailer', () => ({ sendPasswordResetEmail: jest.fn() }));

import { authService } from '../src/modules/auth/auth.service';
import { prisma } from '../src/config/database';
import { redis } from '../src/config/redis';
import bcrypt from 'bcryptjs';
import { AppError } from '../src/utils/apiResponse';

const mockUser = {
    id: 'u1', email: 'doc@medisense.ai', passwordHash: 'hashed', role: 'DOCTOR', isActive: true,
};

describe('authService.login', () => {
    it('rejects login once the account is locked out, without touching the DB', async () => {
        (redis.get as jest.Mock).mockResolvedValueOnce('8'); // at threshold
        await expect(authService.login('doc@medisense.ai', 'whatever')).rejects.toMatchObject({ errorCode: 'ACCOUNT_LOCKED' });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('records a failed attempt and rejects on wrong password', async () => {
        (redis.get as jest.Mock).mockResolvedValueOnce(null); // not locked out
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
        (redis.incr as jest.Mock).mockResolvedValueOnce(1);

        await expect(authService.login('doc@medisense.ai', 'wrong')).rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
        expect(redis.incr).toHaveBeenCalledWith('login-fail:doc@medisense.ai');
    });

    it('clears the failure counter and issues tokens on success', async () => {
        (redis.get as jest.Mock).mockResolvedValueOnce(null);
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
        (prisma.refreshToken.create as jest.Mock).mockResolvedValueOnce({});
        (prisma.user.update as jest.Mock).mockResolvedValueOnce({});

        const result = await authService.login('doc@medisense.ai', 'correct');
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.user.email).toBe(mockUser.email);
        expect(redis.del).toHaveBeenCalledWith('login-fail:doc@medisense.ai');
    });
});

describe('authService.refresh', () => {
    it('rejects and deletes the token when the user has been deactivated', async () => {
        (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValueOnce({
            id: 'rt1',
            expiresAt: new Date(Date.now() + 100000),
            user: { ...mockUser, isActive: false },
        });

        await expect(authService.refresh('some-token')).rejects.toMatchObject({ errorCode: 'ACCOUNT_INACTIVE' });
        expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });
    });
});
