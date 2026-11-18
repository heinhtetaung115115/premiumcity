// app/api/topups/verify-slip/route.ts
//
// KBZ Pay auto top-up. The customer uploads only the slip; the amount comes
// from the slip. The top-up row is created here, after the checks, with the
// amount read from the slip (see lib/slip-verify.ts for the check order).
//
// Body: { imageBase64, mediaType?, fallbackAmount? }
//   fallbackAmount is only accepted after the server answered `need_amount`
//   (slip AI down): the top-up then waits for admin review.
import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { verifyKbzSlip, describeAiFailure, type VerificationResult } from '@/lib/slip-verify';
import { approveTopup, rejectTopup, TopupAlreadyProcessedError } from '@/lib/wallet';
import { notifyNewTopup, notifySlipAiDown, sendTelegramMessage } from '@/lib/telegram';
import { checkRateLimit } from '@/lib/rate-limit';
import { MAX_TOPUP_AMOUNT, MIN_TOPUP_AMOUNT } from '@/utils/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Out = {
  status: 'approved' | 'manual_review' | 'rejected' | 'qr_not_found' | 'unreadable' | 'need_amount';
  reason_mm: string;
  reason_en: string;
  amount?: number;
  balance?: number;
};

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

// Admin alerts for anything that breaks on OUR side. Each kind is sent at most
// once per 10 minutes per server instance so a broken step can't flood Telegram.
const lastAlert = new Map<string, number>();
async function alertAdmin(kind: string, lines: string[]) {
  const now = Date.now();
  if (now - (lastAlert.get(kind) ?? 0) < 10 * 60 * 1000) return;
  lastAlert.set(kind, now);
  try {
    await sendTelegramMessage({ text: ['⚠️ <b>KBZ auto top-up problem</b>', ...lines].join('\n') });
  } catch (e) {
    console.error('[verify-slip] alert failed:', e);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = String(session.user.id);
  const userEmail = (session.user as any).email || '';

  // Each attempt can call the paid vision API and probes the checks: throttle.
  const rl = await checkRateLimit({ key: userId, route: 'verify-slip', windowInSeconds: 10 * 60, maxRequests: 12 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: rl.retryAfterSeconds ? { 'Retry-After': String(rl.retryAfterSeconds) } : undefined }
    );
  }

  let body: { imageBase64?: string; mediaType?: string; fallbackAmount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const imageBase64 = String(body.imageBase64 ?? '');
  const mediaType = body.mediaType || 'image/jpeg';
  if (!imageBase64) return NextResponse.json({ error: 'Slip image required' }, { status: 400 });

  const fallbackAmount = body.fallbackAmount != null ? Math.round(Number(body.fallbackAmount)) : null;
  if (fallbackAmount != null && (!Number.isFinite(fallbackAmount) || fallbackAmount < MIN_TOPUP_AMOUNT || fallbackAmount > MAX_TOPUP_AMOUNT)) {
    return NextResponse.json(
      { error: `Amount must be between ${MIN_TOPUP_AMOUNT.toLocaleString()} and ${MAX_TOPUP_AMOUNT.toLocaleString()} Ks` },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabaseClient();

  // KBZ account the customer paid to
  const { data: banks } = await supabase
    .from('bank_accounts')
    .select('id,bank_name,is_active')
    .ilike('bank_name', '%kbz%')
    .limit(5);
  const bank = ((banks ?? []) as any[]).find((b) => b.is_active) ?? ((banks ?? []) as any[])[0];
  if (!bank) return NextResponse.json({ error: 'KBZ Pay is not available right now.' }, { status: 400 });

  // ── Used before? (website top-ups + slips the admin saved from Viber/Telegram) ──
  const checkDuplicate = async (tid: string): Promise<boolean> => {
    const tidDigits = String(tid ?? '').replace(/\D/g, '');
    if (tidDigits.length >= 6) {
      const { data: blocked, error: blockedErr } = await supabase
        .from('used_slips')
        .select('id')
        .eq('tid_digits', tidDigits)
        .limit(1);
      if (!blockedErr && blocked && (blocked as any[]).length > 0) return true;
    }
    const { data: rows } = await supabase
      .from('topups')
      .select('id,metadata,status')
      .eq('method', 'qr')
      .order('created_at', { ascending: false })
      .limit(5000);
    for (const row of (rows ?? []) as any[]) {
      if (row.status === 'REJECTED') continue;
      let meta = row.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { continue; }
      }
      if (!meta || typeof meta !== 'object') continue;
      const cands = [
        meta.verified_transaction_id,
        meta?.slip_verification?.qr_payload?.transactionId,
        meta?.slip_verification?.extracted?.transactionId,
      ];
      if (cands.some((c: any) => c && String(c).replace(/\D/g, '') === tidDigits)) return true;
    }
    return false;
  };

  let result: VerificationResult;
  try {
    result = await verifyKbzSlip({ imageBase64, mediaType, checkDuplicate, skipAi: fallbackAmount != null });
  } catch (err: any) {
    console.error('[verify-slip] error:', err);
    await alertAdmin('verify-crash', [
      'Slip check crashed — nothing was added to any wallet.',
      `👤 ${esc(userEmail)}`,
      `📝 ${esc(String(err?.message ?? err).slice(0, 300))}`,
    ]);
    return NextResponse.json({ error: 'Could not read this slip. Please upload a clear screenshot.' }, { status: 422 });
  }

  if (result.systemError) {
    await alertAdmin('system', [
      'A check step failed on our side — customer was asked to upload again.',
      `👤 ${esc(userEmail)}`,
      `📝 ${esc(result.systemError)}`,
    ]);
  }
  console.log('[verify-slip]', result.decision, '|', result.reason, '|', result.transactionId);

  const tid = result.transactionId;
  const last4 = (tid ?? '').replace(/\D/g, '').slice(-4) || '0000';
  const meta = (decision: string) => ({
    slip_verification: {
      decision,
      reason: result.reason,
      checks: result.checks,
      extracted: result.slipData,
      qr_payload: result.qrPayload
        ? { transactionId: result.qrPayload.transactionId, timestamp: result.qrPayload.timestamp }
        : null,
      verified_at: new Date().toISOString(),
    },
    verified_transaction_id: tid,
  });

  const insertTopup = async (amount: number, decision: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('topups')
      .insert({
        user_id: userId,
        bank_account_id: bank.id,
        amount,
        last4,
        method: 'qr',
        status: 'PENDING',
        metadata: meta(decision),
      })
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[verify-slip] insert failed:', error.message);
      await alertAdmin('insert', [
        'Could not save a KBZ top-up — nothing was added to the wallet.',
        `👤 ${esc(userEmail)}`,
        `💵 ${amount.toLocaleString()} Ks · ${esc(decision)}`,
        tid ? `🧾 …${esc(tid.slice(-8))}` : '',
        `📝 ${esc(error.message)}`,
      ].filter(Boolean));
      return null;
    }
    return (data as any)?.id ?? null;
  };

  const reply = (o: Out) => NextResponse.json(o);
  const walletBalance = async () => {
    const { data } = await supabase.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
    return Number((data as any)?.balance ?? 0);
  };

  // ── Ask again (nothing saved) ──
  if (result.decision === 'RETRY_QR') {
    return reply({
      status: 'qr_not_found',
      reason_mm: 'QR code ကို မတွေ့ပါ။ အောက်ခြေက QR code ပါတဲ့ slip အပြည့်ကို ပြန်တင်ပေးပါ',
      reason_en: 'QR code not found. Upload the full slip including the QR code.',
    });
  }
  if (result.decision === 'RETRY_UNREADABLE') {
    return reply({
      status: 'unreadable',
      reason_mm: 'Slip ကို ဖတ်လို့မရပါ။ ပိုရှင်းတဲ့ screenshot နဲ့ ပြန်တင်ပေးပါ',
      reason_en: 'We could not read this slip. Please upload a clearer screenshot.',
    });
  }

  // ── Slip AI down ──
  if (result.decision === 'AI_DOWN') {
    if (fallbackAmount == null) {
      if (result.aiError) {
        await alertAdmin('ai-down', [
          '🚨 <b>Slip AI is DOWN</b>',
          `⚠️ ${esc(describeAiFailure(result.aiError))}`,
          'Customers are asked to type the amount; their top-ups wait for your review.',
        ]);
      }
      return reply({
        status: 'need_amount',
        reason_mm: 'လွှဲထားတဲ့ ငွေပမာဏကို ရိုက်ထည့်ပေးပါ',
        reason_en: 'Please type the amount you sent.',
      });
    }
    const id = await insertTopup(fallbackAmount, 'MANUAL_REVIEW');
    if (!id) return NextResponse.json({ error: 'Could not save your top-up. Please try again.' }, { status: 500 });
    try {
      await notifySlipAiDown({
        topupId: id,
        userEmail,
        amount: fallbackAmount,
        problem: 'Slip AI unavailable — amount typed by customer, QR checks passed',
        imageBase64,
        mediaType,
      });
    } catch {}
    return reply({
      status: 'manual_review',
      reason_mm: 'Slip လက်ခံရရှိပါပြီ။ စစ်ပြီးတာနဲ့ wallet ထဲ ထည့်ပေးပါမယ်',
      reason_en: 'Slip received. It will be added after a quick check.',
      amount: fallbackAmount,
    });
  }

  // ── Reject ──
  if (result.decision === 'REJECT') {
    if (result.amount && result.amount > 0) {
      const id = await insertTopup(result.amount, 'REJECT');
      if (id) {
        try { await rejectTopup(id, result.reason, true); } catch (e) {
          if (!(e instanceof TopupAlreadyProcessedError)) console.error('[verify-slip] reject failed:', e);
        }
      }
    }
    try {
      await sendTelegramMessage({
        text: [
          '🚫 <b>KBZ slip rejected</b>',
          `👤 ${esc(userEmail)}`,
          result.amount ? `💵 ${result.amount.toLocaleString()} Ks` : '',
          tid ? `🧾 …${esc(tid.slice(-8))}` : '',
          `📝 ${esc(result.reason)}`,
        ].filter(Boolean).join('\n'),
      });
    } catch {}

    const msg: Record<string, [string, string]> = {
      duplicate: ['ဒီ slip ကို အသုံးပြုပြီးသား ဖြစ်ပါတယ်', 'This slip has already been used.'],
      not_kbz: ['KBZ Pay slip မဟုတ်ပါ', 'This is not a KBZ Pay slip.'],
      wrong_recipient: ['ငွေလက်ခံသူ မှန်ကန်မှု မရှိပါ။ ပြထားတဲ့ account ကို လွှဲပေးပါ', 'This payment was not sent to our account.'],
      not_successful: ['ငွေလွှဲမှု မအောင်မြင်သေးတဲ့ slip ဖြစ်ပါတယ်', 'This slip does not show a successful payment.'],
      too_small: [`အနည်းဆုံး ${MIN_TOPUP_AMOUNT.toLocaleString()} Ks ဖြည့်ပေးပါ`, `Minimum top-up is ${MIN_TOPUP_AMOUNT.toLocaleString()} Ks.`],
      forged: ['ဒီ slip ကို လက်မခံနိုင်ပါ', 'This slip could not be accepted.'],
    };
    const [mm, en] = msg[result.rejectCode ?? 'forged'] ?? msg.forged;
    return reply({ status: 'rejected', reason_mm: mm, reason_en: en });
  }

  // ── Approve / manual review: create the top-up with the slip amount ──
  const amount = result.amount!;
  const id = await insertTopup(amount, result.decision);
  if (!id) return NextResponse.json({ error: 'Could not save your top-up. Please try again.' }, { status: 500 });

  if (result.decision === 'AUTO_APPROVE') {
    try {
      await approveTopup(id, true);
      return reply({
        status: 'approved',
        reason_mm: 'Wallet ထဲ ထည့်ပြီးပါပြီ',
        reason_en: 'Added to your wallet.',
        amount,
        balance: await walletBalance(),
      });
    } catch (err: any) {
      if (!(err instanceof TopupAlreadyProcessedError)) {
        console.error('[verify-slip] auto-approve failed:', err);
        await alertAdmin('approve', [
          'Auto-approve FAILED — the top-up is waiting for you in admin. Check the wallet before approving.',
          `👤 ${esc(userEmail)}`,
          `💵 ${amount.toLocaleString()} Ks`,
          `📝 ${esc(String(err?.message ?? err).slice(0, 300))}`,
        ]);
      }
    }
  }

  try {
    await notifyNewTopup({ id, userEmail, amount, last4, bankName: 'KBZ Pay (review)', method: 'kbz_auto' });
  } catch {}
  return reply({
    status: 'manual_review',
    reason_mm: 'Slip လက်ခံရရှိပါပြီ။ စစ်ပြီးတာနဲ့ wallet ထဲ ထည့်ပေးပါမယ်',
    reason_en: 'Slip received. It will be added after a quick check.',
    amount,
  });
}
