import { Prisma, ProductType, TopupStatus } from '@prisma/client';
import { prisma } from './prisma';
import { sendMail } from './mailer';

export type PurchasePayload = {
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  manualInput?: Record<string, string>;
};

export async function createOrderForUser(payload: PurchasePayload) {
  const totalQuantity = Math.max(payload.quantity, 1);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const product = await tx.product.findUnique({
      where: { id: payload.productId },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!product || product.status !== 'ACTIVE') {
      throw new Error('Product unavailable');
    }

    const variant = payload.variantId
      ? product.variants.find((item) => item.id === payload.variantId)
      : product.variants.find((item) => item.isDefault) ?? product.variants[0];

    if (!variant) {
      throw new Error('No pricing option selected');
    }

    const unitPrice = new Prisma.Decimal(variant.price);
    const totalPrice = unitPrice.times(totalQuantity);

    if (user.walletBalance.lessThan(totalPrice)) {
      throw new Error('Insufficient wallet balance');
    }

    if (!product.isInStock) {
      throw new Error('Product marked out of stock');
    }

    const manualRequirements = (product.inputSchema as ManualField[] | null) ?? [];
    const manualInput = payload.manualInput ?? {};

    for (const field of manualRequirements) {
      if (field.required && !manualInput[field.id]?.trim()) {
        throw new Error(`Missing required field: ${field.label}`);
      }
    }

    let inventoryAssignments: { id: string; payload: unknown }[] = [];

    if (product.productType === ProductType.INSTANT) {
      const inventory = await tx.inventoryItem.findMany({
        where: {
          productId: product.id,
          variantId: variant.id,
          orderItemId: null
        },
        take: totalQuantity,
        orderBy: { createdAt: 'asc' }
      });

      if (inventory.length < totalQuantity) {
        throw new Error('Insufficient stock for instant delivery');
      }

      inventoryAssignments = inventory.map((item) => ({ id: item.id, payload: item.payload }));
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        walletBalance: user.walletBalance.minus(totalPrice)
      }
    });

    const order = await tx.order.create({
      data: {
        userId: user.id,
        total: totalPrice,
        status: product.productType === ProductType.INSTANT ? 'FULFILLED' : 'PENDING_FULFILLMENT',
        orderItems: {
          create: {
            productId: product.id,
            variantId: variant.id,
            quantity: totalQuantity,
            price: unitPrice,
            manualInput: manualRequirements.length > 0 ? manualInput : Prisma.JsonNull,
            deliveredData:
              product.productType === ProductType.INSTANT
                ? { credentials: inventoryAssignments.map((item) => item.payload) }
                : Prisma.JsonNull,
            deliveryStatus: product.productType === ProductType.INSTANT ? 'FULFILLED' : 'PENDING_FULFILLMENT'
          }
        }
      },
      include: {
        orderItems: true
      }
    });

    await tx.walletTransaction.create({
      data: {
        userId: user.id,
        type: 'PURCHASE',
        amount: totalPrice.negated(),
        balanceAfter: updatedUser.walletBalance,
        reference: order.id,
        metadata: {
          productName: product.name,
          variantName: variant.name,
          quantity: totalQuantity
        }
      }
    });

    if (inventoryAssignments.length > 0) {
      await Promise.all(
        inventoryAssignments.map((assignment) =>
          tx.inventoryItem.update({
            where: { id: assignment.id },
            data: {
              orderItemId: order.orderItems[0].id,
              assignedAt: new Date()
            }
          })
        )
      );
    }

    if (product.productType === ProductType.MANUAL) {
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        await sendMail({
          to: adminEmail,
          subject: `Manual fulfillment required: Order #${order.orderNumber}`,
          html: `A new manual order requires attention.<br/>Product: ${product.name}<br/>Variant: ${variant.name}<br/>Quantity: ${totalQuantity}<br/><a href="${process.env.NEXTAUTH_URL}/admin/orders/${order.id}">Open admin panel</a>`
        });
      }
    }

    return order;
  });
}

type ManualField = {
  id: string;
  label: string;
  required?: boolean;
};

export async function approveTopup(topupId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const topup = await tx.topupRequest.findUnique({ where: { id: topupId } });
    if (!topup || topup.status !== TopupStatus.PENDING) {
      throw new Error('Top up request not found');
    }

    const user = await tx.user.update({
      where: { id: topup.userId },
      data: {
        walletBalance: { increment: topup.amount }
      }
    });

    await tx.topupRequest.update({
      where: { id: topupId },
      data: {
        status: TopupStatus.APPROVED,
        adminComment: `Approved by ${adminId}`
      }
    });

    await tx.walletTransaction.create({
      data: {
        userId: user.id,
        type: 'TOPUP',
        amount: topup.amount,
        balanceAfter: user.walletBalance,
        reference: topup.id
      }
    });

    return user;
  });
}

export async function rejectTopup(topupId: string, adminId: string, comment: string) {
  return prisma.topupRequest.update({
    where: { id: topupId },
    data: {
      status: TopupStatus.REJECTED,
      adminComment: comment || `Rejected by ${adminId}`
    }
  });
}

export function listOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      orderItems: {
        include: {
          product: true,
          variant: true,
          inventoryItems: true
        }
      }
    }
  });
}

export function listOrdersForAdmin() {
  return prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
      orderItems: {
        include: {
          product: true,
          variant: true,
          inventoryItems: true
        }
      }
    }
  });
}
