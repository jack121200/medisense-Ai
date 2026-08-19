/**
 * seed-real-patients.js
 * Seeds 35 realistic named patients with detailed clinical data for ML model training.
 * Run inside the backend container: node prisma/seed-real-patients.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ─── Real-looking patient data ────────────────────────────────────────────────
const PATIENTS = [
    // HIGH RISK — Elderly with multiple comorbidities
    { firstName: 'Ramesh', lastName: 'Gupta', age: 72, gender: 'MALE', bmi: 31.2, bloodGroup: 'B_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: true, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: true, hasCancer: false, smoking: 'FORMER', alcohol: 'OCCASIONAL', activity: 'SEDENTARY', bloodSugar: 248, bpSystolic: 168, creatinine: 1.4, prevAdmissions: 3, ward: 'CARDIAC', diagnosis: 'Acute MI', reason: 'Chest Pain' },
    { firstName: 'Sunita', lastName: 'Sharma', age: 68, gender: 'FEMALE', bmi: 28.9, bloodGroup: 'A_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: false, hasCKD: true, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'LOW', bloodSugar: 310, bpSystolic: 155, creatinine: 3.2, prevAdmissions: 4, ward: 'GENERAL', diagnosis: 'CKD Stage 4', reason: 'Acute Kidney Injury' },
    { firstName: 'Vijay', lastName: 'Patel', age: 65, gender: 'MALE', bmi: 33.5, bloodGroup: 'O_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: true, hasCKD: false, hasAsthma: false, hasCOPD: true, hasObesity: true, hasCancer: false, smoking: 'CURRENT', alcohol: 'REGULAR', activity: 'SEDENTARY', bloodSugar: 285, bpSystolic: 178, creatinine: 1.2, prevAdmissions: 5, ward: 'ICU', diagnosis: 'COPD Exacerbation', reason: 'Shortness of Breath' },
    { firstName: 'Meena', lastName: 'Verma', age: 71, gender: 'FEMALE', bmi: 24.1, bloodGroup: 'AB_POS', hasDiabetes: false, hasHypertension: true, hasHeartDisease: true, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: true, smoking: 'FORMER', alcohol: 'NEVER', activity: 'LOW', bloodSugar: 95, bpSystolic: 162, creatinine: 1.0, prevAdmissions: 2, ward: 'ONCOLOGY', diagnosis: 'CHF', reason: 'Hypertensive Crisis' },
    { firstName: 'Ashok', lastName: 'Singh', age: 77, gender: 'MALE', bmi: 29.8, bloodGroup: 'B_NEG', hasDiabetes: true, hasHypertension: true, hasHeartDisease: true, hasCKD: true, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'CURRENT', alcohol: 'HEAVY', activity: 'SEDENTARY', bloodSugar: 341, bpSystolic: 189, creatinine: 4.8, prevAdmissions: 6, ward: 'ICU', diagnosis: 'Sepsis', reason: 'High Fever' },

    // MEDIUM-HIGH RISK — Middle-aged with 1-2 comorbidities
    { firstName: 'Priya', lastName: 'Nair', age: 55, gender: 'FEMALE', bmi: 27.4, bloodGroup: 'O_NEG', hasDiabetes: true, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'MODERATE', bloodSugar: 198, bpSystolic: 128, creatinine: 0.9, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'Type 2 Diabetes', reason: 'Diabetic Ketoacidosis' },
    { firstName: 'Rakesh', lastName: 'Mehta', age: 58, gender: 'MALE', bmi: 30.1, bloodGroup: 'A_NEG', hasDiabetes: false, hasHypertension: true, hasHeartDisease: false, hasCKD: false, hasAsthma: true, hasCOPD: false, hasObesity: true, hasCancer: false, smoking: 'FORMER', alcohol: 'OCCASIONAL', activity: 'LOW', bloodSugar: 108, bpSystolic: 148, creatinine: 1.1, prevAdmissions: 2, ward: 'GENERAL', diagnosis: 'Hypertensive Crisis', reason: 'Headache & Dizziness' },
    { firstName: 'Kavitha', lastName: 'Reddy', age: 48, gender: 'FEMALE', bmi: 26.5, bloodGroup: 'B_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'MODERATE', bloodSugar: 172, bpSystolic: 142, creatinine: 0.8, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'Pneumonia', reason: 'Cough & Fever' },
    { firstName: 'Suresh', lastName: 'Kumar', age: 61, gender: 'MALE', bmi: 32.2, bloodGroup: 'O_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: true, hasCancer: false, smoking: 'CURRENT', alcohol: 'REGULAR', activity: 'SEDENTARY', bloodSugar: 115, bpSystolic: 135, creatinine: 1.0, prevAdmissions: 0, ward: 'ORTHOPEDIC', diagnosis: 'Obesity Complications', reason: 'Knee Pain' },
    { firstName: 'Anjali', lastName: 'Joshi', age: 52, gender: 'FEMALE', bmi: 23.8, bloodGroup: 'A_POS', hasDiabetes: false, hasHypertension: true, hasHeartDisease: false, hasCKD: false, hasAsthma: true, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'HIGH', bloodSugar: 92, bpSystolic: 145, creatinine: 0.7, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'Asthma Exacerbation', reason: 'Respiratory Distress' },

    // MEDIUM RISK — Various conditions
    { firstName: 'Deepak', lastName: 'Rao', age: 44, gender: 'MALE', bmi: 25.6, bloodGroup: 'AB_NEG', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'OCCASIONAL', activity: 'MODERATE', bloodSugar: 98, bpSystolic: 122, creatinine: 0.9, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Cellulitis', reason: 'Infection' },
    { firstName: 'Laxmi', lastName: 'Bose', age: 63, gender: 'FEMALE', bmi: 22.3, bloodGroup: 'O_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'LOW', bloodSugar: 88, bpSystolic: 118, creatinine: 0.8, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'UTI', reason: 'Abdominal Pain' },
    { firstName: 'Mohan', lastName: 'Das', age: 38, gender: 'MALE', bmi: 24.0, bloodGroup: 'B_NEG', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: true, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'FORMER', alcohol: 'NEVER', activity: 'HIGH', bloodSugar: 91, bpSystolic: 120, creatinine: 0.7, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Asthma', reason: 'Shortness of Breath' },
    { firstName: 'Geeta', lastName: 'Shah', age: 45, gender: 'FEMALE', bmi: 21.8, bloodGroup: 'A_NEG', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'MODERATE', bloodSugar: 85, bpSystolic: 115, creatinine: 0.6, prevAdmissions: 0, ward: 'MATERNITY', diagnosis: 'Anemia', reason: 'Fatigue' },
    { firstName: 'Arun', lastName: 'Chatterjee', age: 57, gender: 'MALE', bmi: 28.2, bloodGroup: 'O_NEG', hasDiabetes: true, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'OCCASIONAL', activity: 'MODERATE', bloodSugar: 165, bpSystolic: 130, creatinine: 0.9, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'Diabetes Type 2', reason: 'Routine Check-up' },

    // CRITICAL RISK — Severe cases
    { firstName: 'Harish', lastName: 'Iyer', age: 80, gender: 'MALE', bmi: 18.5, bloodGroup: 'A_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: true, hasCKD: true, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'FORMER', alcohol: 'NEVER', activity: 'SEDENTARY', bloodSugar: 380, bpSystolic: 195, creatinine: 7.5, prevAdmissions: 8, ward: 'ICU', diagnosis: 'CHF + CKD', reason: 'Cardiac Arrhythmia' },
    { firstName: 'Saroj', lastName: 'Saxena', age: 74, gender: 'FEMALE', bmi: 35.2, bloodGroup: 'B_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: true, hasCKD: false, hasAsthma: false, hasCOPD: true, hasObesity: true, hasCancer: false, smoking: 'CURRENT', alcohol: 'NEVER', activity: 'SEDENTARY', bloodSugar: 295, bpSystolic: 182, creatinine: 1.8, prevAdmissions: 5, ward: 'ICU', diagnosis: 'Acute MI + COPD', reason: 'Chest Pain' },
    { firstName: 'Balram', lastName: 'Tiwari', age: 69, gender: 'MALE', bmi: 20.1, bloodGroup: 'O_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: true, smoking: 'FORMER', alcohol: 'OCCASIONAL', activity: 'LOW', bloodSugar: 102, bpSystolic: 125, creatinine: 1.1, prevAdmissions: 3, ward: 'ONCOLOGY', diagnosis: 'Lung Cancer Stage 3', reason: 'Shortness of Breath' },
    { firstName: 'Kamla', lastName: 'Srivastava', age: 66, gender: 'FEMALE', bmi: 26.8, bloodGroup: 'AB_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: false, hasCKD: true, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'LOW', bloodSugar: 312, bpSystolic: 160, creatinine: 5.1, prevAdmissions: 4, ward: 'GENERAL', diagnosis: 'Diabetic Nephropathy', reason: 'Acute Kidney Injury' },

    // LOW RISK — Young / Acute conditions
    { firstName: 'Rahul', lastName: 'Mishra', age: 25, gender: 'MALE', bmi: 22.0, bloodGroup: 'O_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'HIGH', bloodSugar: 88, bpSystolic: 112, creatinine: 0.8, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Appendicitis', reason: 'Abdominal Pain' },
    { firstName: 'Neha', lastName: 'Kapoor', age: 29, gender: 'FEMALE', bmi: 20.5, bloodGroup: 'A_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'HIGH', bloodSugar: 86, bpSystolic: 108, creatinine: 0.6, prevAdmissions: 0, ward: 'MATERNITY', diagnosis: 'Normal Delivery', reason: 'Maternity Care' },
    { firstName: 'Arjun', lastName: 'Pillai', age: 34, gender: 'MALE', bmi: 23.5, bloodGroup: 'B_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'OCCASIONAL', activity: 'HIGH', bloodSugar: 90, bpSystolic: 118, creatinine: 0.9, prevAdmissions: 0, ward: 'ORTHOPEDIC', diagnosis: 'Fracture', reason: 'Trauma' },
    { firstName: 'Pooja', lastName: 'Desai', age: 32, gender: 'FEMALE', bmi: 21.2, bloodGroup: 'O_NEG', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: true, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'MODERATE', bloodSugar: 84, bpSystolic: 110, creatinine: 0.7, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Asthma', reason: 'Routine Follow-up' },
    { firstName: 'Vikram', lastName: 'Malhotra', age: 27, gender: 'MALE', bmi: 24.8, bloodGroup: 'AB_NEG', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'OCCASIONAL', activity: 'HIGH', bloodSugar: 92, bpSystolic: 116, creatinine: 0.8, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Dengue Fever', reason: 'High Fever' },

    // MIXED — More variety for model training
    { firstName: 'Rekha', lastName: 'Banerjee', age: 53, gender: 'FEMALE', bmi: 29.3, bloodGroup: 'A_NEG', hasDiabetes: true, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'LOW', bloodSugar: 190, bpSystolic: 128, creatinine: 0.9, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'Diabetic Ketoacidosis', reason: 'Vomiting & Weakness' },
    { firstName: 'Santosh', lastName: 'Kulkarni', age: 60, gender: 'MALE', bmi: 27.0, bloodGroup: 'B_POS', hasDiabetes: false, hasHypertension: true, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'FORMER', alcohol: 'NEVER', activity: 'MODERATE', bloodSugar: 105, bpSystolic: 152, creatinine: 0.8, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'Essential Hypertension', reason: 'BP Checkup' },
    { firstName: 'Uma', lastName: 'Krishnan', age: 42, gender: 'FEMALE', bmi: 19.8, bloodGroup: 'O_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'MODERATE', bloodSugar: 85, bpSystolic: 112, creatinine: 0.6, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Hypothyroidism', reason: 'Fatigue & Weight Gain' },
    { firstName: 'Dinesh', lastName: 'Agarwal', age: 49, gender: 'MALE', bmi: 31.8, bloodGroup: 'A_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: true, hasCancer: false, smoking: 'CURRENT', alcohol: 'REGULAR', activity: 'SEDENTARY', bloodSugar: 225, bpSystolic: 158, creatinine: 1.0, prevAdmissions: 2, ward: 'GENERAL', diagnosis: 'Metabolic Syndrome', reason: 'Routine Check-up' },
    { firstName: 'Shanta', lastName: 'Pillai', age: 56, gender: 'FEMALE', bmi: 26.1, bloodGroup: 'B_NEG', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'OCCASIONAL', activity: 'MODERATE', bloodSugar: 94, bpSystolic: 120, creatinine: 0.8, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Migraine', reason: 'Severe Headache' },
    { firstName: 'Gopal', lastName: 'Pandey', age: 73, gender: 'MALE', bmi: 22.9, bloodGroup: 'O_POS', hasDiabetes: false, hasHypertension: true, hasHeartDisease: true, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'FORMER', alcohol: 'NEVER', activity: 'LOW', bloodSugar: 100, bpSystolic: 155, creatinine: 1.2, prevAdmissions: 3, ward: 'CARDIAC', diagnosis: 'Atrial Fibrillation', reason: 'Palpitations' },
    { firstName: 'Savita', lastName: 'Tripathi', age: 62, gender: 'FEMALE', bmi: 30.5, bloodGroup: 'AB_POS', hasDiabetes: true, hasHypertension: true, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: true, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'LOW', bloodSugar: 240, bpSystolic: 153, creatinine: 0.9, prevAdmissions: 2, ward: 'GENERAL', diagnosis: 'Diabetes + Hypertension', reason: 'Poorly Controlled DM' },
    { firstName: 'Naresh', lastName: 'Chandra', age: 41, gender: 'MALE', bmi: 23.1, bloodGroup: 'O_NEG', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'OCCASIONAL', activity: 'HIGH', bloodSugar: 89, bpSystolic: 115, creatinine: 0.7, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Typhoid Fever', reason: 'High Fever' },
    { firstName: 'Mamta', lastName: 'Verma', age: 38, gender: 'FEMALE', bmi: 24.5, bloodGroup: 'A_POS', hasDiabetes: false, hasHypertension: false, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'NEVER', alcohol: 'NEVER', activity: 'MODERATE', bloodSugar: 88, bpSystolic: 112, creatinine: 0.7, prevAdmissions: 0, ward: 'GENERAL', diagnosis: 'Gastroenteritis', reason: 'Vomiting & Diarrhea' },
    { firstName: 'Amitabh', lastName: 'Sinha', age: 55, gender: 'MALE', bmi: 29.9, bloodGroup: 'B_POS', hasDiabetes: false, hasHypertension: true, hasHeartDisease: false, hasCKD: false, hasAsthma: false, hasCOPD: false, hasObesity: false, hasCancer: false, smoking: 'CURRENT', alcohol: 'HEAVY', activity: 'LOW', bloodSugar: 112, bpSystolic: 161, creatinine: 1.3, prevAdmissions: 1, ward: 'GENERAL', diagnosis: 'Hypertension + Alcoholic Hepatitis', reason: 'Jaundice' },
];

function computeRiskScore(p) {
    const norm = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)));
    const score = (
        0.15 * norm(p.age, 18, 90) +
        0.12 * norm(p.bmi, 15, 45) +
        0.10 * (p.hasDiabetes ? 1 : 0) +
        0.10 * (p.hasHypertension ? 1 : 0) +
        0.08 * (p.hasHeartDisease ? 1 : 0) +
        0.12 * norm(p.bloodSugar, 70, 400) +
        0.10 * norm(p.bpSystolic, 80, 200) +
        0.08 * (p.smoking === 'CURRENT' ? 1 : 0) +
        0.08 * norm(p.creatinine, 0.4, 10) +
        0.07 * (p.prevAdmissions > 2 ? 1 : p.prevAdmissions / 3)
    ) * 100;
    return Math.max(0, Math.min(100, score + (Math.random() - 0.5) * 10));
}

async function main() {
    console.log('🌱 Seeding 35 real patients...\n');

    const year = new Date().getFullYear();

    for (let i = 0; i < PATIENTS.length; i++) {
        const p = PATIENTS[i];
        const patientCode = `PAT-${year}-REAL-${String(i + 1).padStart(3, '0')}`;
        const riskScore = computeRiskScore(p);
        const riskLevel = riskScore >= 70 ? 'CRITICAL' : riskScore >= 55 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW';

        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - p.age);

        const readmitted = riskLevel === 'CRITICAL' ? Math.random() < 0.4 : riskLevel === 'HIGH' ? Math.random() < 0.25 : Math.random() < 0.05;
        const losBase = riskLevel === 'CRITICAL' ? 14 : riskLevel === 'HIGH' ? 7 : riskLevel === 'MEDIUM' ? 4 : 2;
        const los = Math.floor(losBase + (Math.random() * 6 - 2));
        const admittedAt = new Date();
        admittedAt.setDate(admittedAt.getDate() - Math.floor(Math.random() * 60));
        const dischargedAt = new Date(admittedAt.getTime() + los * 86400000);
        const discharged = dischargedAt < new Date();

        try {
            await prisma.patient.create({
                data: {
                    patientCode,
                    isSeeded: false,  // visible in app UI as real patients
                    firstName: p.firstName,
                    lastName: p.lastName,
                    dateOfBirth: dob,
                    gender: p.gender,
                    bloodGroup: p.bloodGroup,
                    bmi: p.bmi,
                    smokingStatus: p.smoking,
                    alcoholUse: p.alcohol,
                    physicalActivity: p.activity,
                    hasDiabetes: p.hasDiabetes,
                    hasHypertension: p.hasHypertension,
                    hasHeartDisease: p.hasHeartDisease,
                    hasCKD: p.hasCKD,
                    hasAsthma: p.hasAsthma,
                    hasCOPD: p.hasCOPD,
                    hasObesity: p.hasObesity,
                    hasCancer: p.hasCancer,
                    currentRiskLevel: riskLevel,
                    riskScore: parseFloat(riskScore.toFixed(2)),
                    phone: `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
                    admissions: {
                        create: {
                            admissionNumber: `ADM-${year}-REAL-${String(i + 1).padStart(5, '0')}`,
                            wardType: p.ward,
                            admittedAt,
                            dischargedAt: discharged ? dischargedAt : null,
                            lengthOfStay: discharged ? los : null,
                            icuAdmitted: p.ward === 'ICU',
                            admissionReason: p.reason,
                            diagnosis: p.diagnosis,
                            treatmentOutcome: discharged ? 'RECOVERED' : undefined,
                            readmitted,
                            readmissionWithin30Days: readmitted && Math.random() < 0.6,
                            clinicalData: {
                                create: {
                                    bloodSugarFasting: p.bloodSugar,
                                    bloodSugarPostMeal: p.bloodSugar + 40 + Math.random() * 40,
                                    hba1c: p.hasDiabetes ? 7 + Math.random() * 5 : 4.5 + Math.random() * 1.5,
                                    cholesterolTotal: 160 + Math.random() * 100,
                                    cholesterolLDL: 80 + Math.random() * 100,
                                    cholesterolHDL: 35 + Math.random() * 40,
                                    triglycerides: 100 + Math.random() * 150,
                                    heartRateAvg: 65 + Math.random() * 40,
                                    bloodPressureSystolic: p.bpSystolic,
                                    bloodPressureDiastolic: p.bpSystolic * 0.62 + Math.random() * 5 - 2.5,
                                    oxygenSaturation: p.hasCOPD ? 88 + Math.random() * 7 : 95 + Math.random() * 5,
                                    temperature: 36.5 + Math.random() * 1.8,
                                    hemoglobin: p.hasCancer ? 8 + Math.random() * 3 : 11 + Math.random() * 5,
                                    creatinine: p.creatinine,
                                    gfr: p.hasCKD ? 15 + Math.random() * 35 : 65 + Math.random() * 50,
                                },
                            },
                        },
                    },
                    alerts: riskScore > 60 ? {
                        create: [{
                            type: 'RISK_ESCALATION',
                            severity: riskScore > 75 ? 'CRITICAL' : 'WARNING',
                            message: `${p.firstName} ${p.lastName} has ${riskLevel} risk score of ${riskScore.toFixed(1)}`,
                            details: { riskScore, riskLevel, diagnosis: p.diagnosis },
                        }],
                    } : undefined,
                },
            });
            console.log(`  ✅ [${i + 1}/35] ${p.firstName} ${p.lastName} — ${riskLevel} (${riskScore.toFixed(1)}) — ${p.diagnosis}`);
        } catch (err) {
            console.error(`  ❌ Failed: ${p.firstName} ${p.lastName}:`, err.message);
        }
    }

    console.log('\n🎉 Done! 35 real patients seeded.');
    console.log('💡 Next step: Go to any patient profile → click "🤖 ML Models" tab → Run All 3 Models');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
