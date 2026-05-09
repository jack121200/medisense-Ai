-- Seed lab technician and patient demo users
-- bcrypt hash for 'MediSense@2024' (cost 10)
INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
VALUES 
  (
    'demo-lab-tech-001',
    'lab@medisense.ai',
    '$2b$10$Kq9gGq1Kq9gGq1Kq9gGq1eeM8Hbz/eK3VtrPLY2zVAl0fHbWaqSS',
    'Lab',
    'Technician',
    'LAB_TECHNICIAN',
    true,
    NOW(),
    NOW()
  ),
  (
    'demo-patient-001',
    'patient@medisense.ai',
    '$2b$10$Kq9gGq1Kq9gGq1Kq9gGq1eeM8Hbz/eK3VtrPLY2zVAl0fHbWaqSS',
    'Patient',
    'Demo',
    'PATIENT',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (email) DO UPDATE
  SET role = EXCLUDED.role,
      "isActive" = true,
      "updatedAt" = NOW();
