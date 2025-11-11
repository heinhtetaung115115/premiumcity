'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { sendMail } from '@/lib/mailer';

export async function deliverManualOrder(_: unknown, formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const payloadRaw = String(formData.get('payload') ?? '');
  const note = String(formData.get('note') ?? '');

  if (!orderId || !payloadRaw) {
    return { success: false, error: 'Missing payload' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (error) {
    return { success: false, error: 'Payload must be valid JSON' };
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'FULFILLED',
      manualPayload: payload as Prisma.InputJsonValue,
      orderItems: {
        updateMany: {
          where: {},
          data: {
            deliveredData: payload as Prisma.InputJsonValue,
            deliveryStatus: 'FULFILLED'
          }
        }
      }
    },
    include: { user: true }
  });

  if (order.user.email) {
    await sendMail({
      to: order.user.email,
      subject: `Your PremiumCity order #${order.orderNumber} has been delivered`,
      html: `Your order is now ready.<br/><pre>${JSON.stringify(payload, null, 2)}</pre><br/>${note}`
    });
  }

  revalidatePath('/admin/orders');
  revalidatePath('/(dashboard)/orders');
  return { success: true };
}
