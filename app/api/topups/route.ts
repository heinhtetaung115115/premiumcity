// app/api/topups/route.ts
import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { authConfig } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import {
  sendEmail,
  tplTopupSubmitted,
  tplTopupAdminNotify,
  getAdminRecipients
} from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';
import { notifyNewTopup } from '@/lib/telegram';

type Body = {
  amount: number;
  last4: string;
  bankAccountId: string;
  bankName: string;
  accountNo: string;
  method: 'qr' | 'account';
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { amount, last4, bankAccountId, method, bankName, accountNo } = body;

  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  if (!last4 || !/^\d{4}$/.test(last4)) {
    return NextResponse.json({ error: 'Invalid last4' }, { status: 400 });
  }

  if (!bankAccountId) {
    return NextResponse.json({ error: 'Bank account required' }, { status: 400 });
  }

  // ---------- RATE LIMIT: max 5 per 60 seconds per user ----------
  const userId = String(session.user.id);

  const rl = await checkRateLimit({
    key: userId,
    route: 'topup',
    windowInSeconds: 60,
    maxRequests: 5,
  });

  console.log('[topup] rate limit result:', rl);

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          'Too many top-up submissions. Please wait and try again.',
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

  const { data, error } = await supabase
    .from('topups')
    .insert({
      user_id: session.user.id,
      bank_account_id: bankAccountId,
      amount,
      last4,
      method,
      status: 'PENDING'
    })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userEmail =
    (session.user as any).email || 'unknown@pcitystore.com';
  const userName =
    (session.user as any).name || userEmail || null;

  // ----- USER EMAIL -----
  try {
    const { html, text } = tplTopupSubmitted(userName, amount, last4);

    await sendEmail({
      to: userEmail,
      subject: 'We received your top-up request',
      text,
      html
    });
  } catch (err) {
    console.error('Failed to send user topup email', err);
  }

  // ----- ADMIN EMAIL -----
  try {
    const admins = getAdminRecipients();
    if (admins.length > 0) {
      // Build a human-readable payment description
      const paymentInfo =
        method === 'qr'
          ? `QR payment to ${bankName || 'Unknown bank'}`
          : `Account transfer to ${bankName || 'Unknown bank'}${accountNo ? ` (${accountNo})` : ''}`;

      const { html, text } = tplTopupAdminNotify(
        userEmail,
        amount,
        last4,
        (data as any)?.id ?? null,
        paymentInfo
      );

      await sendEmail({
        to: admins,
        subject: 'New top-up submitted',
        text,
        html
      });
    }
  } catch (err) {
    console.error('Failed to send admin topup email', err);
  }

  // ----- TELEGRAM NOTIFICATION -----
  try {
    await notifyNewTopup({
      id: (data as any)?.id ?? '',
      userEmail,
      amount,
      last4,
      bankName: bankName || undefined,
      method: method || undefined,
    });
  } catch (err) {
    console.error('Failed to send Telegram topup notification', err);
  }

  return NextResponse.json({ success: true });
}
