/**
 * Nest seed — auth profile users only.
 * Inventory/CRM demo data is seeded via stockos-web (Supabase UUID schema), not Prisma.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Nest auth users (users / user_sessions only)...');

  await prisma.userSession.deleteMany();

  const passwordHash = await bcrypt.hash('Admin@123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@stockos.com' },
    update: {
      name: 'StockOS Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
    },
    create: {
      email: 'admin@stockos.com',
      name: 'StockOS Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      allowedLocations: [],
    },
  });

  console.log('Done. Demo inventory: use stockos-web seed / UI.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
