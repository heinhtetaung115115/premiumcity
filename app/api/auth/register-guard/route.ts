// app/api/auth/register-guard/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const turnstileToken: string | undefined =
      body?.turnstileToken || body?.token || body?.cf_turnstile_response;

    const emailRaw: string | undefined = body?.email;
    const email = (emailRaw || '').toLowerCase().trim() || 'unknown';

    if (!turnstileToken) {
      console.warn('[register-guard] missing Turnstile token for email:', email);
      return NextResponse.json(
        { error: 'Security check failed. Please refresh the page and try again.' },
        { status: 400 }
      );
    }

    const realIp =
      request.headers.get('cf-connecting-ip')?.trim() ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      undefined;

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error(
        '[register-guard] TURNSTILE_SECRET_KEY is not set in environment variables'
      );
      return NextResponse.json(
        { error: 'Server configuration error. Please try again later.' },
        { status: 500 }
      );
    }

    // Verify token with Cloudflare Turnstile
    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: turnstileToken,
          ...(realIp ? { remoteip: realIp } : {}),
        }),
      }
    );

    const verifyData: any = await verifyRes.json().catch(() => null);

    if (!verifyData?.success) {
      console.warn('[register-guard] Turnstile failed for email:', email, verifyData);
      return NextResponse.json(
        { error: 'Security check failed. Please try again.' },
        { status: 400 }
      );
    }

    // Passed Turnstile → allow registration
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[register-guard] unexpected error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
