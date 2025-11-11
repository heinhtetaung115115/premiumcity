'use server';

import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { bankAccountSchema } from '@/utils/validators';
import { slugify } from '@/utils/slugify';
import type { ProductInputField } from '@/types/product';

export async function createCategoryAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    return { success: false, error: 'Name is required' };
  }
  await prisma.category.create({
    data: {
      name,
      slug: slugify(name),
      description: String(formData.get('description') ?? '')
    }
  });
  return { success: true };
}

export async function createProductAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('categoryId') ?? '');
  const productType = String(formData.get('productType') ?? 'INSTANT') as 'INSTANT' | 'MANUAL';
  const manualFieldsRaw = String(formData.get('manualFields') ?? '').trim();
  let inputSchema: ProductInputField[] | null = null;

  if (!name || !categoryId) {
    return { success: false, error: 'Name and category required' };
  }

  if (manualFieldsRaw) {
    try {
      inputSchema = JSON.parse(manualFieldsRaw) as ProductInputField[];
    } catch (error) {
      return { success: false, error: 'Manual field JSON is invalid' };
    }
  }

  await prisma.product.create({
    data: {
      name,
      slug: slugify(name),
      categoryId,
      productType,
      description: String(formData.get('description') ?? ''),
      deliveryNote: String(formData.get('deliveryNote') ?? ''),
      inputSchema: inputSchema ? (inputSchema as Prisma.InputJsonValue) : Prisma.JsonNull,
      isInStock: formData.get('isInStock') === 'on'
    }
  });
  return { success: true };
}

export async function createVariantAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const name = String(formData.get('variantName') ?? '').trim();
  const price = Number(formData.get('price') ?? '0');
  const isDefault = formData.get('isDefault') === 'on';

  if (!name || !Number.isFinite(price) || price <= 0) {
    return { success: false, error: 'Variant name and positive price required' };
  }

  if (isDefault) {
    await prisma.productVariant.updateMany({
      where: { productId },
      data: { isDefault: false }
    });
  }

  await prisma.productVariant.create({
    data: {
      productId,
      name,
      price: new Prisma.Decimal(price),
      isDefault
    }
  });

  return { success: true };
}

export async function addInventoryAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const variantId = String(formData.get('variantId') ?? '');
  const payloadRaw = String(formData.get('payload') ?? '').trim();

  if (!payloadRaw) {
    return { success: false, error: 'Payload is required' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (error) {
    return { success: false, error: 'Payload must be JSON' };
  }

  await prisma.inventoryItem.create({
    data: {
      productId,
      variantId: variantId || null,
      payload: payload as Prisma.InputJsonValue
    }
  });

  return { success: true };
}

export async function toggleProductStockAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const isInStock = formData.get('isInStock') === 'true';
  await prisma.product.update({
    where: { id: productId },
    data: { isInStock }
  });
  return { success: true };
}

export async function createBankAccountAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = bankAccountSchema.safeParse({
    bankName: formData.get('bankName'),
    accountName: formData.get('accountName'),
    accountNo: formData.get('accountNo'),
    instructions: formData.get('instructions'),
    qrCodeUrl: formData.get('qrCodeUrl')
  });
  if (!parsed.success) {
    return { success: false, error: 'Invalid bank details' };
  }
  await prisma.bankAccount.create({ data: parsed.data });
  return { success: true };
}
