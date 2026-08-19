const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
    // Remove ALL existing doctors
    const deleted = await prisma.user.deleteMany({ where: { role: 'DOCTOR' } });
    console.log(`Deleted ${deleted.count} existing doctors`);

    const hash = await bcrypt.hash('Doctor@123', 12);

    const doctors = [
        {
            email: 'dr.sonal.jain@medisense.ai',
            firstName: 'Sonal',
            lastName: 'Jain',
            specialization: 'Cardiology',
            consultationFee: 1500,
            licenseNumber: 'LIC-SJ-001',
        },
        {
            email: 'dr.mukesh.bhatt@medisense.ai',
            firstName: 'Mukesh',
            lastName: 'Bhatt',
            specialization: 'Orthopedics',
            consultationFee: 2500,
            licenseNumber: 'LIC-MB-002',
        },
        {
            email: 'dr.mukun.bipin@medisense.ai',
            firstName: 'Mukun',
            lastName: 'Bipin',
            specialization: 'Pediatrics',
            consultationFee: 2300,
            licenseNumber: 'LIC-MBP-003',
        },
    ];

    for (const doc of doctors) {
        const created = await prisma.user.create({
            data: {
                ...doc,
                passwordHash: hash,
                role: 'DOCTOR',
                isActive: true,
            },
        });
        console.log(`✅ Created: Dr. ${created.firstName} ${created.lastName} | ${created.specialization} | Fee: ₹${created.consultationFee}`);
    }

    const all = await prisma.user.findMany({
        where: { role: 'DOCTOR' },
        select: { firstName: true, lastName: true, specialization: true, consultationFee: true },
    });
    console.log('\n📋 All doctors in DB:');
    all.forEach(d => console.log(`  Dr. ${d.firstName} ${d.lastName} — ${d.specialization} — ₹${d.consultationFee}`));

    await prisma.$disconnect();
}

seed().catch(e => {
    console.error('Seeding failed:', e);
    process.exit(1);
});
