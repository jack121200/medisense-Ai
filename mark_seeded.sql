-- Mark all currently-existing patients as seeded (ML training data only)
-- This hides the 5001 existing patients from the application UI
UPDATE patients SET "isSeeded" = true;

-- Verify
SELECT "isSeeded", COUNT(*) FROM patients GROUP BY "isSeeded";
