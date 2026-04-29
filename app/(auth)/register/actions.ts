'use server';

import { headers } from 'next/headers';
import { hash } from 'bcryptjs';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { registrationSchema } from '@/utils/validators';
import { checkRateLimit } from '@/lib/rate-limit';

export async function registerUser(_: unknown, formData: FormData) {
  // 1) Validate form data
  const result = registrationSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });

  if (!result.success) {
    return {
      success: false,
      error: 'Invalid form submission',
    };
  }

  const email = result.data.email.toLowerCase().trim();
  const name = result.data.name;
  const password = result.data.password;

  // 2) Get real client IP (Cloudflare Tunnel friendly)
  let realIp = 'unknown';
  try {
    const h = headers();
    const cfIp = h.get('cf-connecting-ip');
    const xff = h.get('x-forwarded-for') || '';
    realIp =
      cfIp?.trim() ||
      xff.split(',')[0]?.trim() ||
      h.get('x-real-ip')?.trim() ||
      'unknown';
  } catch {
    // if headers() fails, keep realIp = 'unknown'
  }

  // 3) Rate limiting (per email + per IP)
  try {
    // Per-email: strict – max 3 attempts/hour per email
    const emailKey = `register:email:${email || 'unknown'}`;
    const emailRl = await checkRateLimit({
      key: emailKey,
      route: 'register-email',
      windowInSeconds: 60 * 60, // 1 hour
      maxRequests: 3,
    });

    if (!emailRl.allowed) {
      return {
        success: false,
        error:
          'Too many registration attempts for this email. Please try again later.',
      };
    }

    // Per-IP: looser – max 30 registrations/hour per IP
    const ipKey = `register:ip:${realIp}`;
    const ipRl = await checkRateLimit({
      key: ipKey,
      route: 'register-ip',
      windowInSeconds: 60 * 60, // 1 hour
      maxRequests: 30,
    });

    if (!ipRl.allowed) {
      return {
        success: false,
        error:
          'Too many registrations from your connection. Please try again later.',
      };
    }
  } catch (e) {
    console.error('[registerUser] rate limit error:', e);
    // If rate-limit storage is broken, better to fail safely:
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }

  // 4) Supabase: check existing user
  const supabase = getServiceSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    return {
      success: false,
      error: existingError.message,
    };
  }

  if (existing) {
    return {
      success: false,
      error: 'Email already registered',
    };
  }

  // 5) Create new user
  const password_hash = await hash(password, 10);

  const { error } = await supabase.from('users').insert({
    email,
    name,
    password_hash,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}
