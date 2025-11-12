'use server';

import { revalidatePath } from 'next/cache';
import { createOrderForUser } from '@/lib/orders';
import { requireAuth } from '@/lib/session';
import { productPurchaseSchema } from '@/utils/validators';

export async function purchaseProduct(_: unknown, formData: FormData) {
  const session = await requireAuth();
  const parsed = productPurchaseSchema.safeParse({
    productId: formData.get('productId'),
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
    manualInput: Object.fromEntries(
      Array.from(formData.entries())
        .filter(([key, value]) => key.startsWith('manual:') && typeof value === 'string' && value.trim().length > 0)
        .map(([key, value]) => [key.replace('manual:', ''), String(value)])
    )
  });

  if (!parsed.success) {
    return { success: false, error: 'Invalid submission' };
  }

  try {
    await createOrderForUser({
      userId: session.user.id!,
      productId: parsed.data.productId,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
      manualInput: parsed.data.manualInput
    });
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  revalidatePath('/(dashboard)/orders');
  return { success: true };
}
