// app/api/auth/login-guard/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('cf-connecting-ip')?.trim() ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      'unknown';

    // This is a soft, fast-feedback pre-check for the client only. The
    // authoritative, unbypassable rate limit lives inside authorize() in
    // lib/auth.ts, since this endpoint can simply be skipped by a scripted
    // attacker calling NextAuth's credentials callback directly.
    const rl = await checkRateLimit({
      key: ip,
      route: 'login-guard',
      windowInSeconds: 10 * 60, // 10 minutes
      maxRequests: 30,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error:
            'Too many login attempts from your connection. Please try again later.',
        },
        {
          status: 429,
          headers: rl.retryAfterSeconds
            ? { 'Retry-After': String(rl.retryAfterSeconds) }
            : undefined,
        }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[login-guard] unexpected error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
