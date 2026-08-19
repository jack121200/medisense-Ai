import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { AppError } from '../../utils/apiResponse';
import { logger } from '../../config/logger';
import { sendPasswordResetEmail } from '../../utils/mailer';

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

// Redis-backed account lockout — layered underneath loginRateLimiter (which
// is per-IP+email) so an attacker spraying login attempts from many IPs
// against one account still gets locked out.
const LOCKOUT_THRESHOLD = 8;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;
const failedLoginKey = (email: string) => `login-fail:${email.toLowerCase()}`;

async function assertNotLockedOut(email: string): Promise<void> {
    const count = await redis.get(failedLoginKey(email));
    if (count && parseInt(count, 10) >= LOCKOUT_THRESHOLD) {
        throw new AppError('Too many failed login attempts. Please try again in 15 minutes.', 429, 'ACCOUNT_LOCKED');
    }
}

async function recordFailedLogin(email: string): Promise<void> {
    const key = failedLoginKey(email);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, LOCKOUT_WINDOW_SECONDS);
}

async function clearFailedLogins(email: string): Promise<void> {
    await redis.del(failedLoginKey(email));
}

// Password reset tokens live in Redis, not Postgres — they're inherently
// short-lived/single-use, so a TTL'd cache entry is a better fit than a
// migration-requiring table. Only the SHA-256 hash of the token is stored,
// same principle as never storing plaintext passwords.
const RESET_TOKEN_TTL_SECONDS = 30 * 60;
const resetTokenKey = (hash: string) => `pwreset:${hash}`;
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

function generateTokens(userId: string, email: string, role: string): TokenPair {
    const accessOpts: SignOptions = { expiresIn: (env.JWT_ACCESS_EXPIRY as SignOptions['expiresIn']) ?? '15m' };
    const refreshOpts: SignOptions = { expiresIn: (env.JWT_REFRESH_EXPIRY as SignOptions['expiresIn']) ?? '7d' };
    const accessToken = jwt.sign({ id: userId, email, role }, env.JWT_ACCESS_SECRET, accessOpts);
    const refreshToken = jwt.sign({ id: userId, jti: uuidv4() }, env.JWT_REFRESH_SECRET, refreshOpts);
    return { accessToken, refreshToken };
}

