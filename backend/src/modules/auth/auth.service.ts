import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../utils/apiResponse';
import { logger } from '../../config/logger';

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

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
        const user = await prisma.user.findUnique({ where: { email, isActive: true } });
        if (!user) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

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
};
