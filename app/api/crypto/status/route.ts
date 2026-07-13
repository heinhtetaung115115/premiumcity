// app/api/crypto/status/route.ts
// Polled by the payment page so it can flip to "credited" without a refresh.
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getCryptoTopupById } from '@/lib/cryptoTopup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireAuth();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  // Scoped to the signed-in user — you can't poll someone else's top-up.
  const row = await getCryptoTopupById(id, session.user.id as string);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    status: row.status,
    credited: row.credited,
    mmk: Number(row.mmk_amount),
  });
}
