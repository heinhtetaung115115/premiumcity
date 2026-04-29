// app/api/auth/reset-password/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: string | null;
  used: boolean | null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const rawToken = body.token;
    const token =
      typeof rawToken === 'string' ? rawToken.trim() : '';

    const newPassword = String(body.password || '').trim();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Missing token or password.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabaseClient();

    const { data: rawTokenRow, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id,user_id,token,expires_at,used')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !rawTokenRow) {
      return NextResponse.json(
        { error: 'Reset token not found or expired.' },
        { status: 400 }
      );
    }

    const tokenRow = rawTokenRow as PasswordResetTokenRow;

    const now = new Date();
    const expiresAt = tokenRow.expires_at
      ? new Date(tokenRow.expires_at)
      : null;

    if (expiresAt && expiresAt.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: 'This reset link has expired.' },
        { status: 400 }
      );
    }

    if (tokenRow.used) {
      return NextResponse.json(
        { error: 'This reset link was already used.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', tokenRow.user_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Could not update password.' },
        { status: 500 }
      );
    }

    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', tokenRow.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    );
  }
}
