import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { authService } from './auth.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';

export const authController = {
    // Patient self-registration (public endpoint)
    registerPatient: asyncHandler(async (req: AuthRequest, res: Response) => {
        const result = await authService.registerPatient(req.body);
        sendCreated(res, result, 'Patient registered successfully');
    }),

    register: asyncHandler(async (req: AuthRequest, res: Response) => {
        const user = await authService.register(req.body);
        sendCreated(res, user, 'User registered successfully');
    }),


    login: asyncHandler(async (req: AuthRequest, res: Response) => {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        sendSuccess(res, result, 'Login successful');
    }),

    refresh: asyncHandler(async (req: AuthRequest, res: Response) => {
        const { refreshToken } = req.body;
        const tokens = await authService.refresh(refreshToken);
        sendSuccess(res, tokens, 'Token refreshed');
    }),

    logout: asyncHandler(async (req: AuthRequest, res: Response) => {
        const { refreshToken } = req.body;
        await authService.logout(refreshToken);
        sendSuccess(res, null, 'Logged out successfully');
    }),

    getMe: asyncHandler(async (req: AuthRequest, res: Response) => {
        const user = await authService.getMe(req.user!.id);
        sendSuccess(res, user);
    }),

    updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
        const user = await authService.updateProfile(req.user!.id, req.body);
        sendSuccess(res, user, 'Profile updated');
    }),

    changePassword: asyncHandler(async (req: AuthRequest, res: Response) => {
        const { currentPassword, newPassword } = req.body;
        await authService.changePassword(req.user!.id, currentPassword, newPassword);
        sendSuccess(res, null, 'Password changed successfully');
    }),
};
