-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'ANALYST', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PATIENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "SmokingStatus" AS ENUM ('NEVER', 'FORMER', 'CURRENT');

-- CreateEnum
CREATE TYPE "AlcoholUse" AS ENUM ('NEVER', 'OCCASIONAL', 'REGULAR', 'HEAVY');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WardType" AS ENUM ('GENERAL', 'ICU', 'CARDIAC', 'ORTHOPEDIC', 'ONCOLOGY', 'NEUROLOGY', 'PEDIATRIC', 'MATERNITY');

-- CreateEnum
CREATE TYPE "TreatmentOutcome" AS ENUM ('RECOVERED', 'STABLE', 'DETERIORATED', 'TRANSFERRED', 'DECEASED');

-- CreateEnum
CREATE TYPE "VitalsSource" AS ENUM ('MANUAL', 'DEVICE', 'WEARABLE', 'SIMULATED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('VITALS_ANOMALY', 'RISK_ESCALATION', 'READMISSION_RISK', 'MEDICATION_DUE', 'FOLLOW_UP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('MEDICATION', 'LIFESTYLE', 'DIET', 'FOLLOW_UP', 'SPECIALIST', 'DIAGNOSTIC', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabTestType" AS ENUM ('BLOOD_TEST', 'URINE_TEST', 'XRAY', 'ECG', 'CT_SCAN', 'MRI', 'ULTRASOUND', 'STOOL_TEST', 'CULTURE', 'BIOPSY');

-- CreateEnum
CREATE TYPE "LabTestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'SAMPLE_COLLECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentTimeSlot" AS ENUM ('MORNING', 'NOON', 'NIGHT', 'LATE_NIGHT');

-- CreateEnum
CREATE TYPE "AppointmentReqStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COUNTER_OFFERED', 'PATIENT_ACCEPTED', 'PATIENT_DECLINED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AiCallStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DOCTOR',
    "department" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "specialization" TEXT,
    "consultationFee" DOUBLE PRECISION,
    "licenseNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodGroup" "BloodGroup",
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRel" TEXT,
    "photo" TEXT,
    "bmi" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "smokingStatus" "SmokingStatus" NOT NULL DEFAULT 'NEVER',
    "alcoholUse" "AlcoholUse" NOT NULL DEFAULT 'NEVER',
    "physicalActivity" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
    "allergies" TEXT,
    "medicalHistory" TEXT,
    "currentMedications" TEXT,
    "hasDiabetes" BOOLEAN NOT NULL DEFAULT false,
    "hasHypertension" BOOLEAN NOT NULL DEFAULT false,
    "hasHeartDisease" BOOLEAN NOT NULL DEFAULT false,
    "hasCKD" BOOLEAN NOT NULL DEFAULT false,
    "hasAsthma" BOOLEAN NOT NULL DEFAULT false,
    "hasCOPD" BOOLEAN NOT NULL DEFAULT false,
    "hasObesity" BOOLEAN NOT NULL DEFAULT false,
    "hasCancer" BOOLEAN NOT NULL DEFAULT false,
    "currentRiskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "lengthOfStay" INTEGER,
    "wardType" "WardType" NOT NULL,
    "bedNumber" TEXT,
    "icuAdmitted" BOOLEAN NOT NULL DEFAULT false,
    "admissionReason" TEXT NOT NULL,
    "diagnosis" TEXT,
    "treatmentOutcome" "TreatmentOutcome",
    "readmitted" BOOLEAN NOT NULL DEFAULT false,
    "readmissionWithin30Days" BOOLEAN NOT NULL DEFAULT false,
    "attendingDoctorId" TEXT,
    "dischargeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_snapshots" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "bloodSugarFasting" DOUBLE PRECISION,
    "bloodSugarPostMeal" DOUBLE PRECISION,
    "hba1c" DOUBLE PRECISION,
    "cholesterolTotal" DOUBLE PRECISION,
    "cholesterolLDL" DOUBLE PRECISION,
    "cholesterolHDL" DOUBLE PRECISION,
    "triglycerides" DOUBLE PRECISION,
    "heartRateAvg" DOUBLE PRECISION,
    "bloodPressureSystolic" DOUBLE PRECISION,
    "bloodPressureDiastolic" DOUBLE PRECISION,
    "oxygenSaturation" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "hemoglobin" DOUBLE PRECISION,
    "whiteBloodCellCount" DOUBLE PRECISION,
    "creatinine" DOUBLE PRECISION,
    "gfr" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals_readings" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartRate" DOUBLE PRECISION NOT NULL,
    "oxygenSaturation" DOUBLE PRECISION NOT NULL,
    "systolicBP" DOUBLE PRECISION NOT NULL,
    "diastolicBP" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "respiratoryRate" DOUBLE PRECISION,
    "glucoseLevel" DOUBLE PRECISION,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyType" TEXT,
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "source" "VitalsSource" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "vitals_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_predictions" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "predictedRiskLevel" "RiskLevel" NOT NULL,
    "riskProbabilityHigh" DOUBLE PRECISION NOT NULL,
    "riskProbabilityMedium" DOUBLE PRECISION NOT NULL,
    "riskProbabilityLow" DOUBLE PRECISION NOT NULL,
    "riskConfidence" DOUBLE PRECISION NOT NULL,
    "readmissionRisk" BOOLEAN NOT NULL,
    "readmissionProbability" DOUBLE PRECISION NOT NULL,
    "predictedLengthOfStay" DOUBLE PRECISION NOT NULL,
    "clusterLabel" INTEGER NOT NULL,
    "clusterName" TEXT NOT NULL,
    "shapValues" JSONB NOT NULL,
    "topRiskFactors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_recommendations" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "care_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_items" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "category" "RecommendationCategory" NOT NULL,
    "priority" "Priority" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionableSteps" JSONB NOT NULL,
    "followUpInDays" INTEGER,
    "specialistType" TEXT,

    CONSTRAINT "recommendation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "symptoms" TEXT[],
    "notes" TEXT,
    "diagnosis" TEXT,
    "aiDiseasePred" JSONB,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT,
    "instructions" TEXT,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_requests" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "orderedByDocId" TEXT NOT NULL,
    "testType" "LabTestType" NOT NULL,
    "status" "LabTestStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT DEFAULT 'NORMAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_test_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_results" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "hemoglobin" DOUBLE PRECISION,
    "wbc" DOUBLE PRECISION,
    "platelets" DOUBLE PRECISION,
    "rbc" DOUBLE PRECISION,
    "glucose" DOUBLE PRECISION,
    "cholesterol" DOUBLE PRECISION,
    "creatinine" DOUBLE PRECISION,
    "rawValues" JSONB,
    "fileUrl" TEXT,
    "aiAnalysis" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_requests" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "timeSlot" "AppointmentTimeSlot" NOT NULL,
    "reason" TEXT,
    "status" "AppointmentReqStatus" NOT NULL DEFAULT 'PENDING',
    "counterDate" TIMESTAMP(3),
    "counterSlot" "AppointmentTimeSlot",
    "receptionistNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_reports" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "reportType" TEXT NOT NULL,
    "fileUrl" TEXT,
    "results" JSONB NOT NULL,
    "notes" TEXT,
    "orderedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_doctor_calls" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "vapiCallId" TEXT NOT NULL,
    "durationSecs" INTEGER,
    "transcript" JSONB,
    "summary" TEXT,
    "preCallData" JSONB,
    "doctorSuggestions" JSONB,
    "status" "AiCallStatus" NOT NULL DEFAULT 'COMPLETED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ai_doctor_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patientCode_key" ON "patients"("patientCode");

-- CreateIndex
CREATE UNIQUE INDEX "patients_userId_key" ON "patients"("userId");

-- CreateIndex
CREATE INDEX "patients_currentRiskLevel_idx" ON "patients"("currentRiskLevel");

-- CreateIndex
CREATE INDEX "patients_patientCode_idx" ON "patients"("patientCode");

-- CreateIndex
CREATE INDEX "patients_userId_idx" ON "patients"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_admissionNumber_key" ON "admissions"("admissionNumber");

-- CreateIndex
CREATE INDEX "admissions_patientId_idx" ON "admissions"("patientId");

-- CreateIndex
CREATE INDEX "admissions_admittedAt_idx" ON "admissions"("admittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_snapshots_admissionId_key" ON "clinical_snapshots"("admissionId");

-- CreateIndex
CREATE INDEX "vitals_readings_patientId_recordedAt_idx" ON "vitals_readings"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "ml_predictions_patientId_idx" ON "ml_predictions"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_appointmentId_key" ON "consultations"("appointmentId");

-- CreateIndex
CREATE INDEX "consultations_patientId_idx" ON "consultations"("patientId");

-- CreateIndex
CREATE INDEX "consultations_doctorId_idx" ON "consultations"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_consultationId_key" ON "prescriptions"("consultationId");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_idx" ON "prescriptions"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_requests_testId_key" ON "lab_test_requests"("testId");

-- CreateIndex
CREATE INDEX "lab_test_requests_patientId_idx" ON "lab_test_requests"("patientId");

-- CreateIndex
CREATE INDEX "lab_test_requests_status_idx" ON "lab_test_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_results_requestId_key" ON "lab_test_results"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_consultationId_key" ON "invoices"("consultationId");

-- CreateIndex
CREATE INDEX "invoices_patientId_idx" ON "invoices"("patientId");

-- CreateIndex
CREATE INDEX "invoices_isPaid_idx" ON "invoices"("isPaid");

-- CreateIndex
CREATE INDEX "appointment_requests_patientId_idx" ON "appointment_requests"("patientId");

-- CreateIndex
CREATE INDEX "appointment_requests_doctorId_idx" ON "appointment_requests"("doctorId");

-- CreateIndex
CREATE INDEX "appointment_requests_status_idx" ON "appointment_requests"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "alerts_patientId_createdAt_idx" ON "alerts"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "alerts_isRead_isResolved_idx" ON "alerts"("isRead", "isResolved");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_doctor_calls_vapiCallId_key" ON "ai_doctor_calls"("vapiCallId");

-- CreateIndex
CREATE INDEX "ai_doctor_calls_patientId_startedAt_idx" ON "ai_doctor_calls"("patientId", "startedAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_snapshots" ADD CONSTRAINT "clinical_snapshots_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals_readings" ADD CONSTRAINT "vitals_readings_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_recommendations" ADD CONSTRAINT "care_recommendations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "care_recommendations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_requests" ADD CONSTRAINT "lab_test_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_requests" ADD CONSTRAINT "lab_test_requests_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_results" ADD CONSTRAINT "lab_test_results_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_test_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_doctor_calls" ADD CONSTRAINT "ai_doctor_calls_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

