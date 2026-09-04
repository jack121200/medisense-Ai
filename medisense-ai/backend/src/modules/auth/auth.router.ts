import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authRateLimiter, loginRateLimiter, registrationRateLimiter } from '../../middleware/rateLimiter.middleware';
import {
    registerSchema, loginSchema, refreshSchema,
    updateProfileSchema, changePasswordSchema,
    forgotPasswordSchema, resetPasswordSchema,
} from './auth.schema';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user (Admin only in production)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               role: { type: string, enum: [ADMIN, DOCTOR, NURSE, ANALYST] }
 */
// Patient self-registration — public, now rate-limited (previously had none at all)
router.post('/patient-register', registrationRateLimiter, authController.registerPatient);

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);

// Login has its own strict limiter (see rateLimiter.middleware.ts) — the
// general authRateLimiter was far too permissive for the brute-force target.
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', authRateLimiter, validate(refreshSchema), authController.logout);
router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.patch('/me/password', authenticate, validate(changePasswordSchema), authController.changePassword);

router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

export default router;
