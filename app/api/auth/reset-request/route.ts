// app/api/auth/reset-request/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';

function baseUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return env.replace(/\/$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body.email || '').trim();

    if (!rawEmail) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();

    // ---------- RATE LIMIT (per IP + email) ----------
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    // Use IP + email so users sharing the same IP don't block each other
    const rateLimitKey = `${ip}:${email}`;

    const rl = await checkRateLimit({
      key: rateLimitKey,
      route: 'reset-request',
      windowInSeconds: 60 * 60, // 1 hour
      maxRequests: 5, // up to 5 reset emails per IP+email per hour
      // if you want it higher, e.g. 10: just change to maxRequests: 10,
    });

    console.log('[reset-request] rate limit result:', rl);

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error:
            'Too many reset requests from your connection. Please try again later.',
        },
        {
          status: 429,
          headers: rl.retryAfterSeconds
            ? { 'Retry-After': String(rl.retryAfterSeconds) }
            : undefined,
        }
      );
    }
    // ---------- END RATE LIMIT ----------

    const supabase = getServiceSupabaseClient();

    // 1) Find user
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id,email,name')
      .eq('email', email)
      .maybeSingle();

    // Always return ok to prevent leaking valid emails
    if (userError || !userRow) {
      return NextResponse.json({ ok: true });
    }

    const userId = (userRow as any).id as string;
    const userEmail = ((userRow as any).email as string) || email;
    const userName = ((userRow as any).name as string | null) || null;

    // 2) Create token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Failed to insert reset token:', insertError);
      return NextResponse.json({ ok: true });
    }

    const resetLink = `${baseUrl()}/reset-password?token=${encodeURIComponent(
      token
    )}&email=${encodeURIComponent(userEmail)}`;

    // 3) Send email
    try {
      const safeName = userName || '';
      const subject = 'Reset your Premium City password';

      const html = `
        <div style="font-family:system-ui,Segoe UI,Arial; font-size:14px; line-height:1.5;">
          <h2 style="margin-bottom:8px;">Password reset requested</h2>
          <p>Hi ${safeName || 'there'},</p>
          <p>We received a request to reset the password for your Premium City account.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:8px 14px;border-radius:6px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:600;">
              Reset your password
            </a>
          </p>
          <p>If you did not request this, ignore this email.</p>
          <p style="font-size:12px;color:#6b7280;margin-top:16px;">
            This link will expire in 1 hour for your security.
          </p>
        </div>
      `;

      const text = `Reset your password:
${resetLink}

If you did not request this, you can ignore this email.`;

      await sendEmail({
        to: userEmail,
        subject,
        html,
        text,
      });
    } catch (e) {
      console.error('Failed to send password reset email:', e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-request] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Unable to send reset email. Please try again.' },
      { status: 500 }
    );
  }
}
