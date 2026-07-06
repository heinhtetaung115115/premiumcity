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
  const kind = String(formData.get('kind') ?? '').trim(); // typed mode: email_password | key | note
  const supabase = getServiceSupabaseClient();

  // ── Typed mode (new): matches the manual-delivery payload shapes ──
  if (kind === 'email_password' || kind === 'key' || kind === 'note') {
    if (kind === 'email_password') {
      // Support bulk: one "email,password[,note]" per line.
      const bulk = String(formData.get('bulk') ?? '').trim();
      if (bulk) {
        const rows = bulk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const maybeHeader = rows[0]?.toLowerCase().replace(/\s+/g, '');
        const startIndex = maybeHeader === 'email,password,note' ? 1 : 0;
        const inserts: any[] = [];
        for (let i = startIndex; i < rows.length; i++) {
          const parts = rows[i].split(',').map((p) => p.trim());
          if (!parts[0] || !parts[1]) continue;
          const [email, password, note] = parts;
          inserts.push({
            product_id: productId,
            variant_id: variantId || null,
            payload: { type: 'email_password', email, password, ...(note ? { note } : {}) },
          });
        }
        if (inserts.length === 0) {
          return { success: false, error: 'No valid rows found (need email,password[,note])' };
        }
        const { error } = await supabase.from('inventory_items').insert(inserts);
        if (error) return { success: false, error: error.message };
        revalidatePath('/admin/products');
        redirect('/admin/products?m=inventory_added_bulk');
      }

      // Single entry
      const email = String(formData.get('email') ?? '').trim();
      const password = String(formData.get('password') ?? '').trim();
      const note = String(formData.get('note') ?? '').trim();
      if (!email || !password) {
        return { success: false, error: 'Email and password are required.' };
      }
      const { error } = await supabase.from('inventory_items').insert({
        product_id: productId,
        variant_id: variantId || null,
        payload: { type: 'email_password', email, password, ...(note ? { note } : {}) },
      });
      if (error) return { success: false, error: error.message };
      revalidatePath('/admin/products');
      redirect('/admin/products?m=inventory_added');
    }

    if (kind === 'key') {
      // Support bulk: one key per line.
      const bulk = String(formData.get('bulk') ?? '').trim();
      if (bulk) {
        const keys = bulk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (keys.length === 0) return { success: false, error: 'No keys found.' };
        const inserts = keys.map((key) => ({
          product_id: productId,
          variant_id: variantId || null,
          payload: { type: 'key', key },
        }));
        const { error } = await supabase.from('inventory_items').insert(inserts);
        if (error) return { success: false, error: error.message };
        revalidatePath('/admin/products');
        redirect('/admin/products?m=inventory_added_bulk');
      }
      const key = String(formData.get('key') ?? '').trim();
      if (!key) return { success: false, error: 'Key is required.' };
      const { error } = await supabase.from('inventory_items').insert({
        product_id: productId,
        variant_id: variantId || null,
        payload: { type: 'key', key },
      });
      if (error) return { success: false, error: error.message };
      revalidatePath('/admin/products');
      redirect('/admin/products?m=inventory_added');
    }

    // note
    const note = String(formData.get('note') ?? '').trim();
    if (!note) return { success: false, error: 'Note is required.' };
    const { error } = await supabase.from('inventory_items').insert({
      product_id: productId,
      variant_id: variantId || null,
      payload: { type: 'note', note },
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/products');
    redirect('/admin/products?m=inventory_added');
  }

  // ── Legacy mode (kept for backwards-compat): raw JSON or CSV payload ──
  const payloadRaw = String(formData.get('payload') ?? '').trim();
  if (!payloadRaw) return { success: false, error: 'Payload is required' };

  if (payloadRaw.startsWith('{') || payloadRaw.startsWith('[')) {
    let payload: unknown;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return { success: false, error: 'Payload must be valid JSON or CSV' };
    }
    const { error } = await supabase.from('inventory_items').insert({
      product_id: productId,
      variant_id: variantId || null,
      payload,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/products');
    redirect('/admin/products?m=inventory_added');
  }

  const rows = payloadRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
      payload: { email, password, note: note ?? '' },
    });
  }
  if (inserts.length === 0) {
    return { success: false, error: 'No valid CSV rows found (need email,password[,note])' };
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

/**
 * Edit an existing product's core fields in place (name, description,
 * delivery note, manual input fields). Category/delivery-type intentionally
 * left immutable here to avoid orphaning existing orders/inventory that
 * assume the original type.
 */
export async function updateProductAction(formData: FormData) {
  await requireAdmin();

  const productId = String(formData.get('productId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const manualFieldsRaw = String(formData.get('manualFields') ?? '').trim();

  if (!productId || !name) {
    return { success: false, error: 'Name is required' };
  }

  let inputSchema: ProductInputField[] | null = null;
  if (manualFieldsRaw) {
    if (manualFieldsRaw.startsWith('[')) {
      try {
        inputSchema = JSON.parse(manualFieldsRaw) as ProductInputField[];
      } catch {
        return { success: false, error: 'Manual fields JSON is invalid' };
      }
    } else {
      inputSchema = buildSchemaFromCsv(manualFieldsRaw);
    }
  }

  // Parse tags (array of { key, value }) from JSON
  let tags: { key: string; value: string }[] = [];
  const tagsRaw = String(formData.get('tags') ?? '').trim();
  if (tagsRaw) {
    try {
      const parsed = JSON.parse(tagsRaw);
      if (Array.isArray(parsed)) {
        tags = parsed
          .filter((t) => t && typeof t.key === 'string' && typeof t.value === 'string')
          .map((t) => ({ key: String(t.key).trim(), value: String(t.value).trim() }))
          .filter((t) => t.key && t.value)
          .slice(0, 10); // cap at 10 tags
      }
    } catch {
      return { success: false, error: 'Tags data is invalid' };
    }
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('products')
    .update({
      name,
      description: String(formData.get('description') ?? ''),
      delivery_note: String(formData.get('deliveryNote') ?? ''),
      input_schema: inputSchema,
      tags
    })
    .eq('id', productId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  revalidatePath('/');
  redirect('/admin/products?m=product_updated');
}

/** Edit an existing variant's name/price/default flag. */
export async function updateVariantAction(formData: FormData) {
  await requireAdmin();

  const variantId = String(formData.get('variantId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const name = String(formData.get('variantName') ?? '').trim();
  const price = Number(formData.get('price') ?? '0');
  const isDefault = formData.get('isDefault') === 'on';

  if (!variantId || !name || !Number.isFinite(price) || price <= 0) {
    return { success: false, error: 'Variant name and positive price required' };
  }

  const supabase = getServiceSupabaseClient();

  if (isDefault && productId) {
    const { error: unsetError } = await supabase
      .from('product_variants')
      .update({ is_default: false })
      .eq('product_id', productId);
    if (unsetError) return { success: false, error: unsetError.message };
  }

  const { error } = await supabase
    .from('product_variants')
    .update({ name, price, is_default: isDefault })
    .eq('id', variantId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  redirect('/admin/products?m=variant_updated');
}

/** Remove a variant that's no longer needed (e.g. created by mistake). */
export async function deleteVariantAction(formData: FormData) {
  await requireAdmin();

  const variantId = String(formData.get('variantId') ?? '').trim();
  if (!variantId) return { success: false, error: 'Missing variant id' };

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/products');
  redirect('/admin/products?m=variant_deleted');
}

/**
 * Remove an unused (undelivered) inventory credential — e.g. a bad
 * email/password pasted by mistake. Refuses to delete anything already
 * attached to an order, since that would erase a customer's delivered
 * access.
 */
export async function deleteInventoryItemAction(formData: FormData) {
  await requireAdmin();

  const inventoryItemId = String(formData.get('inventoryItemId') ?? '').trim();
  if (!inventoryItemId) return { success: false, error: 'Missing inventory item id' };

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', inventoryItemId)
    .is('order_item_id', null)
    .select('id')
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) {
    return {
      success: false,
      error: 'Cannot delete — this credential has already been delivered to a customer.'
    };
  }

  revalidatePath('/admin/products');
  redirect('/admin/products?m=inventory_deleted');
}
