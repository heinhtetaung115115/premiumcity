import { getServiceSupabaseClient } from './supabase';
import { sendEmail, getAdminRecipients, tplStockDepletedAdmin } from './email';
import { notifyNewManualOrder } from './telegram';

type PurchasePayload = {
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  manualInput?: Record<string, string>; // for MANUAL products
};

export type VpnKeyView = {
  id: string;
  country: string | null;
  planName: string | null;
  expiresAt: string | null;
  dataLimitBytes: number | null;
  usedBytes: number | null;
  ssUri: string | null;
};

export type OrderItemView = {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  productType: 'INSTANT' | 'MANUAL' | 'VPN_OUTLINE' | string;
  manualInput: Record<string, string> | null;
  credentials: any[]; // array of payload objects from inventory_items

  // === VPN-specific fields (for VPN items whose VARIANT has vpn_plan_id) ===
  vpnCountry?: string | null;
  vpnPlanName?: string | null;
  vpnExpiresAt?: string | null;
  vpnDataLimitBytes?: number | null;
  vpnUsedBytes?: number | null;
  vpnSsUri?: string | null;

  // All vpn_keys for this item (0..N keys)
  vpnKeys?: VpnKeyView[];
};

export type OrderView = {
  id: string;
  createdAt: string;
  status: string;
  totalAmount: number;
  items: OrderItemView[];
};

function normaliseErrorMessage(msg: string): string {
  if (msg.includes('INSUFFICIENT_STOCK')) {
    return 'Not enough stock available for this product.';
  }
  if (msg.includes('PRODUCT_NOT_FOUND')) {
    return 'Product not found.';
  }
  if (msg.includes('PRODUCT_INACTIVE')) {
    return 'This product is not available right now.';
  }
  if (
    msg.includes('VARIANT_NOT_FOUND') ||
    msg.includes('NO_ACTIVE_VARIANT') ||
    msg.includes('NO_PRICING')
  ) {
    return 'Pricing for this product is not correctly configured.';
  }
  if (
    msg.includes('VPN_PLAN_NOT_FOUND') ||
    msg.includes('VPN_SERVER_NOT_FOUND') ||
    msg.includes('VPN_PROVISIONING_FAILED')
  ) {
    return 'Unable to create VPN access right now. Please try again later.';
  }
  return msg;
}

/**
 * Helper: refresh vpn_keys.used_bytes for a single user by calling Outline
 * /metrics/transfer on each active vpn_server they have keys on.
 *
 * Outline format we expect:
 *   GET {api_url}/metrics/transfer
 *   {
 *     "bytesTransferredByUserId": {
 *       "0": 123456789,
 *       "1": 987654321
 *     }
 *   }
 *
 * We store Outline access key id as vpn_keys.outline_key_id, so we just look up
 * bytesTransferredByUserId[outline_key_id].
 */
