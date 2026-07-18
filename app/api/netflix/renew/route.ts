// app/api/netflix/renew/route.ts
// GET  -> renewal plans (variants + prices) for this account, or "expired"
// POST -> submit a renewal: debit wallet, create pending request, notify admin

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { getRenewalPlans, submitRenewal } from '@/lib/netflixRenewal';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const orderItemId = new URL(req.url).searchParams.get('orderItemId') ?? '';
  if (!orderItemId) return NextResponse.json({ error: 'missing orderItemId' }, { status: 400 });

  const result = await getRenewalPlans(orderItemId, userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({
    plans: result.plans ?? [],
    expired: !!result.expired,
    endDate: result.endDate ?? null,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const orderItemId = String(body?.orderItemId ?? '');
  const variantId = String(body?.variantId ?? '');
  if (!orderItemId || !variantId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  const result = await submitRenewal({ orderItemId, userId, variantId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Notify admin (Telegram + in-app admin task already recorded as the row).
  try {
    const supabase = getServiceSupabaseClient();
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    await sendTelegramMessage({
      text:
        `🔁 <b>Netflix renewal requested</b>\n\n` +
        `User: ${(user as any)?.email ?? userId}\n` +
        `Plan: ${result.planName}\n` +
        `Charged: ${Number(result.price).toLocaleString()} Ks (held)\n\n` +
        `Extend with your supplier, then Approve. Reject auto-refunds.\n` +
        `👉 /admin/renewals`,
    });
  } catch (err) {
    console.error('[netflix/renew] telegram failed:', err);
  }

  return NextResponse.json({ ok: true });
}
