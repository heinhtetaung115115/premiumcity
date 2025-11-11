import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { sendMail } from '@/lib/mailer';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const payload = body.payload as Record<string, unknown> | undefined;
  const note = body.note as string | undefined;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      orderItems: {
        include: {
          product: true,
          variant: true
        }
      }
    }
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      status: 'FULFILLED',
      manualPayload: payload ?? Prisma.JsonNull,
      orderItems: {
        updateMany: {
          where: {},
          data: {
            deliveredData: payload ?? Prisma.JsonNull,
            deliveryStatus: 'FULFILLED'
          }
        }
      }
    }
  });

  if (order.user.email) {
    await sendMail({
      to: order.user.email,
      subject: `Your PremiumCity order #${order.orderNumber} is ready`,
      html: `We have delivered your order.<br/>${note ?? ''}`
    });
  }

  return NextResponse.json({ updated });
}
