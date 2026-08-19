UPDATE users 
SET "passwordHash"='$2a$10$cmKUK9JiP6338/xKtCqwhe45NBXMe7zbCNY6Syma5EL22xvSygR0a'
WHERE email IN ('lab@medisense.ai', 'patient@medisense.ai');

SELECT email, role, "isActive" FROM users ORDER BY "createdAt";
