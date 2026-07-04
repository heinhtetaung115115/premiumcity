'use server';

import { headers } from 'next/headers';
import { hash, compare } from 'bcryptjs';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { registrationSchema } from '@/utils/validators';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';

function sixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getClientIp(): string {
  try {
    const h = headers();
    const cfIp = h.get('cf-connecting-ip');
    const xff = h.get('x-forwarded-for') || '';
    return (
      cfIp?.trim() ||
      xff.split(',')[0]?.trim() ||
      h.get('x-real-ip')?.trim() ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

/**
 * STEP 1 — Start registration.
 * Validates, stores a pending registration with a hashed 6-digit code,
 * and emails the code. Does NOT create the account yet.
 */
export async function startRegistration(_: unknown, formData: FormData) {
  const result = registrationSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });

  if (!result.success) {
    return { success: false, error: 'Invalid form submission', step: 'form' as const };
  }

  const email = result.data.email.toLowerCase().trim();
  const name = result.data.name;
  const password = result.data.password;
  const realIp = getClientIp();

  // Rate limiting (per email + per IP)
  try {
    const emailRl = await checkRateLimit({
      key: `register:email:${email || 'unknown'}`,
      route: 'register-email',
      windowInSeconds: 60 * 60,
      maxRequests: 5,
    });
    if (!emailRl.allowed) {
      return {
        success: false,
        error: 'Too many attempts for this email. Please try again later.',
        step: 'form' as const,
      };
    }

    const ipRl = await checkRateLimit({
      key: `register:ip:${realIp}`,
      route: 'register-ip',
      windowInSeconds: 60 * 60,
      maxRequests: 30,
    });
    if (!ipRl.allowed) {
      return {
        success: false,
        error: 'Too many registrations from your connection. Please try again later.',
        step: 'form' as const,
      };
    }
  } catch (e) {
    console.error('[startRegistration] rate limit error:', e);
    return { success: false, error: 'Something went wrong. Please try again.', step: 'form' as const };
  }

  const supabase = getServiceSupabaseClient();

  // Already a real account?
  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message, step: 'form' as const };
  }
  if (existing) {
    return { success: false, error: 'Email already registered', step: 'form' as const };
  }

  // Generate + hash the code and password
  const code = sixDigitCode();
  const code_hash = await hash(code, 10);
  const password_hash = await hash(password, 12);
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Upsert pending registration (replace any previous pending for this email)
  await supabase.from('pending_registrations').delete().eq('email', email);

  const { error: insErr } = await supabase.from('pending_registrations').insert({
    email,
    name,
    password_hash,
    code_hash,
    attempts: 0,
    expires_at,
  });

  if (insErr) {
    return { success: false, error: insErr.message, step: 'form' as const };
  }

  // Email the code
  try {
    const { html, text } = tplVerificationCode(name || email, code);
    await sendEmail({
      to: email,
      subject: `Your PremiumCity verification code: ${code}`,
      text,
      html,
    });
  } catch (e) {
    console.error('[startRegistration] email send failed:', e);
    // The row exists; user can resend. Still move to code step.
  }

  return { success: true, error: '', step: 'code' as const, email };
}

/**
 * STEP 2 — Verify the code and create the account.
 */
export async function verifyRegistration(_: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  const code = String(formData.get('code') ?? '').trim();

  if (!email || !/^\d{6}$/.test(code)) {
    return { success: false, error: 'Enter the 6-digit code.', step: 'code' as const, email };
  }

  const supabase = getServiceSupabaseClient();

  const { data: pending, error: pErr } = await supabase
    .from('pending_registrations')
    .select('id,email,name,password_hash,code_hash,attempts,expires_at')
    .eq('email', email)
    .maybeSingle();

  if (pErr) {
    return { success: false, error: pErr.message, step: 'code' as const, email };
  }
  if (!pending) {
    return { success: false, error: 'No pending registration found. Please start again.', step: 'form' as const, email };
  }

  const p = pending as any;

  // Expired?
  if (new Date(p.expires_at).getTime() < Date.now()) {
    await supabase.from('pending_registrations').delete().eq('id', p.id);
    return { success: false, error: 'Code expired. Please register again.', step: 'form' as const, email };
  }

  // Too many attempts?
  if (p.attempts >= 5) {
    await supabase.from('pending_registrations').delete().eq('id', p.id);
    return { success: false, error: 'Too many wrong attempts. Please register again.', step: 'form' as const, email };
  }

  const ok = await compare(code, p.code_hash);
  if (!ok) {
    await supabase
      .from('pending_registrations')
      .update({ attempts: p.attempts + 1 })
      .eq('id', p.id);
    return {
      success: false,
      error: `Incorrect code. ${4 - p.attempts} attempts left.`,
      step: 'code' as const,
      email,
    };
  }

  // Double-check the account still doesn't exist
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    await supabase.from('pending_registrations').delete().eq('id', p.id);
    return { success: false, error: 'Email already registered.', step: 'form' as const, email };
  }

  // Create the account
  const { error: createErr } = await supabase.from('users').insert({
    email: p.email,
    name: p.name,
    password_hash: p.password_hash,
  });

  if (createErr) {
    return { success: false, error: createErr.message, step: 'code' as const, email };
  }

  // Clean up pending row
  await supabase.from('pending_registrations').delete().eq('id', p.id);

  return { success: true, error: '', step: 'done' as const, email };
}

/** Resend the verification code. */
export async function resendCode(_: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  if (!email) {
    return { success: false, error: 'Missing email.', step: 'code' as const, email };
  }

  const realIp = getClientIp();
  try {
    const rl = await checkRateLimit({
      key: `resend:${email}:${realIp}`,
      route: 'register-resend',
      windowInSeconds: 60 * 10,
      maxRequests: 3,
    });
    if (!rl.allowed) {
      return { success: false, error: 'Please wait before requesting another code.', step: 'code' as const, email };
    }
  } catch {
    // continue
  }

  const supabase = getServiceSupabaseClient();
  const { data: pending } = await supabase
    .from('pending_registrations')
    .select('id,name')
    .eq('email', email)
    .maybeSingle();

  if (!pending) {
    return { success: false, error: 'No pending registration. Please start again.', step: 'form' as const, email };
  }

  const code = sixDigitCode();
  const code_hash = await hash(code, 10);
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase
    .from('pending_registrations')
    .update({ code_hash, expires_at, attempts: 0 })
    .eq('id', (pending as any).id);

  try {
    const { html, text } = tplVerificationCode((pending as any).name || email, code);
    await sendEmail({ to: email, subject: `Your PremiumCity verification code: ${code}`, text, html });
  } catch (e) {
    console.error('[resendCode] email failed:', e);
    return { success: false, error: 'Could not send email. Try again.', step: 'code' as const, email };
  }

  return { success: true, error: '', step: 'code' as const, email };
}

/** Email template for the verification code. */
function tplVerificationCode(name: string, code: string) {
  const text = `Hi ${name},

Your PremiumCity verification code is: ${code}

This code expires in 10 minutes. If you didn't request this, you can ignore this email.

— PremiumCity`;

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 8px">Verify your email</h2>
    <p style="margin:0 0 16px;color:#475569">Hi ${name}, use the code below to finish creating your PremiumCity account.</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#ecfdf5;color:#047857;border-radius:12px;padding:16px 0;margin:0 0 16px">${code}</div>
    <p style="margin:0;color:#64748b;font-size:13px">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
  </div>`;

  return { html, text };
}
