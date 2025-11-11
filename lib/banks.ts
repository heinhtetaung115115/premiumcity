import { prisma } from './prisma';

export function listActiveBanks() {
  return prisma.bankAccount.findMany({
    where: { isActive: true },
    orderBy: { bankName: 'asc' }
  });
}
