-- ══════════════════════════════════════════
-- MediSense AI — Doctor Seeding Script
-- Remove all old doctors, seed 3 real ones
-- ══════════════════════════════════════════

-- Step 1: Remove all existing DOCTOR users and their related data
DELETE FROM refresh_tokens WHERE "userId" IN (SELECT id FROM users WHERE role = 'DOCTOR');
DELETE FROM audit_logs WHERE "userId" IN (SELECT id FROM users WHERE role = 'DOCTOR');
DELETE FROM notifications WHERE "userId" IN (SELECT id FROM users WHERE role = 'DOCTOR');
DELETE FROM users WHERE role = 'DOCTOR';

-- Step 2: Seed 3 doctors
-- Password for all: Doctor@123 (bcrypt hash)
INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, specialization, "consultationFee", "licenseNumber", "isActive", "createdAt", "updatedAt")
VALUES
  (
    'doc_sonal_jain_001',
    'dr.sonal@medisense.ai',
    '$2b$10$rBnNTe4tClJJcnX/7VwNrOW7cGnkpbq0g2M7tg6GGNs9GzSvDJpJW',
    'Sonal',
    'Jain',
    'DOCTOR',
    'Cardiologist',
    1500.00,
    'MCI-2001-CAR-4421',
    true,
    NOW(),
    NOW()
  ),
  (
    'doc_mukesh_bhatt_002',
    'dr.mukesh@medisense.ai',
    '$2b$10$rBnNTe4tClJJcnX/7VwNrOW7cGnkpbq0g2M7tg6GGNs9GzSvDJpJW',
    'Mukesh',
    'Bhatt',
    'DOCTOR',
    'Orthopedic',
    2500.00,
    'MCI-2004-ORT-8832',
    true,
    NOW(),
    NOW()
  ),
  (
    'doc_mukun_bipin_003',
    'dr.mukun@medisense.ai',
    '$2b$10$rBnNTe4tClJJcnX/7VwNrOW7cGnkpbq0g2M7tg6GGNs9GzSvDJpJW',
    'Mukun',
    'Bipin',
    'DOCTOR',
    'Pediatric',
    2300.00,
    'MCI-2007-PED-1156',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO UPDATE SET
  "firstName"       = EXCLUDED."firstName",
  "lastName"        = EXCLUDED."lastName",
  specialization    = EXCLUDED.specialization,
  "consultationFee" = EXCLUDED."consultationFee",
  "licenseNumber"   = EXCLUDED."licenseNumber",
  "updatedAt"       = NOW();

-- Verify
SELECT id, email, "firstName", "lastName", specialization, "consultationFee" FROM users WHERE role = 'DOCTOR';
