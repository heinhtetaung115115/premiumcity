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

    const rl = await checkRateLimit({
      key: ip,
      route: 'login',
      windowInSeconds: 10 * 60,   // 10 minutes
      maxRequests: 200,           // 🔥 Increased from 5 → 200
    });

    console.log('[login-guard] rate limit result:', rl);

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
