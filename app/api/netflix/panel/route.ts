// app/api/netflix/panel/route.ts
// Returns the LIVE Netflix panel (email, password, PIN, expiry, codes) for an
// order item the signed-in user actually owns.
//
// OWNERSHIP IS THE SECURITY BOUNDARY: we look up the supplier link from the
// inventory row, then verify the parent order belongs to the caller. The link
// itself is NEVER returned to the browser — only the resolved account data —
// so a customer cannot lift another customer's link, nor even their own raw
// link.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { fetchNetflixPanel } from '@/lib/netflix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Supplier call is limited to ~16s (8s + one retry); leave headroom.
export const maxDuration = 30;

export async function GET(req: Request) {
  // Always answer with JSON so the customer sees a real reason, never a blank error.
  try {
    return await handle(req);
  } catch (e: any) {
    console.error('[netflix/panel] crashed:', e);
    return NextResponse.json({ error: 'Server error while loading the account. Please try again.' }, { status: 500 });
  }
}

async function handle(req: Request) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });

  const url = new URL(req.url);
  const orderItemId = url.searchParams.get('orderItemId') ?? '';
  // Codes are only fetched/returned when the customer explicitly asks (the
  // "Get code" button sends codes=1). A normal page load gets profile only,
  // so codes never reach the browser unrequested and we don't hit the
  // supplier's message endpoint on every order-page view.
  const wantCodes = url.searchParams.get('codes') === '1';
  if (!orderItemId) return NextResponse.json({ error: 'missing orderItemId' }, { status: 400 });

  const supabase = getServiceSupabaseClient();

  // 1) The delivered inventory row for this item.
  // An item can have more than one delivery row (re-delivered / replaced);
  // use the Netflix one instead of failing on "more than one row".
  const { data: invRows } = await supabase
    .from('inventory_items')
    .select('payload,order_item_id')
    .eq('order_item_id', orderItemId)
    .limit(10);

  const netflixRows = ((invRows ?? []) as any[]).filter(
    (r) => r?.payload?.type === 'netflix_panel' && r?.payload?.link
  );
  const payload: any = netflixRows[netflixRows.length - 1]?.payload;
  if (!payload || payload.type !== 'netflix_panel' || !payload.link) {
    return NextResponse.json({ error: 'No Netflix panel for this item.' }, { status: 404 });
  }

  // 2) Verify the caller owns the order this item belongs to.
  const { data: item } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('id', orderItemId)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: order } = await supabase
    .from('orders')
    .select('user_id')
    .eq('id', (item as any).order_id)
    .maybeSingle();

  if (!order || (order as any).user_id !== userId) {
    // Someone else's order — don't confirm existence.
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // 3) Fetch live from the supplier. The raw link never leaves the server.
  const panel = await fetchNetflixPanel(String(payload.link));
  if (!panel.ok) {
    return NextResponse.json({ error: panel.error ?? 'Unavailable.' }, { status: 502 });
  }

  return NextResponse.json({
    profile: panel.profile,
    messages: wantCodes ? panel.messages : [],
    // The admin's note is stored on the delivery payload — pass it through so
    // the customer actually sees it. Fetched on every load (not just codes=1).
    note: typeof payload.note === 'string' && payload.note.trim() ? payload.note : null,
  });
}