async function refreshVpnUsageForUser(userId: string) {
  const supabase = getServiceSupabaseClient();

  // 1) Get this user's vpn_keys with server info
  const { data: keyRows, error: keyError } = await supabase
    .from('vpn_keys')
    .select('id,outline_key_id,vpn_server_id,used_bytes')
    .eq('user_id', userId);

  if (keyError) {
    console.error('refreshVpnUsageForUser: failed to load vpn_keys:', keyError);
    return;
  }

  const keys = (keyRows ?? []) as any[];
  if (!keys.length) return;

  const serverIds = Array.from(
    new Set(
      keys
        .map((k) => k.vpn_server_id)
        .filter((v: any) => v !== null && v !== undefined)
        .map((v: any) => String(v))
    )
  );

  if (!serverIds.length) return;

  // 2) Load servers for those IDs
  const { data: serverRows, error: serverError } = await supabase
    .from('vpn_servers')
    .select('id,api_url,is_active')
    .in('id', serverIds);

  if (serverError) {
    console.error(
      'refreshVpnUsageForUser: failed to load vpn_servers:',
      serverError
    );
    return;
  }

  const servers = (serverRows ?? []) as any[];

  const serversById: Record<string, any> = {};
  for (const s of servers) {
    if (!s) continue;
    if (s.is_active === false) continue;
    serversById[String(s.id)] = s;
  }

  // Group keys by server
  const keysByServer: Record<string, any[]> = {};
  for (const keyRow of keys) {
    const sid = keyRow.vpn_server_id;
    if (!sid) continue;
    const sidStr = String(sid);
    if (!serversById[sidStr]) continue; // server inactive/not found

    if (!keysByServer[sidStr]) keysByServer[sidStr] = [];
    keysByServer[sidStr].push(keyRow);
  }

  // 3) For each server, call /metrics/transfer and update used_bytes
  for (const sid of Object.keys(keysByServer)) {
    const server = serversById[sid];
    const rawApiUrl = String(server.api_url || '').trim();
    if (!rawApiUrl) continue;

    const apiUrl = rawApiUrl.replace(/\/+$/, '');

    let json: any | null = null;
    try {
      const res = await fetch(`${apiUrl}/metrics/transfer`, {
        method: 'GET',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(
          `refreshVpnUsageForUser: /metrics/transfer failed for server ${sid}:`,
          res.status,
          text
        );
        continue;
      }

      json = await res.json().catch(() => null);
    } catch (err) {
      console.warn(
        `refreshVpnUsageForUser: error calling /metrics/transfer for server ${sid}:`,
        err
      );
      continue;
    }

    // Be a bit flexible on shape
    const usageMap: Record<string, number> =
      json?.bytesTransferredByUserId ??
      json?.bytes_transferred_by_user_id ??
      json?.metrics?.bytesTransferredByUserId ??
      {};

    if (!usageMap || typeof usageMap !== 'object') {
      console.warn(
        `refreshVpnUsageForUser: unexpected metrics/transfer shape for server ${sid}:`,
        json
      );
      continue;
    }

    const keysForServer = keysByServer[sid];

    for (const keyRow of keysForServer) {
      const outlineKeyId = String(keyRow.outline_key_id ?? '').trim();
      if (!outlineKeyId) continue;

      let usedBytesRaw = usageMap[outlineKeyId];

      // If there is only one key + one entry, fallback to that value even if
      // ids don't match (very small single-customer server case).
      if (
        usedBytesRaw === undefined &&
        Object.keys(usageMap).length === 1 &&
        keysForServer.length === 1
      ) {
        const onlyKey = Object.keys(usageMap)[0];
        usedBytesRaw = usageMap[onlyKey];
      }

      if (usedBytesRaw === undefined || usedBytesRaw === null) {
        // No traffic yet for this key – don't force it to 0 if it's already 0
        if (!keyRow.used_bytes) continue;
        usedBytesRaw = 0;
      }

      const usedBytes = Number(usedBytesRaw) || 0;

      // If value hasn't changed, skip DB write
      if (Number(keyRow.used_bytes) === usedBytes) {
        continue;
      }

      try {
        const { error: updateError } = await supabase
          .from('vpn_keys')
          .update({ used_bytes: usedBytes })
          .eq('id', keyRow.id);

        if (updateError) {
          console.warn(
            'refreshVpnUsageForUser: failed to update used_bytes for key',
            keyRow.id,
            updateError
          );
        }
      } catch (err) {
        console.warn(
          'refreshVpnUsageForUser: exception updating used_bytes for key',
          keyRow.id,
          err
        );
      }
    }
  }
}

/**
 * Helper: create VPN keys (Outline) for any items whose VARIANT has vpn_plan_id + vpn_country set.
 *
 * Expects:
 *  - product_variants.vpn_country (text)
 *  - product_variants.vpn_plan_id (uuid -> vpn_plans.id)
 *  - vpn_plans (id, name, data_limit_bytes, duration_days)
 *  - vpn_servers (id, country, api_url, is_active)
 *  - vpn_keys table for storing the created keys
 */
async function provisionVpnKeysForOrder(orderId: string, userId: string) {
  const supabase = getServiceSupabaseClient();

  // 1) Load order items
  const { data: orderItemRows, error: orderItemError } = await supabase
    .from('order_items')
    .select('id,product_id,variant_id,quantity')
    .eq('order_id', orderId);

  if (orderItemError) {
    throw orderItemError;
  }

  const allItems = (orderItemRows ?? []) as any[];
  if (allItems.length === 0) {
    return;
  }

  // 2) Load variants for those items to get vpn_country & vpn_plan_id
  const variantIds = Array.from(
    new Set(
      allItems
        .map((item) => item.variant_id)
        .filter((v: any) => v !== null && v !== undefined)
        .map((v: any) => String(v))
    )
  );

  if (variantIds.length === 0) {
    // No variants -> nothing to do
    return;
  }

  const { data: variantRows, error: variantError } = await supabase
    .from('product_variants')
    .select('id,vpn_country,vpn_plan_id')
    .in('id', variantIds);

  if (variantError) throw variantError;
  const variants = (variantRows ?? []) as any[];

  const variantById: Record<string, any> = {};
  for (const v of variants) {
    variantById[String(v.id)] = v;
  }

  // 3) Figure out which items are VPN items (variant has vpn_plan_id and vpn_country)
  type VpnItem = {
    item: any;
    variant: any;
    planId: string;
    country: string;
  };

  const vpnItems: VpnItem[] = [];
  const planIdsSet = new Set<string>();
  const countriesSet = new Set<string>();

  for (const item of allItems) {
    const variantId = item.variant_id;
    if (!variantId) continue;

    const variant = variantById[String(variantId)];
    if (!variant) continue;

    const planId = variant.vpn_plan_id;
    const countryRaw = variant.vpn_country;

    if (!planId || !countryRaw) {
      // Not a VPN variant
      continue;
    }

    const planIdStr = String(planId);
    const countryStr = String(countryRaw).toUpperCase();

    vpnItems.push({
      item,
      variant,
      planId: planIdStr,
      country: countryStr,
    });

    planIdsSet.add(planIdStr);
    countriesSet.add(countryStr);
  }

  if (vpnItems.length === 0) {
    // No VPN items in this order
    return;
  }

  const planIds = Array.from(planIdsSet);
  const countries = Array.from(countriesSet);

  // 4) Load vpn_plans
  const { data: planRows, error: planError } = await supabase
    .from('vpn_plans')
    .select('id,name,data_limit_bytes,duration_days')
    .in('id', planIds);

  if (planError) throw planError;
  const plans = (planRows ?? []) as any[];

  const planById: Record<string, any> = {};
  for (const plan of plans) {
    planById[String(plan.id)] = plan;
  }

  // 5) Load vpn_servers for these countries
  const { data: serverRows, error: serverError } = await supabase
    .from('vpn_servers')
    .select('id,country,api_url,is_active')
    .in('country', countries)
    .eq('is_active', true);

  if (serverError) throw serverError;
  const servers = (serverRows ?? []) as any[];

  const serversByCountry: Record<string, any[]> = {};
  for (const s of servers) {
    const c = String(s.country || '').toUpperCase();
    if (!serversByCountry[c]) {
      serversByCountry[c] = [];
    }
    serversByCountry[c].push(s);
  }

  // Check each needed country has at least one active server
  for (const c of countries) {
    const key = String(c).toUpperCase();
    if (!serversByCountry[key] || serversByCountry[key].length === 0) {
      throw new Error(
        `VPN_SERVER_NOT_FOUND: No active VPN server available for country ${c}`
      );
    }
  }

  // 6) For each VPN item, create VPN keys on Outline and store them in vpn_keys
  for (const vpnItem of vpnItems) {
    const { item, planId, country } = vpnItem;
    const plan = planById[planId];

    if (!plan) {
      throw new Error('VPN_PLAN_NOT_FOUND: VPN plan not found.');
    }

    const serversForCountry = serversByCountry[country];
    if (!serversForCountry || serversForCountry.length === 0) {
      throw new Error(
        `VPN_SERVER_NOT_FOUND: No VPN server available for country ${country}`
      );
    }

    const quantity = Math.max(1, Number(item.quantity) || 1);

    for (let i = 0; i < quantity; i++) {
      // Pick a random server in that country
      const server =
        serversForCountry[Math.floor(Math.random() * serversForCountry.length)];

      const rawApiUrl = String(server.api_url || '');
      if (!rawApiUrl) {
        throw new Error(
          'VPN_SERVER_NOT_FOUND: Missing API URL for VPN server.'
        );
      }

      const apiUrl = rawApiUrl.replace(/\/+$/, '');

      // 6a) Create Outline access key
      let outlineKeyId: string;
      let ssUri: string;

      try {
        const createRes = await fetch(`${apiUrl}/access-keys`, {
          method: 'POST',
        });

        if (!createRes.ok) {
          const text = await createRes.text().catch(() => '');
          console.error('Outline create key error:', text);
          throw new Error('VPN_PROVISIONING_FAILED: create key failed');
        }

        const created = await createRes.json();
        outlineKeyId = String(created.id);
        ssUri = String(created.accessUrl);
      } catch (err) {
        console.error('Error calling Outline API to create key:', err);
        throw new Error('VPN_PROVISIONING_FAILED: Outline create key error');
      }

      // 6b) Set data limit on Outline (200/600/1200 GB etc, from plan)
      try {
        const limitRes = await fetch(
          `${apiUrl}/access-keys/${encodeURIComponent(
            outlineKeyId
          )}/data-limit`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: { bytes: plan.data_limit_bytes } }),
          }
        );

        if (!limitRes.ok) {
          const text = await limitRes.text().catch(() => '');
          console.warn('Failed to set data limit on Outline key:', text);
          // Not fatal
        }
      } catch (err) {
        console.warn('Error while setting data limit on Outline key:', err);
      }

      // 6c) Compute expiry date
      const expiresAt = new Date();
      const durationDays = Number(plan.duration_days || 0) || 30;
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      // 6d) Append expiry label to ss_uri so it shows as the key name in apps
      try {
        const monthLabels = [
          'JAN',
          'FEB',
          'MAR',
          'APR',
          'MAY',
          'JUN',
          'JUL',
          'AUG',
          'SEP',
          'OCT',
          'NOV',
          'DEC',
        ] as const;
        const m = monthLabels[expiresAt.getMonth()] ?? 'EXP';
        const d = String(expiresAt.getDate()).padStart(2, '0');
        const label = `${m} ${d}`; // e.g. "FEB 23"

        if (ssUri && !ssUri.includes('#')) {
          ssUri = `${ssUri}#${label}`;
        }
      } catch (err) {
        console.warn('Failed to append expiry label to ss_uri:', err);
      }

      // 6e) Store in vpn_keys table
      const { error: insertError } = await supabase.from('vpn_keys').insert({
        user_id: userId,
        order_id: orderId,
        order_item_id: item.id,
        vpn_server_id: server.id,
        vpn_plan_id: plan.id,
        outline_key_id: outlineKeyId,
        ss_uri: ssUri,
        country: country,
        plan_name: plan.name,
        data_limit_bytes: plan.data_limit_bytes,
        expires_at: expiresAt.toISOString(),
      });

      if (insertError) {
        console.error('Failed to insert vpn_keys row:', insertError);
        throw new Error('VPN_PROVISIONING_FAILED: could not save VPN key');
      }
    }
  }
}

