'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/session';
import { bankAccountSchema } from '@/utils/validators';
import { slugify } from '@/utils/slugify';
import type { ProductInputField } from '@/types/product';

export async function createCategoryAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    return { success: false, error: 'Name is required' };
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('categories').insert({
    name,
    slug: slugify(name),
    description: String(formData.get('description') ?? '')
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/products');
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

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('products').insert({
    name,
    slug: slugify(name),
    category_id: categoryId,
    product_type: productType,
    description: String(formData.get('description') ?? ''),
    delivery_note: String(formData.get('deliveryNote') ?? ''),
    input_schema: inputSchema,
    is_in_stock: formData.get('isInStock') === 'on'
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/products');
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

  const supabase = getServiceSupabaseClient();

  if (isDefault) {
    const { error: unsetError } = await supabase
      .from('product_variants')
      .update({ is_default: false })
      .eq('product_id', productId);
    if (unsetError) {
      return { success: false, error: unsetError.message };
    }
  }

  const { error } = await supabase.from('product_variants').insert({
    product_id: productId,
    name,
    price,
    is_default: isDefault
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/products');
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

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('inventory_items').insert({
    product_id: productId,
    variant_id: variantId || null,
    payload
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/products');
  return { success: true };
}

export async function toggleProductStockAction(_: unknown, formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const isInStock = formData.get('isInStock') === 'true';
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('products')
    .update({ is_in_stock: isInStock })
    .eq('id', productId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/products');
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

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('bank_accounts').insert({
    bank_name: parsed.data.bankName,
    account_name: parsed.data.accountName,
    account_no: parsed.data.accountNo,
    instructions: parsed.data.instructions,
    qr_code_url: parsed.data.qrCodeUrl
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/products');
  return { success: true };
}
