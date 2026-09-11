import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        // No administrator roles: those are granted only by a super admin
        // through /users, which enforces that rule.
        role: z.enum(['DOCTOR', 'NURSE', 'ANALYST', 'RECEPTIONIST', 'LAB_TECHNICIAN']).optional(),
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

// Patient self-registration. The route had no validation at all: a malformed
// date of birth reached Prisma as an Invalid Date. Enum values match the
// Prisma enums; blood group arrives as "A+" and is mapped server-side.
export const patientRegisterSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        firstName: z.string().trim().min(1),
        lastName: z.string().trim().min(1),
        dateOfBirth: z.string().refine(
            v => !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date(),
            'Enter a valid date of birth',
        ),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
        allergies: z.string().optional(),
        medicalHistory: z.string().optional(),
        currentMedications: z.string().optional(),
        smokingStatus: z.enum(['NEVER', 'FORMER', 'CURRENT']).optional(),
        alcoholUse: z.enum(['NEVER', 'OCCASIONAL', 'REGULAR', 'HEAVY']).optional(),
        hasDiabetes: z.boolean().optional(),
        hasHypertension: z.boolean().optional(),
        hasHeartDisease: z.boolean().optional(),
        hasCKD: z.boolean().optional(),
        hasAsthma: z.boolean().optional(),
        hasCOPD: z.boolean().optional(),
        hasObesity: z.boolean().optional(),
        emergencyContactName: z.string().optional(),
        emergencyContactPhone: z.string().optional(),
        emergencyContactRel: z.string().optional(),
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
