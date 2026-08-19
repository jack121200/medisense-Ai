import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587,
            secure: false,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
    }
    return transporter;
}

/**
 * Sends the password reset link by email when SMTP is configured. In
 * environments without SMTP set up (local/dev), logs the link instead so
 * the flow is still testable end-to-end without a mail server.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    const tx = getTransporter();

    if (!tx) {
        logger.warn(`SMTP not configured — password reset link for ${email}: ${resetUrl}`);
        return;
    }

    await tx.sendMail({
        from: env.SMTP_USER,
        to: email,
        subject: 'Reset your MediSense AI password',
        text: `Reset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can ignore this email.`,
        html: `<p>Click below to reset your MediSense AI password. This link expires in 30 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });
}