/**
 * Create an order:
 *  - calls Postgres function create_order(...)
 *  - provisions VPN keys for any items whose VARIANT has vpn_plan_id
 *  - fetches full order with items + credentials afterwards
 *  - sends emails for:
 *      • INSTANT products whose variant stock hits zero
 *      • MANUAL products (admin notification)
 */
export async function createOrderForUser(
  payload: PurchasePayload
): Promise<OrderView> {
  const supabase = getServiceSupabaseClient();

  const quantity =
    Number.isFinite(payload.quantity) && payload.quantity > 0
      ? payload.quantity
      : 1;

  const { data, error } = await supabase.rpc('create_order', {
    p_user_id: payload.userId,
    p_product_id: payload.productId,
    p_variant_id: payload.variantId || null,
    p_quantity: quantity,
    p_manual_input: payload.manualInput ?? null,
  });

  if (error) {
    throw new Error(normaliseErrorMessage(error.message ?? String(error)));
  }

  const raw = data as { order_id?: string; id?: string } | string | null;
  const orderId =
    typeof raw === 'string' ? raw : raw?.order_id ?? raw?.id ?? null;

  if (!orderId) {
    throw new Error('Failed to create order.');
  }

  // === VPN: provision Outline keys for any VPN variants in this order ===
  try {
    await provisionVpnKeysForOrder(orderId, payload.userId);
  } catch (e: any) {
    console.error('Failed to provision VPN keys for order:', e);
    throw new Error(
      normaliseErrorMessage(e?.message ?? 'VPN_PROVISIONING_FAILED')
    );
  }

  // Load full order view (items + credentials + vpn info)
  const order = await getOrderById(orderId);

  // === STOCK ALERT: INSTANT variants that hit zero (unchanged) ===
  try {
    const { data: orderItemRows } = await supabase
      .from('order_items')
      .select('product_id,variant_id,product_type,product_name,variant_name')
      .eq('order_id', orderId);

    const orderItemArray: any[] = (orderItemRows ?? []) as any[];

    const instantRows = orderItemArray.filter((row: any) => {
      const type = String(row.product_type || '').toUpperCase();
      return type === 'INSTANT' && row.product_id;
    });

    if (instantRows.length > 0) {
      type SoldVariant = {
        productId: string;
        variantId: string | null;
        productName: string;
        variantName: string | null;
      };

      const soldVariants: SoldVariant[] = instantRows.map((r: any) => ({
        productId: String(r.product_id),
        variantId: r.variant_id != null ? String(r.variant_id) : null,
        productName: r.product_name || 'Unknown product',
        variantName: r.variant_name ?? null,
      }));

      const productIds = Array.from(
        new Set(soldVariants.map((v) => v.productId))
      );

      const { data: inventoryRows } = await supabase
        .from('inventory_items')
        .select('product_id,variant_id,order_item_id')
        .in('product_id', productIds);

      const remainingByKey: Record<string, number> = {};
      for (const row of (inventoryRows ?? []) as any[]) {
        const pid = row.product_id ? String(row.product_id) : null;
        const vid = row.variant_id != null ? String(row.variant_id) : null;
        if (!pid) continue;

        const key = `${pid}::${vid ?? 'novar'}`;

        if (!row.order_item_id) {
          remainingByKey[key] = (remainingByKey[key] ?? 0) + 1;
        }
      }

      const admins = getAdminRecipients();
      if (admins.length > 0) {
        const alreadyAlerted = new Set<string>();

        for (const v of soldVariants) {
          const key = `${v.productId}::${v.variantId ?? 'novar'}`;
          if (alreadyAlerted.has(key)) continue;

          const remaining = remainingByKey[key] ?? 0;
          if (remaining === 0) {
            alreadyAlerted.add(key);

            const label = v.variantName
              ? `${v.productName} – ${v.variantName}`
              : v.productName;

            const { subject, text, html } = tplStockDepletedAdmin(
              label,
              v.productId
            );

            await sendEmail({
              to: admins,
              subject,
              text,
              html,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to send stock depleted admin alerts:', e);
  }

  // === Existing: admin email for MANUAL products ===
  try {
    // Only "real" manual items:
    //  - type is MANUAL
    //  - and they do NOT have a VPN key (vpnSsUri)
    const manualItems = order.items.filter((item) => {
      const type = String(item.productType || '').toUpperCase();
      const hasVpnKey =
        !!item.vpnSsUri ||
        (Array.isArray(item.vpnKeys) && item.vpnKeys.length > 0);
      return type === 'MANUAL' && !hasVpnKey;
    });

    if (manualItems.length > 0) {
      const { data: userRow } = await supabase
        .from('users')
        .select('email,name')
        .eq('id', payload.userId)
        .maybeSingle();

      const userEmail: string = (userRow as any)?.email ?? '';
      const userName: string = (userRow as any)?.name ?? '';

      const admins = getAdminRecipients();
      if (admins.length > 0) {
        const productSummary = manualItems
          .map((item) => {
            const variantPart = item.variantName
              ? ` (${item.variantName})`
              : '';
            return `• ${item.productName}${variantPart} x${item.quantity}`;
          })
          .join('<br/>');

        const html = `
          <div style="font-family:system-ui,Segoe UI,Arial;">
            <h2>New manual order received</h2>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>User:</strong> ${
              userEmail || payload.userId
            }${userName ? ` (${userName})` : ''}</p>
            <p><strong>Total amount:</strong> ${order.totalAmount.toLocaleString()} MMK</p>
            <p><strong>Manual items:</strong></p>
            <p>${productSummary}</p>
            <p>Sign in to the admin panel to view full details and deliver the order.</p>
          </div>
        `;

        const textLines = [
          `New manual order received`,
          `Order ID: ${order.id}`,
          `User: ${userEmail || payload.userId}${
            userName ? ` (${userName})` : ''
          }`,
          `Total amount: ${order.totalAmount}`,
          `Manual items:`,
          ...manualItems.map(
            (item) =>
              `- ${item.productName}${
                item.variantName ? ` (${item.variantName})` : ''
              } x${item.quantity}`
          ),
        ];
        const text = textLines.join('\n');

        await sendEmail({
          to: admins,
          subject: `New manual order received (${order.id})`,
          text,
          html,
        });
      }
    }
  } catch (e) {
    console.error('Failed to send manual order admin email:', e);
  }

  // === TELEGRAM: notify admin about manual orders ===
  try {
    const manualItems = order.items.filter((item) => {
      const type = String(item.productType || '').toUpperCase();
      const hasVpnKey =
        !!item.vpnSsUri ||
        (Array.isArray(item.vpnKeys) && item.vpnKeys.length > 0);
      return type === 'MANUAL' && !hasVpnKey;
    });

    if (manualItems.length > 0) {
      const { data: userRow2 } = await supabase
        .from('users')
        .select('email')
        .eq('id', payload.userId)
        .maybeSingle();

      const tgUserEmail: string = (userRow2 as any)?.email ?? payload.userId;

      for (const item of manualItems) {
        await notifyNewManualOrder({
          orderId: order.id,
          userEmail: tgUserEmail,
          productName: item.productName,
          variantName: item.variantName,
          totalAmount: order.totalAmount,
          manualInput: item.manualInput,
        });
      }
    }
  } catch (e) {
    console.error('Failed to send Telegram manual order notification:', e);
  }

  return order;
}

/**
 * Get a single order (for e.g. /orders/[id] page if you add one)
 */
export async function getOrderById(orderId: string): Promise<OrderView> {
  const supabase = getServiceSupabaseClient();

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('id,user_id,total_amount,status,created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!orderRow) {
    throw new Error('Order not found');
  }

  const userId = (orderRow as any).user_id as string | null;

  // Optional: refresh usage for this user as well (for /orders/[id] style page)
  if (userId) {
    try {
      await refreshVpnUsageForUser(userId);
    } catch (err) {
      console.warn('getOrderById: refreshVpnUsageForUser failed:', err);
    }
  }

  // 2) Items
  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select(
      'id,order_id,product_id,variant_id,quantity,unit_price,product_name,variant_name,product_type,manual_input'
    )
    .eq('order_id', orderId);

  if (itemError) throw itemError;

  const items = (itemRows ?? []) as any[];
  const itemIds = items.map((i) => i.id as string);

  // Credentials
  let credsByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    const { data: credRows, error: credError } = await supabase
      .from('inventory_items')
      .select('id,order_item_id,payload')
      .in('order_item_id', itemIds);

    if (credError) throw credError;

    credsByItem = {};
    for (const row of (credRows ?? []) as any[]) {
      if (!row.order_item_id) continue;
      if (!credsByItem[row.order_item_id]) {
        credsByItem[row.order_item_id] = [];
      }
      credsByItem[row.order_item_id]!.push(row.payload);
    }
  }

  // VPN keys (group all keys per item)
  let vpnByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    const { data: vpnRows, error: vpnError } = await supabase
      .from('vpn_keys')
      .select(
        'id,order_item_id,country,plan_name,expires_at,data_limit_bytes,used_bytes,ss_uri'
      )
      .in('order_item_id', itemIds);

    if (vpnError) throw vpnError;

    vpnByItem = {};
    for (const row of (vpnRows ?? []) as any[]) {
      if (!row.order_item_id) continue;
      const key = row.order_item_id;
      if (!vpnByItem[key]) vpnByItem[key] = [];
      vpnByItem[key].push(row);
    }
  }

  const viewItems: OrderItemView[] = items.map((item: any) => {
    const vpnRowsForItem = vpnByItem[item.id] ?? [];
    const primaryVpn = vpnRowsForItem[0] || null;

    const vpnKeys: VpnKeyView[] = vpnRowsForItem.map((vpnRow: any) => ({
      id: vpnRow.id,
      country: vpnRow.country ?? null,
      planName: vpnRow.plan_name ?? null,
      expiresAt: vpnRow.expires_at ?? null,
      dataLimitBytes:
        typeof vpnRow.data_limit_bytes === 'number'
          ? vpnRow.data_limit_bytes
          : vpnRow.data_limit_bytes != null
          ? Number(vpnRow.data_limit_bytes)
          : null,
      usedBytes:
        typeof vpnRow.used_bytes === 'number'
          ? vpnRow.used_bytes
          : vpnRow.used_bytes != null
          ? Number(vpnRow.used_bytes)
          : null,
      ssUri: vpnRow.ss_uri ?? null,
    }));

    return {
      id: item.id,
      productName: item.product_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      productType: item.product_type,
      manualInput: (item.manual_input ?? null) as
        | Record<string, string>
        | null,
      credentials: credsByItem[item.id] ?? [],

      vpnCountry: primaryVpn?.country ?? null,
      vpnPlanName: primaryVpn?.plan_name ?? null,
      vpnExpiresAt: primaryVpn?.expires_at ?? null,
      vpnDataLimitBytes:
        primaryVpn?.data_limit_bytes != null
          ? Number(primaryVpn.data_limit_bytes)
          : null,
      vpnUsedBytes:
        primaryVpn?.used_bytes != null
          ? Number(primaryVpn.used_bytes)
          : null,
      vpnSsUri: primaryVpn?.ss_uri ?? null,
      vpnKeys: vpnKeys,
    };
  });

  return {
    id: (orderRow as any).id,
    createdAt: (orderRow as any).created_at,
    status: (orderRow as any).status,
    totalAmount: Number((orderRow as any).total_amount),
    items: viewItems,
  };
}

/**
 * List all orders for a user – for /orders page.
 */
export async function listOrdersForUser(
  userId: string
): Promise<OrderView[]> {
  const supabase = getServiceSupabaseClient();

  // First, refresh VPN usage for this user (best-effort; don't throw on failure)
  try {
    await refreshVpnUsageForUser(userId);
  } catch (err) {
    console.warn('listOrdersForUser: refreshVpnUsageForUser failed:', err);
  }

  const { data: orderRows, error: orderError } = await supabase
    .from('orders')
    .select('id,user_id,total_amount,status,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (orderError) throw orderError;
  const orders = (orderRows ?? []) as any[];
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id as string);

  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select(
      'id,order_id,product_id,variant_id,quantity,unit_price,product_name,variant_name,product_type,manual_input'
    )
    .in('order_id', orderIds);

  if (itemError) throw itemError;
  const items = (itemRows ?? []) as any[];
  const itemIds = items.map((i) => i.id as string);

  // Credentials
  let credsByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    const { data: credRows, error: credError } = await supabase
      .from('inventory_items')
      .select('id,order_item_id,payload')
      .in('order_item_id', itemIds);

    if (credError) throw credError;

    credsByItem = {};
    for (const row of (credRows ?? []) as any[]) {
      if (!row.order_item_id) continue;
      if (!credsByItem[row.order_item_id]) {
        credsByItem[row.order_item_id] = [];
      }
      credsByItem[row.order_item_id]!.push(row.payload);
    }
  }

  // VPN keys
  let vpnByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    const { data: vpnRows, error: vpnError } = await supabase
      .from('vpn_keys')
      .select(
        'id,order_item_id,country,plan_name,expires_at,data_limit_bytes,used_bytes,ss_uri'
      )
      .in('order_item_id', itemIds);

    if (vpnError) throw vpnError;

    vpnByItem = {};
    for (const row of (vpnRows ?? []) as any[]) {
      if (!row.order_item_id) continue;
      const key = row.order_item_id;
      if (!vpnByItem[key]) vpnByItem[key] = [];
      vpnByItem[key].push(row);
    }
  }

  const itemsByOrder: Record<string, OrderItemView[]> = {};
  for (const item of items as any[]) {
    const vpnRowsForItem = vpnByItem[item.id] ?? [];
    const primaryVpn = vpnRowsForItem[0] || null;

    const vpnKeys: VpnKeyView[] = vpnRowsForItem.map((vpnRow: any) => ({
      id: vpnRow.id,
      country: vpnRow.country ?? null,
      planName: vpnRow.plan_name ?? null,
      expiresAt: vpnRow.expires_at ?? null,
      dataLimitBytes:
        typeof vpnRow.data_limit_bytes === 'number'
          ? vpnRow.data_limit_bytes
          : vpnRow.data_limit_bytes != null
          ? Number(vpnRow.data_limit_bytes)
          : null,
      usedBytes:
        typeof vpnRow.used_bytes === 'number'
          ? vpnRow.used_bytes
          : vpnRow.used_bytes != null
          ? Number(vpnRow.used_bytes)
          : null,
      ssUri: vpnRow.ss_uri ?? null,
    }));

    const view: OrderItemView = {
      id: item.id,
      productName: item.product_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      productType: item.product_type,
      manualInput: (item.manual_input ?? null) as
        | Record<string, string>
        | null,
      credentials: credsByItem[item.id] ?? [],

      vpnCountry: primaryVpn?.country ?? null,
      vpnPlanName: primaryVpn?.plan_name ?? null,
      vpnExpiresAt: primaryVpn?.expires_at ?? null,
      vpnDataLimitBytes:
        primaryVpn?.data_limit_bytes != null
          ? Number(primaryVpn.data_limit_bytes)
          : null,
      vpnUsedBytes:
        primaryVpn?.used_bytes != null
          ? Number(primaryVpn.used_bytes)
          : null,
      vpnSsUri: primaryVpn?.ss_uri ?? null,
      vpnKeys,
    };
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(view);
  }

  const result: OrderView[] = orders.map((order: any) => ({
    id: order.id,
    createdAt: order.created_at,
    status: order.status,
    totalAmount: Number(order.total_amount),
    items: itemsByOrder[order.id] ?? [],
  }));

  return result;
}

export type PagedOrders = {
  orders: OrderView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Paginated version of listOrdersForUser. Fetches ONE page of orders
 * (plus their items/credentials/VPN keys), staying fast even with hundreds of orders.
 */
export async function listOrdersForUserPaged(
  userId: string,
  page = 1,
  pageSize = 15
): Promise<PagedOrders> {
  const supabase = getServiceSupabaseClient();

  // NOTE: We intentionally do NOT call refreshVpnUsageForUser here.
  // That function makes external HTTP calls to VPN servers on every page
  // load, which was the main cause of slow order-page loads. VPN usage is
  // refreshed elsewhere (e.g. when opening a single order), so the list
  // stays fast. Displayed usage may be slightly stale until then.

  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.max(1, Math.min(50, Math.floor(pageSize) || 15));

  // The custom Supabase client has no count/range support — only limit.
  // Fetch the lightweight order list (id/status/total/date only), then
  // slice the current page in JS. This is cheap because we DON'T load
  // items/credentials/VPN here — only for the 15 orders on this page.
  const { data: allOrderRows, error: listError } = await supabase
    .from('orders')
    .select('id,user_id,total_amount,status,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (listError) throw listError;
  const allOrders = (allOrderRows ?? []) as any[];
  const total = allOrders.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));

  const from = (safePage - 1) * safeSize;
  const orders = allOrders.slice(from, from + safeSize);

  if (orders.length === 0) {
    return { orders: [], total, page: safePage, pageSize: safeSize, totalPages };
  }

  const orderIds = orders.map((o) => o.id as string);

  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select(
      'id,order_id,product_id,variant_id,quantity,unit_price,product_name,variant_name,product_type,manual_input'
    )
    .in('order_id', orderIds);

  if (itemError) throw itemError;
  const items = (itemRows ?? []) as any[];
  const itemIds = items.map((i) => i.id as string);

  let credsByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    const { data: credRows, error: credError } = await supabase
      .from('inventory_items')
      .select('id,order_item_id,payload')
      .in('order_item_id', itemIds);
    if (credError) throw credError;
    for (const row of (credRows ?? []) as any[]) {
      if (!row.order_item_id) continue;
      if (!credsByItem[row.order_item_id]) credsByItem[row.order_item_id] = [];
      credsByItem[row.order_item_id]!.push(row.payload);
    }
  }

  let vpnByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    const { data: vpnRows, error: vpnError } = await supabase
      .from('vpn_keys')
      .select('id,order_item_id,country,plan_name,expires_at,data_limit_bytes,used_bytes,ss_uri')
      .in('order_item_id', itemIds);
    if (vpnError) throw vpnError;
    for (const row of (vpnRows ?? []) as any[]) {
      if (!row.order_item_id) continue;
      if (!vpnByItem[row.order_item_id]) vpnByItem[row.order_item_id] = [];
      vpnByItem[row.order_item_id].push(row);
    }
  }

  const itemsByOrder: Record<string, OrderItemView[]> = {};
  for (const item of items as any[]) {
    const vpnRowsForItem = vpnByItem[item.id] ?? [];
    const primaryVpn = vpnRowsForItem[0] || null;

    const vpnKeys: VpnKeyView[] = vpnRowsForItem.map((vpnRow: any) => ({
      id: vpnRow.id,
      country: vpnRow.country ?? null,
      planName: vpnRow.plan_name ?? null,
      expiresAt: vpnRow.expires_at ?? null,
      dataLimitBytes:
        typeof vpnRow.data_limit_bytes === 'number'
          ? vpnRow.data_limit_bytes
          : vpnRow.data_limit_bytes != null
          ? Number(vpnRow.data_limit_bytes)
          : null,
      usedBytes:
        typeof vpnRow.used_bytes === 'number'
          ? vpnRow.used_bytes
          : vpnRow.used_bytes != null
          ? Number(vpnRow.used_bytes)
          : null,
      ssUri: vpnRow.ss_uri ?? null,
    }));

    const view: OrderItemView = {
      id: item.id,
      productName: item.product_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      productType: item.product_type,
      manualInput: (item.manual_input ?? null) as Record<string, string> | null,
      credentials: credsByItem[item.id] ?? [],
      vpnCountry: primaryVpn?.country ?? null,
      vpnPlanName: primaryVpn?.plan_name ?? null,
      vpnExpiresAt: primaryVpn?.expires_at ?? null,
      vpnDataLimitBytes: primaryVpn?.data_limit_bytes != null ? Number(primaryVpn.data_limit_bytes) : null,
      vpnUsedBytes: primaryVpn?.used_bytes != null ? Number(primaryVpn.used_bytes) : null,
      vpnSsUri: primaryVpn?.ss_uri ?? null,
      vpnKeys,
    };
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(view);
  }

  const pagedOrders: OrderView[] = orders.map((order: any) => ({
    id: order.id,
    createdAt: order.created_at,
    status: order.status,
    totalAmount: Number(order.total_amount),
    items: itemsByOrder[order.id] ?? [],
  }));

  return { orders: pagedOrders, total, page: safePage, pageSize: safeSize, totalPages };
}

