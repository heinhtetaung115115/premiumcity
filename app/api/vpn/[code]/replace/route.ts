// app/api/vpn/[code]/replace/route.ts
// "Request new key / လိုင်းမကောင်းပါ" — public (link-based), max 3 per 30 days.

import { NextResponse } from 'next/server';
import { customerRequestNewKey } from '@/lib/vpn';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function ipOf(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export async function POST(req: Request, { params }: { params: { code: string } }) {
  // Stop people hammering random codes or one link.
  const rl = await checkRateLimit({
    key: ipOf(req),
    route: 'vpn-replace',
    windowInSeconds: 10 * 60,
    maxRequests: 10,
  });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many tries. Please wait a few minutes.' }, { status: 429 });
  }

  const res = await customerRequestNewKey(params.code);
  if (!res.ok) {
    const status = res.error === 'limit' ? 429 : 400;
    return NextResponse.json(res, { status });
  }
  return NextResponse.json(res);
}
