const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.patient.updateMany({ data: { isSeeded: true } });
    console.log('✅ Marked', result.count, 'seeded training patients as isSeeded=true');
    console.log('   These patients are now hidden from the app UI.');
    console.log('   Only new patients registered by receptionists will appear.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