export type PendingManualDelivery = {
  orderItemId: string;
  orderId: string;
  createdAt: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  manualInput: Record<string, string> | null;
  userEmail: string | null;
};

/**
 * Admin dashboard: manual order items that still need a credential
 * delivered (product_type = MANUAL and no inventory_items row attached
 * yet). Used to power the "needs delivery" queue on the admin home page.
 */
export type AdminSalesStats = {
  today: { amount: number; count: number };
  week: { amount: number; count: number };
  month: { amount: number; count: number };
};

/**
 * Sales stats for the admin dashboard. Counts ONLY completed orders,
 * using calendar periods in the given timezone (defaults to Asia/Yangon):
 *   - today  = since local midnight today
 *   - week   = since Monday of the current week
 *   - month  = since the 1st of the current month
 */
export async function getAdminSalesStats(timeZone = 'Asia/Yangon'): Promise<AdminSalesStats> {
  const supabase = getServiceSupabaseClient();

  // Determine the current local date parts in the target timezone.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const weekdayShort = get('weekday'); // Mon, Tue, ...

  // Offset (in ms) between the target timezone and UTC right now.
  // Used to convert a local wall-clock midnight into a UTC instant.
  const asUTC = Date.UTC(year, month - 1, day, 0, 0, 0);
  const localMidnightGuess = new Date(
    now.toLocaleString('en-US', { timeZone })
  );
  const tzOffsetMs = now.getTime() - localMidnightGuess.getTime();

  // Local midnight today -> UTC instant
  const startOfToday = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + tzOffsetMs);

  // Start of week (Monday). Compute how many days back Monday is.
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort);
  const daysSinceMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  const startOfWeek = new Date(startOfToday.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);

  // Start of month (1st, local midnight) -> UTC instant
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) + tzOffsetMs);

  // Fetch completed orders since the start of the month (covers all three windows).
  const { data: rows, error } = await supabase
    .from('orders')
    .select('total_amount,status,created_at')
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;
  const orders = (rows ?? []) as any[];

  const stats: AdminSalesStats = {
    today: { amount: 0, count: 0 },
    week: { amount: 0, count: 0 },
    month: { amount: 0, count: 0 },
  };

  const tMonth = startOfMonth.getTime();
  const tWeek = startOfWeek.getTime();
  const tToday = startOfToday.getTime();

  for (const o of orders) {
    const created = new Date(o.created_at).getTime();
    if (Number.isNaN(created)) continue;
    const amt = Number(o.total_amount) || 0;

    if (created >= tMonth) {
      stats.month.amount += amt;
      stats.month.count += 1;
    }
    if (created >= tWeek) {
      stats.week.amount += amt;
      stats.week.count += 1;
    }
    if (created >= tToday) {
      stats.today.amount += amt;
      stats.today.count += 1;
    }
  }

  return stats;
}

