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

export async function GET(req: Request) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

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
  const { data: inv } = await supabase
    .from('inventory_items')
    .select('payload,order_item_id')
    .eq('order_item_id', orderItemId)
    .maybeSingle();

  const payload: any = (inv as any)?.payload;
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
  });
}
