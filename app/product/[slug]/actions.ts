'use server';

import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { requireAuth } from '@/lib/session';
import { createOrderForUser } from '@/lib/orders';
import { getServiceSupabaseClient } from '@/lib/supabase';


type WalletRow = {
  id: string;
  balance: number | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  price: number;
  is_default: boolean;
  is_active: boolean;
};

export async function purchaseProductAction(formData: FormData) {
  const session = await requireAuth();
  const userId = String(session.user.id);

  const productId = String(formData.get('productId') ?? '').trim();
  const variantIdRaw = String(formData.get('variantId') ?? '').trim();
  const slug = String(formData.get('productSlug') ?? '').trim();
  const variantId = variantIdRaw || null;

  const quantityRaw = String(formData.get('quantity') ?? '1');
  const quantityNum = Number(quantityRaw);
  const quantity =
    Number.isFinite(quantityNum) && quantityNum > 0 ? quantityNum : 1;

  // Manual fields
  const manualInput: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (key.startsWith('field_')) {
      const fieldId = key.slice('field_'.length);
      manualInput[fieldId] = String(value ?? '').trim();
    }
  });

  const supabase = getServiceSupabaseClient();
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    // 1) Wallet
    const { data: walletRow, error: walletError } = await supabase
      .from('wallets')
      .select('id,balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError) throw walletError;

    const wallet = walletRow as WalletRow | null;

    if (!wallet) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const walletId = wallet.id;
    const walletBalance = Number(wallet.balance ?? 0);

    // 2) Load variants with explicit typing
    const { data: variantRows, error: variantError } = await supabase
      .from('product_variants')
      .select('id,product_id,price,is_default,is_active')
      .eq('product_id', productId)
      .eq('is_active', true);

    if (variantError) throw variantError;

    const variants = (variantRows as VariantRow[]) ?? [];

    if (variants.length === 0) {
      throw new Error('Pricing for this product is not configured.');
    }

    // Pick selected or default
    let selectedVariant: VariantRow | undefined = null;

    if (variantId) {
      selectedVariant = variants.find((v) => v.id === variantId);
    }
    if (!selectedVariant) {
      selectedVariant = variants.find((v) => v.is_default) || variants[0];
    }

    if (!selectedVariant) {
      throw new Error('Could not determine pricing option for this product.');
    }

    const unitPrice = Number(selectedVariant.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error('Invalid price configured for this product.');
    }

    const totalPrice = unitPrice * quantity;

    // 3) Wallet check
    if (walletBalance < totalPrice) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    // 4) Create order
    const order = await createOrderForUser({
      userId,
      productId,
      variantId: selectedVariant.id,
      quantity,
      manualInput:
        Object.keys(manualInput).length > 0 ? manualInput : undefined
    });

    // 5) Debit wallet + log transaction
    const newBalance = walletBalance - totalPrice;

    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId);

    if (walletUpdateError) throw walletUpdateError;

    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: walletId,
        amount: totalPrice,
        direction: 'DEBIT',
        description: `Order payment (${order.id})`
      });

    if (txError) throw txError;

    redirect('/orders');
  } catch (err: any) {
    if (isRedirectError(err)) throw err;

    if (err?.message === 'INSUFFICIENT_FUNDS') {
      errorCode = 'INSUFFICIENT_FUNDS';
      errorMessage = null;
    } else {
      errorMessage = err?.message ?? 'Unable to complete purchase.';
    }
  }

  if (errorCode === 'INSUFFICIENT_FUNDS') {
    redirect(`/product/${encodeURIComponent(slug)}?error=INSUFFICIENT_FUNDS`);
  }

  const finalMessage =
    errorMessage && errorMessage.length > 0
      ? errorMessage
      : 'Unable to complete purchase.';

  redirect(
    `/product/${encodeURIComponent(slug)}?error=${encodeURIComponent(
      finalMessage
    )}`
  );
}