export async function listPendingManualDeliveries(limit = 50): Promise<PendingManualDelivery[]> {
  const supabase = getServiceSupabaseClient();

  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select('id,order_id,variant_id,product_name,variant_name,quantity,manual_input,product_type,created_at')
    .eq('product_type', 'MANUAL')
    .order('created_at', { ascending: false })
    .limit(500);

  if (itemError) throw itemError;
  const allItems = (itemRows ?? []) as any[];
  if (allItems.length === 0) return [];

  // Exclude VPN items — these are auto-delivered via the Outline API,
  // not true manual deliveries. VPN items have a variant with vpn_plan_id set.
  const variantIds = Array.from(
    new Set(allItems.map((i) => i.variant_id).filter(Boolean))
  ) as string[];

  const vpnVariantIds = new Set<string>();
  if (variantIds.length > 0) {
    const { data: variantRows, error: variantError } = await supabase
      .from('product_variants')
      .select('id,vpn_plan_id')
      .in('id', variantIds);
    if (variantError) throw variantError;
    for (const v of (variantRows ?? []) as any[]) {
      if (v.vpn_plan_id) vpnVariantIds.add(v.id);
    }
  }

  const items = allItems.filter((i) => !i.variant_id || !vpnVariantIds.has(i.variant_id));
  if (items.length === 0) return [];

  const itemIds = items.map((i) => i.id as string);

  const { data: credRows, error: credError } = await supabase
    .from('inventory_items')
    .select('order_item_id')
    .in('order_item_id', itemIds);
  if (credError) throw credError;

  const delivered = new Set(
    ((credRows ?? []) as any[]).map((r) => r.order_item_id).filter(Boolean)
  );

  const pendingItems = items.filter((i) => !delivered.has(i.id)).slice(0, limit);
  if (pendingItems.length === 0) return [];

  const orderIds = Array.from(new Set(pendingItems.map((i) => i.order_id as string)));
  const { data: orderRows, error: orderError } = await supabase
    .from('orders')
    .select('id,user_id')
    .in('id', orderIds);
  if (orderError) throw orderError;

  const orderById: Record<string, any> = {};
  for (const o of (orderRows ?? []) as any[]) orderById[o.id] = o;

  const userIds = Array.from(
    new Set(Object.values(orderById).map((o: any) => o.user_id).filter(Boolean))
  );

  let userById: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: userRows, error: userError } = await supabase
      .from('users')
      .select('id,email')
      .in('id', userIds);
    if (userError) throw userError;
    for (const u of (userRows ?? []) as any[]) userById[u.id] = u;
  }

  return pendingItems.map((item) => {
    const order = orderById[item.order_id];
    const user = order ? userById[order.user_id] : null;
    return {
      orderItemId: item.id,
      orderId: item.order_id,
      createdAt: item.created_at,
      productName: item.product_name,
      variantName: item.variant_name ?? null,
      quantity: item.quantity,
      manualInput: (item.manual_input ?? null) as Record<string, string> | null,
      userEmail: user?.email ?? null,
    };
  });
}

