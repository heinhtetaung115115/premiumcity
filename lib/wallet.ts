import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { sendMail } from './mailer';

type TopupPayload = {
  userId: string;
  amount: number;
  bankName: string;
  referenceHint: string;
  note?: string;
};

export async function submitTopupRequest(payload: TopupPayload) {
  const topup = await prisma.topupRequest.create({
    data: {
      userId: payload.userId,
      amount: new Prisma.Decimal(payload.amount),
      bankName: payload.bankName,
      referenceHint: payload.referenceHint,
      metadata: payload.note ? { note: payload.note } : Prisma.JsonNull
    }
  });

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (adminEmail) {
    await sendMail({
      to: adminEmail,
      subject: `New wallet top-up pending review`,
      html: `Customer ${payload.userId} submitted a top-up of ${payload.amount} via ${payload.bankName}.<br/>Reference hint: ${payload.referenceHint}<br/>Note: ${payload.note ?? 'n/a'}<br/><a href="${process.env.NEXTAUTH_URL}/admin/topups/${topup.id}">Review request</a>`
    });
  }

  return topup;
}

export function getWalletOverview(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      walletBalance: true,
      walletTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 25
      }
    }
  });
}

export function listTopupRequests(userId: string) {
  return prisma.topupRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export function listPendingTopups() {
  return prisma.topupRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: true
    }
  });
}
