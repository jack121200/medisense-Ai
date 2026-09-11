import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { patientService } from './patient.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';

export const patientController = {
    list: asyncHandler(async (req: AuthRequest, res: Response) => {
        const { patients, pagination } = await patientService.list(req.query as any);
        sendSuccess(res, patients, 'Patients retrieved', 200, pagination);
    }),

    create: asyncHandler(async (req: AuthRequest, res: Response) => {
        const patient = await patientService.create(req.body);
        sendCreated(res, patient, 'Patient created successfully');
    }),

    getById: asyncHandler(async (req: AuthRequest, res: Response) => {
        const patient = await patientService.getById(req.params.id);
        sendSuccess(res, patient);
    }),

    update: asyncHandler(async (req: AuthRequest, res: Response) => {
        // Demographics and medical profile only. patientCode, the ML-set risk
        // level and score, the portal account link (userId) and the seed and
        // active flags each have their own code path; passing the body
        // straight to Prisma let a caller overwrite any of them.
        const editable = [
            'firstName', 'lastName', 'dateOfBirth', 'gender', 'bloodGroup', 'email', 'phone', 'address', 'city',
            'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRel', 'photo',
            'bmi', 'height', 'weight', 'smokingStatus', 'alcoholUse', 'physicalActivity',
            'allergies', 'medicalHistory', 'currentMedications',
            'hasDiabetes', 'hasHypertension', 'hasHeartDisease', 'hasCKD', 'hasAsthma', 'hasCOPD', 'hasObesity', 'hasCancer',
        ];
        const data = Object.fromEntries(Object.entries(req.body ?? {}).filter(([key]) => editable.includes(key)));
        const patient = await patientService.update(req.params.id, data);
        sendSuccess(res, patient, 'Patient updated');
    }),

    softDelete: asyncHandler(async (req: AuthRequest, res: Response) => {
        await patientService.softDelete(req.params.id);
        sendSuccess(res, null, 'Patient deactivated');
    }),

    getAdmissions: asyncHandler(async (req: AuthRequest, res: Response) => {
        const admissions = await patientService.getAdmissions(req.params.id);
        sendSuccess(res, admissions);
    }),

    createAdmission: asyncHandler(async (req: AuthRequest, res: Response) => {
        const admission = await patientService.createAdmission(req.params.id, req.body);
        sendCreated(res, admission, 'Admission created');
    }),

    getVitals: asyncHandler(async (req: AuthRequest, res: Response) => {
        const vitals = await patientService.getVitalsHistory(req.params.id, req.query.range as string);
        sendSuccess(res, vitals);
    }),

    getTimeline: asyncHandler(async (req: AuthRequest, res: Response) => {
        const timeline = await patientService.getTimeline(req.params.id);
        sendSuccess(res, timeline);
    }),

    getHighRisk: asyncHandler(async (_req: AuthRequest, res: Response) => {
        const patients = await patientService.getHighRisk();
        sendSuccess(res, patients);
    }),
};