/**
 * Admin: list orders with optional filters by orderId or userEmail
 */
export async function listOrdersForAdmin(opts: {
  userEmail?: string;
  orderId?: string;
} = {}): Promise<OrderView[]> {
  const supabase = getServiceSupabaseClient();

  // Prevent huge "in.(...)" URLs from crashing PostgREST
  const ADMIN_ORDERS_LIMIT = 50;
  const IN_CHUNK_SIZE = 50;

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  let userIdFilter: string | null = null;

  if (opts.userEmail) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id,email')
      .eq('email', opts.userEmail)
      .maybeSingle();

    if (!userRow) {
      return [];
    }
    userIdFilter = (userRow as any).id;
  }

  let orderQuery = supabase
    .from('orders')
    .select('id,user_id,total_amount,status,created_at')
    .order('created_at', { ascending: false })
    .limit(ADMIN_ORDERS_LIMIT);

  if (opts.orderId) {
    orderQuery = orderQuery.eq('id', opts.orderId);
  }

  if (userIdFilter) {
    orderQuery = orderQuery.eq('user_id', userIdFilter);
  }

  const { data: orderRows, error: orderError } = await orderQuery;

  if (orderError) throw orderError;
  const orders = (orderRows ?? []) as any[];
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id as string);

  // --- order_items (chunked) ---
  let items: any[] = [];
  for (const ids of chunk(orderIds, IN_CHUNK_SIZE)) {
    const { data: itemRows, error: itemError } = await supabase
      .from('order_items')
      .select(
        'id,order_id,product_id,variant_id,quantity,unit_price,product_name,variant_name,product_type,manual_input'
      )
      .in('order_id', ids);

    if (itemError) throw itemError;
    items = items.concat((itemRows ?? []) as any[]);
  }

  const itemIds = items.map((i) => i.id as string);

  // Credentials (chunked)
  let credsByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    credsByItem = {};
    for (const ids of chunk(itemIds, IN_CHUNK_SIZE)) {
      const { data: credRows, error: credError } = await supabase
        .from('inventory_items')
        .select('id,order_item_id,payload')
        .in('order_item_id', ids);

      if (credError) throw credError;

      for (const row of (credRows ?? []) as any[]) {
        if (!row.order_item_id) continue;
        if (!credsByItem[row.order_item_id]) {
          credsByItem[row.order_item_id] = [];
        }
        credsByItem[row.order_item_id]!.push(row.payload);
      }
    }
  }

  // VPN keys (chunked)
  let vpnByItem: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    vpnByItem = {};
    for (const ids of chunk(itemIds, IN_CHUNK_SIZE)) {
      const { data: vpnRows, error: vpnError } = await supabase
        .from('vpn_keys')
        .select(
          'id,order_item_id,country,plan_name,expires_at,data_limit_bytes,used_bytes,ss_uri'
        )
        .in('order_item_id', ids);

      if (vpnError) throw vpnError;

      for (const row of (vpnRows ?? []) as any[]) {
        if (!row.order_item_id) continue;
        const key = row.order_item_id;
        if (!vpnByItem[key]) vpnByItem[key] = [];
        vpnByItem[key].push(row);
      }
    }
  }

  const itemsByOrder: Record<string, OrderItemView[]> = {};
  for (const item of items as any[]) {
    const vpnRowsForItem = vpnByItem[item.id] ?? [];
    const primaryVpn = vpnRowsForItem[0] || null;

    const vpnKeys: VpnKeyView[] = vpnRowsForItem.map((vpnRow: any) => ({
      id: vpnRow.id,
      country: vpnRow.country ?? null,
      planName: vpnRow.plan_name ?? null,
      expiresAt: vpnRow.expires_at ?? null,
      dataLimitBytes:
        typeof vpnRow.data_limit_bytes === 'number'
          ? vpnRow.data_limit_bytes
          : vpnRow.data_limit_bytes != null
          ? Number(vpnRow.data_limit_bytes)
          : null,
      usedBytes:
        typeof vpnRow.used_bytes === 'number'
          ? vpnRow.used_bytes
          : vpnRow.used_bytes != null
          ? Number(vpnRow.used_bytes)
          : null,
      ssUri: vpnRow.ss_uri ?? null,
    }));

    const view: OrderItemView = {
      id: item.id,
      productName: item.product_name,
      variantName: item.variant_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      productType: item.product_type,
      manualInput: (item.manual_input ?? null) as
        | Record<string, string>
        | null,
      credentials: credsByItem[item.id] ?? [],

      vpnCountry: primaryVpn?.country ?? null,
      vpnPlanName: primaryVpn?.plan_name ?? null,
      vpnExpiresAt: primaryVpn?.expires_at ?? null,
      vpnDataLimitBytes:
        primaryVpn?.data_limit_bytes != null
          ? Number(primaryVpn.data_limit_bytes)
          : null,
      vpnUsedBytes:
        primaryVpn?.used_bytes != null
          ? Number(primaryVpn.used_bytes)
          : null,
      vpnSsUri: primaryVpn?.ss_uri ?? null,
      vpnKeys,
    };

    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(view);
  }

  const result: OrderView[] = orders.map((order: any) => ({
    id: order.id,
    createdAt: order.created_at,
    status: order.status,
    totalAmount: Number(order.total_amount),
    items: itemsByOrder[order.id] ?? [],
  }));

  return result;
}