export const authService = {
    /** Patient self-registration — creates User (PATIENT) + linked Patient record */
    async registerPatient(data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        dateOfBirth: string;
        gender: string;
        phone?: string;
        bloodGroup?: string;
        address?: string;
        city?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
        emergencyContactRel?: string;
        allergies?: string;
        medicalHistory?: string;
        currentMedications?: string;
        smokingStatus?: string;
        alcoholUse?: string;
    }) {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

        const passwordHash = await bcrypt.hash(data.password, 12);

        // Create User with PATIENT role
        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                role: 'PATIENT',
            },
        });

        // Auto-generate patient code
        const count = await prisma.patient.count();
        const patientCode = `MED-${String(count + 1).padStart(5, '0')}`;

        const bloodGroupMap: Record<string, string> = {
            'A+': 'A_POS', 'A-': 'A_NEG', 'B+': 'B_POS', 'B-': 'B_NEG',
            'AB+': 'AB_POS', 'AB-': 'AB_NEG', 'O+': 'O_POS', 'O-': 'O_NEG',
        };

        // Create linked Patient record
        await prisma.patient.create({
            data: {
                userId: user.id,
                patientCode,
                firstName: data.firstName,
                lastName: data.lastName,
                dateOfBirth: new Date(data.dateOfBirth),
                gender: (data.gender?.toUpperCase() as any) || 'OTHER',
                bloodGroup: data.bloodGroup ? (bloodGroupMap[data.bloodGroup] as any) : undefined,
                email: data.email,
                phone: data.phone,
                address: data.address,
                city: data.city,
                emergencyContactName: data.emergencyContactName,
                emergencyContactPhone: data.emergencyContactPhone,
                emergencyContactRel: data.emergencyContactRel,
                allergies: data.allergies,
                medicalHistory: data.medicalHistory,
                currentMedications: data.currentMedications,
                smokingStatus: (data.smokingStatus?.toUpperCase() as any) || 'NEVER',
                alcoholUse: (data.alcoholUse?.toUpperCase() as any) || 'NEVER',
                isSeeded: false,
            },
        });

        logger.info(`New patient registered: ${user.email} → ${patientCode}`);
        const { passwordHash: _, ...safeUser } = user;
        return { ...safeUser, patientCode };
    },

    /** Staff register (admin-created accounts only — not patient self-reg) */
    async register(data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role?: string;
        department?: string;
    }) {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

        const passwordHash = await bcrypt.hash(data.password, 12);
        const resolvedRole = (data.role as any) || 'DOCTOR';
        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                role: resolvedRole,
                department: data.department,
                // All doctors are Cardiologists — set automatically, never from client input
                specialization: resolvedRole === 'DOCTOR' ? 'Cardiologist' : undefined,
            },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, specialization: true, createdAt: true },
        });
        logger.info(`New staff registered: ${user.email}`);
        return user;
    },

    async login(email: string, password: string) {
        await assertNotLockedOut(email);

        const user = await prisma.user.findUnique({ where: { email, isActive: true } });
        if (!user) {
            await recordFailedLogin(email);
            throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            await recordFailedLogin(email);
            throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }

        await clearFailedLogins(email);

        const tokens = generateTokens(user.id, user.email, user.role);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.refreshToken.create({
            data: { token: tokens.refreshToken, userId: user.id, expiresAt },
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        const { passwordHash: _, ...safeUser } = user;
        return { ...tokens, user: safeUser };
    },

    async refresh(refreshToken: string) {
        const stored = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!stored || stored.expiresAt < new Date()) {
            throw new AppError('Invalid or expired refresh token', 401, 'TOKEN_INVALID');
        }

        // A deactivated user must not be able to keep refreshing access
        // tokens for the remaining life of an already-issued refresh token.
        if (!stored.user.isActive) {
            await prisma.refreshToken.delete({ where: { id: stored.id } });
            throw new AppError('Account is deactivated', 401, 'ACCOUNT_INACTIVE');
        }

        try {
            jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
        } catch {
            throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
        }

        await prisma.refreshToken.delete({ where: { id: stored.id } });
        const tokens = generateTokens(stored.user.id, stored.user.email, stored.user.role);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.refreshToken.create({
            data: { token: tokens.refreshToken, userId: stored.userId, expiresAt },
        });
        return tokens;
    },

    async logout(refreshToken: string) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    },

    async getMe(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, email: true, firstName: true, lastName: true,
                role: true, department: true, avatar: true, lastLoginAt: true, createdAt: true,
            },
        });
        if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
        return user;
    },

    async updateProfile(userId: string, data: { firstName?: string; lastName?: string; department?: string; avatar?: string }) {
        return prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, email: true, firstName: true, lastName: true, role: true, department: true, avatar: true },
        });
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) throw new AppError('Current password is incorrect', 400, 'WRONG_PASSWORD');

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
        // Revoke all refresh tokens
        await prisma.refreshToken.deleteMany({ where: { userId } });
    },

    /**
     * Always responds the same way whether or not the email exists, so this
     * endpoint can't be used to enumerate registered accounts. If the user
     * exists, a single-use token (TTL'd in Redis, only its hash stored) is
     * emailed/logged.
     */
    async forgotPassword(email: string): Promise<void> {
        const user = await prisma.user.findUnique({ where: { email, isActive: true } });
        if (!user) return; // don't reveal whether the account exists

        const token = crypto.randomBytes(32).toString('base64url');
        await redis.setex(resetTokenKey(hashToken(token)), RESET_TOKEN_TTL_SECONDS, user.id);

        await sendPasswordResetEmail(user.email, token);
        logger.info(`Password reset requested for ${user.email}`);
    },

    async resetPassword(token: string, newPassword: string): Promise<string> {
        const key = resetTokenKey(hashToken(token));
        const userId = await redis.get(key);
        if (!userId) throw new AppError('Invalid or expired reset token', 400, 'TOKEN_INVALID');

        // Single-use — delete immediately so the same token can't be replayed.
        await redis.del(key);

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
        // A password reset should invalidate every existing session.
        await prisma.refreshToken.deleteMany({ where: { userId } });
        await clearFailedLogins((await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ?? '');

        logger.info(`Password reset completed for user ${userId}`);
        return userId;
    },
};
