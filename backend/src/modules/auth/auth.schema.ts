import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.enum(['ADMIN', 'DOCTOR', 'NURSE', 'ANALYST', 'RECEPTIONIST', 'LAB_TECHNICIAN']).optional(),
        department: z.string().optional(),
        // Staff / Doctor extra fields
        phone: z.string().optional(),
        dateOfBirth: z.string().optional(),
        gender: z.string().optional(),
        specialization: z.string().optional(),
        licenseNumber: z.string().optional(),
        consultationFee: z.number().optional(),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
    }),
});

export const refreshSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1),
    }),
});

export const updateProfileSchema = z.object({
    body: z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        department: z.string().optional(),
        avatar: z.string().url().optional(),
    }),
});

export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email(),
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8),
    }),
});
