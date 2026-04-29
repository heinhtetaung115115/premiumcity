'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/session';
import { slugify } from '@/utils/slugify';
import type { ProductInputField } from '@/types/product';

/** Helper: build input_schema from a simple CSV like "email,password,note" */
function buildSchemaFromCsv(csv: string): ProductInputField[] {
  const ids = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return ids.map((id) => {
    const label = id
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    // Make "note" optional by default; others required
    const required = id.toLowerCase() !== 'note';
    return { id, label, required };
  });
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { success: false, error: 'Name is required' };

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('categories').insert({
    name,
    slug: slugify(name),
    description: String(formData.get('description') ?? '')
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  revalidatePath('/');
  redirect('/admin/products?m=category_created');
}

export async function createProductAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('categoryId') ?? '');
  const productType = String(
    formData.get('productType') ?? 'INSTANT'
  ) as 'INSTANT' | 'MANUAL';
  const manualFieldsRaw = String(formData.get('manualFields') ?? '').trim();

  if (!name || !categoryId)
    return { success: false, error: 'Name and category required' };

  let inputSchema: ProductInputField[] | null = null;

  if (manualFieldsRaw) {
    // Allow either JSON array OR CSV ids
    if (manualFieldsRaw.startsWith('[')) {
      try {
        inputSchema = JSON.parse(manualFieldsRaw) as ProductInputField[];
      } catch {
        return {
          success: false,
          error: 'Manual fields JSON is invalid'
        };
      }
    } else {
      inputSchema = buildSchemaFromCsv(manualFieldsRaw);
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
    input_schema: inputSchema
    // NOTE: we do NOT set is_in_stock; we rely on DB default and inventory-based logic
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  revalidatePath('/');
  redirect('/admin/products?m=product_created');
}

export async function createVariantAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const name = String(formData.get('variantName') ?? '').trim();
  const price = Number(formData.get('price') ?? '0');
  const isDefault = formData.get('isDefault') === 'on';

  if (!name || !Number.isFinite(price) || price <= 0) {
    return {
      success: false,
      error: 'Variant name and positive price required'
    };
  }

  const supabase = getServiceSupabaseClient();

  if (isDefault) {
    const { error: unsetError } = await supabase
      .from('product_variants')
      .update({ is_default: false })
      .eq('product_id', productId);
    if (unsetError) return { success: false, error: unsetError.message };
  }

  const { error } = await supabase.from('product_variants').insert({
    product_id: productId,
    name,
    price,
    is_default: isDefault
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  redirect('/admin/products?m=variant_added');
}

/**
 * Add inventory credentials.
 * Accepts:
 *  - JSON (single): {"email":"...","password":"...","note":"..."}
 *  - CSV (bulk): email,password,note (one row per line; header optional)
 *
 * Stock status is now derived purely from number of available inventory rows,
 * so we don't need to touch is_in_stock here.
 */
export async function addInventoryAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get('productId') ?? '');
  const variantId = String(formData.get('variantId') ?? '');
  const payloadRaw = String(formData.get('payload') ?? '').trim();

  if (!payloadRaw) return { success: false, error: 'Payload is required' };

  const supabase = getServiceSupabaseClient();

  if (payloadRaw.startsWith('{') || payloadRaw.startsWith('[')) {
    // JSON single insert
    let payload: unknown;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return {
        success: false,
        error: 'Payload must be valid JSON or CSV'
      };
    }

    const { error } = await supabase.from('inventory_items').insert({
      product_id: productId,
      variant_id: variantId || null,
      payload
    });
    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/products');
    redirect('/admin/products?m=inventory_added');
  }

  // CSV bulk
  const rows = payloadRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const maybeHeader = rows[0]?.toLowerCase().replace(/\s+/g, '');
  const startIndex = maybeHeader === 'email,password,note' ? 1 : 0;

  const inserts: {
    product_id: string;
    variant_id: string | null;
    payload: { email: string; password: string; note?: string };
  }[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const parts = rows[i].split(',').map((p) => p.trim());
    if (!parts[0] || !parts[1]) continue;
    const [email, password, note] = parts;
    inserts.push({
      product_id: productId,
      variant_id: variantId || null,
      payload: { email, password, note: note ?? '' }
    });
  }

  if (inserts.length === 0) {
    return {
      success: false,
      error: 'No valid CSV rows found (need email,password[,note])'
    };
  }

  const { error } = await supabase.from('inventory_items').insert(inserts);
  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  redirect('/admin/products?m=inventory_added_bulk');
}

/** Simplified: accept plain inputs, set is_active=true so it shows immediately. */
export async function createBankAccountAction(formData: FormData) {
  await requireAdmin();
  const bankName = String(formData.get('bankName') ?? '').trim();
  const accountName = String(formData.get('accountName') ?? '').trim();
  const accountNo = String(formData.get('accountNo') ?? '').trim();
  const instructions =
    String(formData.get('instructions') ?? '').trim() || null;
  const qrCodeUrl = String(formData.get('qrCodeUrl') ?? '').trim() || null;

  if (!bankName || !accountName || !accountNo) {
    return {
      success: false,
      error:
        'Bank name, account name, and account number are required'
    };
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('bank_accounts').insert({
    bank_name: bankName,
    account_name: accountName,
    account_no: accountNo,
    instructions,
    qr_code_url: qrCodeUrl,
    is_active: true
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  redirect('/admin/products?m=bank_added');
}

/**
 * Toggle product ACTIVE / INACTIVE (for catalog visibility).
 */
export async function toggleProductStatusAction(formData: FormData) {
  await requireAdmin();

  const productId = String(formData.get('productId') ?? '').trim();
  if (!productId) {
    return { success: false, error: 'Missing product id' };
  }

  const supabase = getServiceSupabaseClient();

  // Load current status
  const { data, error: fetchError } = await supabase
    .from('products')
    .select('id,status')
    .eq('id', productId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }
  if (!data) {
    return { success: false, error: 'Product not found' };
  }

  const product = data as {
    id: string;
    status: 'ACTIVE' | 'INACTIVE' | null;
  };

  const currentStatus =
    product.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  const nextStatus =
    currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const { error: updError } = await supabase
    .from('products')
    .update({ status: nextStatus })
    .eq('id', productId);

  if (updError) {
    return { success: false, error: updError.message };
  }

  revalidatePath('/admin/products');
  revalidatePath('/');

  return { success: true };
}

/**
 * Backwards-compat export so existing imports of toggleProductStockAction
 * continue to work without changes.
 */
export { toggleProductStatusAction as toggleProductStockAction };
