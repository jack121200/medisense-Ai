ALTER TABLE patients ADD COLUMN IF NOT EXISTS "isSeeded" BOOLEAN NOT NULL DEFAULT false;
UPDATE patients SET "isSeeded" = true;
SELECT COUNT(*) as total_marked FROM patients WHERE "isSeeded" = true;
