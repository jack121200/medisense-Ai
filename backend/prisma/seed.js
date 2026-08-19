'use strict';
// ============================================================
// MediSense AI — Seed Script (Plain JavaScript / CommonJS)
// Run with: node prisma/seed.js
// ============================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function weightedBool(p) { return Math.random() < p; }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function computeRiskScore(p) {
    const norm = (val, min, max) => clamp((val - min) / (max - min), 0, 1);
    const score = (
        0.15 * norm(p.age, 18, 90) +
        0.12 * norm(p.bmi, 15, 45) +
        0.10 * (p.hasDiabetes ? 1 : 0) +
        0.10 * (p.hasHypertension ? 1 : 0) +
        0.08 * (p.hasHeartDisease ? 1 : 0) +
        0.12 * norm(p.bloodSugarFasting, 70, 400) +
        0.10 * norm(p.bpSystolic, 80, 200) +
        0.08 * (p.smokingStatus === 'CURRENT' ? 1 : 0) +
        0.08 * norm(p.creatinine, 0.4, 10) +
        0.07 * (p.previousAdmissions > 2 ? 1 : p.previousAdmissions / 3)
    ) * 100;
    return clamp(score + (Math.random() - 0.5) * 20, 0, 100);
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
    console.log('🌱 Starting MediSense AI seed...');

    // ── Demo users ──
    const password = await bcrypt.hash('MediSense@2024', 12);
    const users = [
        { email: 'admin@medisense.ai', firstName: 'Admin', lastName: 'User', role: 'ADMIN' },
        { email: 'doctor@medisense.ai', firstName: 'Dr. Sarah', lastName: 'Chen', role: 'DOCTOR' },
        { email: 'nurse@medisense.ai', firstName: 'Nurse Rahul', lastName: 'Sharma', role: 'NURSE' },
        { email: 'analyst@medisense.ai', firstName: 'Dr. Priya', lastName: 'Analytics', role: 'ANALYST' },
    ];
    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: { ...u, passwordHash: password, department: 'General Medicine' },
        });
    }
    console.log('✅ Demo users created');

    // ── Patients ──
    const TOTAL = 5000;
    const BATCH = 50;
    const genders = ['MALE', 'FEMALE', 'OTHER'];
    const bloodGroups = ['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'];
    const smokingStats = ['NEVER', 'FORMER', 'CURRENT'];
    const alcoholUses = ['NEVER', 'OCCASIONAL', 'REGULAR', 'HEAVY'];
    const activityLvls = ['SEDENTARY', 'LOW', 'MODERATE', 'HIGH'];
    const wardTypes = ['GENERAL', 'ICU', 'CARDIAC', 'ORTHOPEDIC', 'ONCOLOGY', 'NEUROLOGY', 'PEDIATRIC', 'MATERNITY'];
    const outcomes = ['RECOVERED', 'STABLE', 'DETERIORATED', 'TRANSFERRED', 'DECEASED'];
    const admReasons = ['Chest Pain', 'Shortness of Breath', 'High Fever', 'Stroke Symptoms',
        'Hypertensive Crisis', 'Diabetic Ketoacidosis', 'Acute Kidney Injury', 'Fracture',
        'Post-Surgery Care', 'Infection', 'Respiratory Distress', 'Cardiac Arrhythmia'];
    const diagnoses = ['Acute MI', 'Pneumonia', 'Type 2 Diabetes', 'Hypertensive Crisis',
        'CKD Stage 3', 'COPD Exacerbation', 'Sepsis', 'Stroke', 'CHF', 'Cellulitis'];
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Barbara',
        'Arun', 'Priya', 'Rajesh', 'Sunita', 'Vikram', 'Meera', 'Arjun', 'Kavita', 'Ravi', 'Anita',
        'Akira', 'Yuki', 'Kenji', 'Sakura', 'Hiroshi', 'Namrata', 'Sanjay', 'Deepa', 'Mohan', 'Lata'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor',
        'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Mehta', 'Shah', 'Joshi', 'Nair',
        'Tanaka', 'Yamamoto', 'Suzuki', 'Watanabe', 'Sato', 'Reddy', 'Rao', 'Bose', 'Das', 'Chatterjee'];

    console.log(`📋 Seeding ${TOTAL} patients in batches of ${BATCH}...`);
    const year = new Date().getFullYear();

    for (let batch = 0; batch < TOTAL / BATCH; batch++) {
        const ops = [];
        for (let i = 0; i < BATCH; i++) {
            const idx = batch * BATCH + i + 1;
            const patientCode = `PAT-${year}-${String(idx).padStart(5, '0')}`;
            const age = Math.round(Math.abs(rand(18, 90) + (Math.random() > 0.5 ? rand(-5, 5) : 0)));
            const bmi = clamp(parseFloat(rand(18, 45).toFixed(1)), 15, 50);
            const gender = pick(genders);
            const smokingStatus = pick(smokingStats);
            const dob = new Date();
            dob.setFullYear(dob.getFullYear() - age);

            const hasDiabetes = weightedBool(0.15 + 0.003 * age + (bmi > 30 ? 0.01 : 0));
            const hasHypertension = weightedBool(0.20 + 0.004 * age);
            const hasHeartDisease = weightedBool(0.10 + 0.002 * age);
            const hasCKD = weightedBool(0.08);
            const hasAsthma = weightedBool(0.06);
            const hasCOPD = weightedBool(0.05);
            const hasObesity = bmi > 30;
            const hasCancer = weightedBool(0.04);

            const bloodSugarFasting = hasDiabetes
                ? clamp(parseFloat(rand(120, 380).toFixed(1)), 70, 400)
                : clamp(parseFloat(rand(70, 110).toFixed(1)), 70, 400);
            const bpSystolic = hasHypertension
                ? clamp(parseFloat(rand(140, 200).toFixed(1)), 80, 220)
                : clamp(parseFloat(rand(100, 130).toFixed(1)), 80, 200);
            const creatinine = hasCKD
                ? clamp(parseFloat(rand(2.0, 9.0).toFixed(2)), 0.4, 10)
                : clamp(parseFloat(rand(0.5, 1.3).toFixed(2)), 0.4, 10);

            const previousAdmissions = randInt(0, 5);
            const riskScore = computeRiskScore({
                age, bmi, gender, hasDiabetes, hasHypertension,
                hasHeartDisease, hasCKD, smokingStatus, bloodSugarFasting, bpSystolic, creatinine, previousAdmissions
            });
            const riskLevel = riskScore >= 70 ? 'CRITICAL' : riskScore >= 55 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW';

            const readmitted = weightedBool(riskLevel === 'CRITICAL' ? 0.35 : riskLevel === 'HIGH' ? 0.20 : riskLevel === 'MEDIUM' ? 0.08 : 0.02);
            const icuAdmitted = weightedBool(riskLevel === 'CRITICAL' ? 0.70 : riskLevel === 'HIGH' ? 0.30 : 0.05);
            const losBase = riskLevel === 'CRITICAL' ? 14 : riskLevel === 'HIGH' ? 7 : riskLevel === 'MEDIUM' ? 4 : 2;
            const lengthOfStay = clamp(randInt(losBase - 2, losBase + 8), 1, 60);

            const admittedAt = new Date();
            admittedAt.setDate(admittedAt.getDate() - randInt(0, 90));
            const discharged = weightedBool(0.7);
            const dischargedAt = discharged ? new Date(admittedAt.getTime() + lengthOfStay * 24 * 3600000) : null;

            const patientCreate = {
                patientCode,
                firstName: pick(firstNames),
                lastName: pick(lastNames),
                dateOfBirth: dob,
                gender,
                bloodGroup: pick(bloodGroups),
                bmi,
                smokingStatus,
                alcoholUse: pick(alcoholUses),
                physicalActivity: pick(activityLvls),
                hasDiabetes, hasHypertension, hasHeartDisease, hasCKD,
                hasAsthma, hasCOPD, hasObesity, hasCancer,
                currentRiskLevel: riskLevel,
                riskScore: parseFloat(riskScore.toFixed(2)),
                phone: `+91${randInt(7000000000, 9999999999)}`,
                admissions: {
                    create: {
                        admissionNumber: `ADM-${year}-${String(idx).padStart(6, '0')}`,
                        wardType: icuAdmitted ? 'ICU' : pick(wardTypes),
                        admittedAt,
                        dischargedAt,
                        lengthOfStay: discharged ? lengthOfStay : null,
                        icuAdmitted,
                        admissionReason: pick(admReasons),
                        diagnosis: pick(diagnoses),
                        treatmentOutcome: discharged ? pick(outcomes) : undefined,
                        readmitted,
                        readmissionWithin30Days: readmitted && weightedBool(0.6),
                        clinicalData: {
                            create: {
                                bloodSugarFasting,
                                bloodSugarPostMeal: bloodSugarFasting + rand(20, 80),
                                hba1c: hasDiabetes ? clamp(rand(7, 13), 4, 15) : clamp(rand(4.5, 6.4), 4, 15),
                                cholesterolTotal: clamp(rand(140, 320), 100, 350),
                                cholesterolLDL: clamp(rand(60, 200), 50, 250),
                                cholesterolHDL: clamp(rand(30, 90), 20, 100),
                                triglycerides: clamp(rand(80, 300), 50, 500),
                                heartRateAvg: clamp(rand(55, 110), 45, 130),
                                bloodPressureSystolic: bpSystolic,
                                bloodPressureDiastolic: clamp(bpSystolic * 0.6 + rand(-5, 5), 50, 120),
                                oxygenSaturation: hasCOPD ? clamp(rand(88, 96), 85, 100) : clamp(rand(95, 100), 85, 100),
                                temperature: clamp(rand(36.1, 38.5), 35.5, 40.5),
                                hemoglobin: clamp(rand(9, 17), 7, 18),
                                creatinine,
                                gfr: hasCKD ? clamp(rand(15, 55), 5, 120) : clamp(rand(60, 120), 5, 120),
                            },
                        },
                    },
                },
            };

            if (riskScore > 60) {
                patientCreate.alerts = {
                    create: [{
                        type: 'RISK_ESCALATION',
                        severity: riskScore > 75 ? 'CRITICAL' : 'WARNING',
                        message: `Patient has ${riskLevel} risk score of ${riskScore.toFixed(1)}`,
                        details: { riskScore, riskLevel },
                    }],
                };
            }

            ops.push(prisma.patient.create({ data: patientCreate }));
        }

        await Promise.all(ops);
        if (batch % 10 === 0) console.log(`  ✓ ${(batch + 1) * BATCH} / ${TOTAL} patients seeded`);
    }
    console.log(`✅ ${TOTAL} patients seeded successfully!`);

    // ── Vitals for recent 100 patients ──
    console.log('📊 Seeding vitals readings...');
    const recentPatients = await prisma.patient.findMany({ take: 100, select: { id: true, currentRiskLevel: true } });
    const vitalsOps = [];
    for (const p of recentPatients) {
        const hi = ['HIGH', 'CRITICAL'].includes(p.currentRiskLevel);
        for (let h = 24 * 7; h >= 0; h -= 0.5) {
            const t = new Date(Date.now() - h * 3600000);
            vitalsOps.push(prisma.vitalsReading.create({
                data: {
                    patientId: p.id,
                    recordedAt: t,
                    heartRate: clamp(parseFloat(rand(hi ? 85 : 60, hi ? 115 : 95).toFixed(1)), 40, 150),
                    oxygenSaturation: clamp(parseFloat(rand(hi ? 90 : 96, 100).toFixed(1)), 80, 100),
                    systolicBP: clamp(parseFloat(rand(hi ? 130 : 105, hi ? 175 : 135).toFixed(1)), 70, 210),
                    diastolicBP: clamp(parseFloat(rand(75, 95).toFixed(1)), 40, 130),
                    temperature: clamp(parseFloat(rand(36.2, hi ? 38.8 : 37.4).toFixed(1)), 34, 41),
                    source: 'SIMULATED',
                },
            }));
        }
    }
    for (let i = 0; i < vitalsOps.length; i += 500) {
        await Promise.all(vitalsOps.slice(i, i + 500));
    }
    console.log(`✅ Vitals seeded for ${recentPatients.length} patients`);

    console.log('\n🎉 Seed complete! Demo credentials:');
    console.log('   admin@medisense.ai     / MediSense@2024  (ADMIN)');
    console.log('   doctor@medisense.ai    / MediSense@2024  (DOCTOR)');
    console.log('   nurse@medisense.ai     / MediSense@2024  (NURSE)');
    console.log('   analyst@medisense.ai   / MediSense@2024  (ANALYST)');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
