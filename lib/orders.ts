import { getServiceSupabaseClient } from './supabase';
import { sendMail } from './mailer';
import type { Product, ProductVariant, Order, OrderItem } from '@/types/entities';
import type { ProductInputField } from '@/types/product';

type PurchasePayload = {
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  manualInput?: Record<string, string>;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string;
  product_type: 'INSTANT' | 'MANUAL';
  status: 'ACTIVE' | 'INACTIVE';
  is_in_stock: boolean;
  input_schema: ProductInputField[] | null;
  delivery_note: string | null;
  variants: VariantRow[] | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_default: boolean;
  is_active: boolean;
  position: number;
};

type OrderRow = {
  id: string;
  order_number: number;
  user_id: string;
  total: number;
  status: 'PENDING_FULFILLMENT' | 'FULFILLED' | 'CANCELLED';
  payment_method: string;
  manual_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user?: { id: string; email: string | null; name: string | null } | null;
  order_items: OrderItemRow[];
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price: number;
  manual_input: Record<string, unknown> | null;
  delivered_payload: Record<string, unknown> | null;
  delivery_status: 'PENDING_FULFILLMENT' | 'FULFILLED' | 'CANCELLED';
  product: {
    id: string;
    name: string;
    slug: string;
    product_type: 'INSTANT' | 'MANUAL';
    delivery_note: string | null;
  } | null;
  variant: {
    id: string;
    name: string;
  } | null;
  inventory_items: {
    id: string;
    payload: Record<string, unknown> | null;
    assigned_at: string | null;
  }[];
};

function mapVariant(row: VariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    price: Number(row.price),
    isDefault: row.is_default,
    isActive: row.is_active,
    position: row.position
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.category_id,
    productType: row.product_type,
    status: row.status,
    isInStock: row.is_in_stock,
    inputSchema: row.input_schema,
    deliveryNote: row.delivery_note,
    variants: (row.variants ?? []).map(mapVariant)
  };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    total: Number(row.total),
    status: row.status,
    paymentMethod: row.payment_method,
    manualPayload: row.manual_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: row.user ?? null,
    orderItems: row.order_items.map(mapOrderItem)
  };
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    price: Number(row.price),
    manualInput: (row.manual_input ?? null) as Record<string, unknown> | null,
    deliveredData: (row.delivered_payload ?? null) as Record<string, unknown> | null,
    deliveryStatus: row.delivery_status,
    product: {
      id: row.product?.id ?? row.product_id,
      name: row.product?.name ?? 'Unknown product',
      slug: row.product?.slug ?? '',
      productType: row.product?.product_type ?? 'MANUAL',
      deliveryNote: row.product?.delivery_note ?? null
    },
    variant: row.variant ? { id: row.variant.id, name: row.variant.name } : null,
    inventoryItems: (row.inventory_items ?? []).map((item) => ({
      id: item.id,
      payload: item.payload,
      assignedAt: item.assigned_at
    }))
  };
}

function normaliseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('INSUFFICIENT_FUNDS')) {
      return 'Insufficient wallet balance';
    }
    if (error.message.includes('INSUFFICIENT_STOCK')) {
      return 'Insufficient stock for instant delivery';
    }
    if (error.message.includes('PRODUCT_UNAVAILABLE')) {
      return 'Product unavailable';
    }
  }
  return (error as Error)?.message ?? 'Unexpected error';
}

