// GET /api/account-panel?orderItemId=…[&codes=1]
// Store Orders page: the customer's shared-account details (Crunchyroll…)
// delivered from the account panel, plus allowed login emails on request.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getOrderPanelView } from '@/lib/panel/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authConfig);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
    const url = new URL(req.url);
    const orderItemId = url.searchParams.get('orderItemId') || '';
    if (!orderItemId) return NextResponse.json({ error: 'Missing order item.' }, { status: 400 });
    const res = await getOrderPanelView(orderItemId, userId, url.searchParams.get('codes') === '1');
    if (res.status !== 200) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res.view, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[account-panel] failed', e);
    return NextResponse.json({ error: 'Could not load the account. Please try again.' }, { status: 500 });
  }
}
