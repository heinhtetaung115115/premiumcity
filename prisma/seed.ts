import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@premiumcity.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeMe123';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Store Admin',
      role: 'ADMIN',
      passwordHash: await hash(adminPassword, 10)
    }
  });

  console.log('Seeded admin user', admin.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