export async function createOrderForUser(payload: PurchasePayload) {
  const supabase = getServiceSupabaseClient();
  const { data: productRow, error: productError } = await supabase
    .from('products')
    .select('id, name, slug, description, category_id, product_type, status, is_in_stock, input_schema, delivery_note, variants(*)')
    .eq('id', payload.productId)
    .maybeSingle();

  if (productError) {
    throw productError;
  }

  if (!productRow) {
    throw new Error('Product not found');
  }

  const product = mapProduct(productRow as ProductRow);

  if (product.status !== 'ACTIVE' || !product.isInStock) {
    throw new Error('Product unavailable');
  }

  const variant = payload.variantId
    ? product.variants.find((item) => item.id === payload.variantId)
    : product.variants.find((item) => item.isDefault) ?? product.variants[0];

  if (!variant) {
    throw new Error('No pricing option selected');
  }

  const totalQuantity = Math.max(payload.quantity, 1);
  const manualRequirements = product.inputSchema ?? [];
  const manualInput = payload.manualInput ?? {};

  for (const field of manualRequirements) {
    if (field.required && !manualInput[field.id]?.trim()) {
      throw new Error(`Missing required field: ${field.label}`);
    }
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_user_id: payload.userId,
    p_product_id: payload.productId,
    p_variant_id: variant.id,
    p_quantity: totalQuantity,
    p_manual_input: manualRequirements.length > 0 ? manualInput : null
  });

  if (error) {
    throw new Error(normaliseErrorMessage(error));
  }

  const orderId = (data as { order_id: string } | { id: string } | string | null) ?? null;
  const resolvedOrderId = typeof orderId === 'string' ? orderId : (orderId as { order_id?: string; id?: string } | null)?.order_id ?? (orderId as { order_id?: string; id?: string } | null)?.id;

  if (!resolvedOrderId) {
    throw new Error('Failed to create order');
  }

  const order = await getOrderById(resolvedOrderId);

  if (product.productType === 'MANUAL') {
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
}

export async function approveTopup(topupId: string, adminId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('approve_topup', {
    p_topup_id: topupId,
    p_admin_id: adminId
  });

  if (error) {
    throw error;
  }

  const topup = data as {
    id: string;
    user_id: string;
    amount: number;
    bank_name: string;
    reference_hint: string;
  };

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', topup.user_id)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (user?.email) {
    await sendMail({
      to: user.email,
      subject: 'Your wallet top-up was approved',
      html: `We have approved your ${Number(topup.amount).toFixed(2)} top-up via ${topup.bank_name}.` +
        (topup.reference_hint ? `<br/>Reference: ${topup.reference_hint}` : '')
    });
  }
}

export async function rejectTopup(topupId: string, adminId: string, comment: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('reject_topup', {
    p_topup_id: topupId,
    p_admin_id: adminId,
    p_comment: comment || null
  });

  if (error) {
    throw error;
  }

  const topup = data as { user_id: string };

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', topup.user_id)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (user?.email) {
    await sendMail({
      to: user.email,
      subject: 'Your wallet top-up was rejected',
      html: comment
        ? `We could not approve your top-up.<br/>Reason: ${comment}`
        : 'We could not approve your top-up. Please contact support.'
    });
  }
}

export async function listOrdersForUser(userId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_number, user_id, total, status, payment_method, manual_payload, created_at, updated_at,
       order_items(id, order_id, product_id, variant_id, quantity, price, manual_input, delivered_payload, delivery_status,
         product:products(id, name, slug, product_type, delivery_note),
         variant:product_variants(id, name),
         inventory_items(id, payload, assigned_at)
       )`
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

export async function listOrdersForAdmin() {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_number, user_id, total, status, payment_method, manual_payload, created_at, updated_at,
       user:users(id, email, name),
       order_items(id, order_id, product_id, variant_id, quantity, price, manual_input, delivered_payload, delivery_status,
         product:products(id, name, slug, product_type, delivery_note),
         variant:product_variants(id, name),
         inventory_items(id, payload, assigned_at)
       )`
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

export async function getOrderById(orderId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_number, user_id, total, status, payment_method, manual_payload, created_at, updated_at,
       user:users(id, email, name),
       order_items(id, order_id, product_id, variant_id, quantity, price, manual_input, delivered_payload, delivery_status,
         product:products(id, name, slug, product_type, delivery_note),
         variant:product_variants(id, name),
         inventory_items(id, payload, assigned_at)
       )`
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Order not found');
  }

  return mapOrder(data as OrderRow);
}
