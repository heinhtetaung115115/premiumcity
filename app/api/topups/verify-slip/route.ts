// app/api/topups/verify-slip/route.ts
import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { verifyKbzSlip } from '@/lib/slip-verify';
import { approveTopup, rejectTopup, TopupAlreadyProcessedError } from '@/lib/wallet';
import { notifyNewTopup } from '@/lib/telegram';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Each attempt calls the Claude vision API (real cost) and is a potential
  // probe against the fraud checks, so throttle per user.
  const rl = await checkRateLimit({
    key: String(session.user.id),
    route: 'verify-slip',
    windowInSeconds: 10 * 60,
    maxRequests: 12,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please wait a few minutes and try again.' },
      {
        status: 429,
        headers: rl.retryAfterSeconds ? { 'Retry-After': String(rl.retryAfterSeconds) } : undefined,
      }
    );
  }

  let body: { topupId: string; imageBase64: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { topupId, imageBase64, mediaType } = body;
  if (!topupId || !imageBase64) {
    return NextResponse.json({ error: 'topupId and imageBase64 required' }, { status: 400 });
  }

  const supabase = getServiceSupabaseClient();

  const { data: topup } = await supabase
    .from('topups')
    .select('id,user_id,amount,last4,status,bank_account_id,method')
    .eq('id', topupId)
    .maybeSingle();

  if (!topup) {
    return NextResponse.json({ error: 'Top-up not found' }, { status: 404 });
  }

  const t = topup as any;
  if (t.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (t.status !== 'PENDING') {
    return NextResponse.json({ error: 'Already processed' }, { status: 400 });
  }

  // ── Duplicate check ──
  const checkDuplicate = async (tid: string): Promise<boolean> => {
    // Duplicate transaction IDs only ever come from KBZ auto-verify slips
    // (method='qr'), so scoping to that method keeps this query cheap and
    // correct regardless of how many manual (non-KBZ) topups accumulate.
    const { data: rows } = await supabase
      .from('topups')
      .select('id,metadata,status')
      .eq('method', 'qr')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!rows) {
      console.log('[duplicate-check] No rows returned');
      return false;
    }

    const allRows = rows as any[];
    let withMeta = 0;

    for (const row of allRows) {
      if (row.id === topupId) continue;
      if (row.status === 'REJECTED') continue;

      let meta = row.metadata;
      if (!meta) continue;
      withMeta++;

      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { continue; }
      }
      if (typeof meta !== 'object' || meta === null) continue;

      const storedTid = meta.verified_transaction_id;
      if (storedTid === tid) {
        console.log(`[duplicate-check] DUPLICATE FOUND: topup ${row.id}`);
        return true;
      }

      const prevDecision = meta?.slip_verification?.decision;
      if (prevDecision === 'AUTO_APPROVE' || prevDecision === 'REJECT') {
        const nestedTid = meta?.slip_verification?.extracted?.transactionId;
        if (nestedTid && nestedTid.replace(/\D/g, '') === tid.replace(/\D/g, '')) {
          console.log(`[duplicate-check] DUPLICATE FOUND (nested): topup ${row.id}`);
          return true;
        }
      }
    }

    console.log(`[duplicate-check] Checked ${allRows.length} rows (${withMeta} with metadata), no duplicate for tid=${tid}`);
    return false;
  };

  // ── Run verification ──
  let result;
  try {
    result = await verifyKbzSlip({
      imageBase64,
      mediaType: mediaType || 'image/jpeg',
      claimedAmount: Number(t.amount),
      checkDuplicate,
    });
  } catch (err: any) {
    console.error('[verify-slip] error:', err);
    return NextResponse.json(
      { error: 'Could not verify slip. Ensure image is clear.' },
      { status: 422 }
    );
  }

  console.log('[verify-slip] Decision:', result.decision);
  console.log('[verify-slip] Reason:', result.reason);
  console.log('[verify-slip] Checks:', JSON.stringify(result.checks));
  console.log('[verify-slip] TID:', result.transactionId);

  const slipLast4 = result.slipData.transactionId?.replace(/\D/g, '').slice(-4) || t.last4;

  // Store verification in metadata
  const isFinalDecision = result.decision === 'AUTO_APPROVE' || result.decision === 'REJECT';

  await supabase.from('topups').update({
    metadata: {
      slip_verification: {
        decision: result.decision,
        reason: result.reason,
        checks: result.checks,
        extracted: result.slipData,
        qr_payload: result.qrPayload
          ? { transactionId: result.qrPayload.transactionId, timestamp: result.qrPayload.timestamp }
          : null,
        verified_at: new Date().toISOString(),
      },
      verified_transaction_id: isFinalDecision ? result.transactionId : null,
    },
    last4: slipLast4 || t.last4,
  }).eq('id', topupId);

  const userEmail = (session.user as any).email || '';

  // ── AUTO APPROVE (skipEmail=true for KBZ instant) ──
  if (result.decision === 'AUTO_APPROVE') {
    try {
      await approveTopup(topupId, true);
      return NextResponse.json({
        status: 'approved',
        reason_mm: 'ငွေဖြည့်သွင်းမှု အောင်မြင်ပါသည်',
        reason_en: 'Payment verified and approved.',
      });
    } catch (err: any) {
      if (err instanceof TopupAlreadyProcessedError) {
        return NextResponse.json({ status: 'manual_review', reason_mm: '', reason_en: 'Already processed.' });
      }
      console.error('[verify-slip] auto-approve failed:', err);
    }
  }

  // ── AUTO REJECT (no email for KBZ, user sees result in UI) ──
  if (result.decision === 'REJECT') {
    try {
      await rejectTopup(topupId, result.reason, true);
    } catch (err) {
      if (!(err instanceof TopupAlreadyProcessedError)) {
        console.error('[verify-slip] auto-reject failed:', err);
      }
    }

    let reason_mm = 'ငွေဖြည့်သွင်းမှု မအောင်မြင်ပါ';
    let reason_en = 'Payment verification failed.';

    if (!result.checks.isKbzPay) {
      reason_mm = 'KBZ Pay Slip မဟုတ်ပါ။ ကျေးဇူးပြု၍ KBZ Pay ဖြင့် ငွေလွှဲပါ';
      reason_en = 'This is not a KBZ Pay slip.';
    } else if (!result.checks.noDuplicate) {
      reason_mm = 'ဤ Slip အား အသုံးပြုပြီး ဖြစ်ပါသည်';
      reason_en = 'This payment slip has already been used.';
    } else if (!result.checks.recipientMatch) {
      reason_mm = 'ငွေလက်ခံသူ အမည် မတူညီပါ။ ကျေးဇူးပြု၍ မှန်ကန်သော Account သို့ ငွေလွှဲပါ';
      reason_en = 'Recipient does not match our account.';
    } else if (!result.checks.amountMatch) {
      reason_mm = 'ငွေပမာဏ မတူညီပါ။ ထည့်သွင်းသော ပမာဏနှင့် Slip ပမာဏ တူညီရပါမည်';
      reason_en = 'Amount mismatch between entered amount and slip.';
    } else if (result.checks.qrFound && result.checks.qrValid && !result.checks.qrSlipTransactionMatch) {
      reason_mm = 'Payment Slip စစ်ဆေးမှု မအောင်မြင်ပါ။ Slip အချက်အလက်များ မတူညီပါ';
      reason_en = 'Slip verification failed. Transaction details mismatch.';
    } else if (!result.checks.paymentSuccessful) {
      reason_mm = 'ငွေလွှဲမှု မအောင်မြင်သော Slip ဖြစ်ပါသည်';
      reason_en = 'This slip does not show a successful payment.';
    }

    // Notify admin via Telegram about rejection (no email to user)
    try {
      await notifyNewTopup({
        id: topupId,
        userEmail,
        amount: Number(t.amount),
        last4: slipLast4 || t.last4,
        bankName: 'KBZ Pay (REJECTED)',
        method: 'kbz_auto',
      });
    } catch {}

    return NextResponse.json({ status: 'rejected', reason_mm, reason_en });
  }

  // ── MANUAL REVIEW ──
  try {
    await notifyNewTopup({
      id: topupId,
      userEmail,
      amount: Number(t.amount),
      last4: slipLast4 || t.last4,
      bankName: 'KBZ Pay',
      method: 'kbz_auto',
    });
  } catch {}

  if (!result.checks.qrFound) {
    return NextResponse.json({
      status: 'qr_not_found',
      reason_mm: 'QR Code ကို ရှာမတွေ့ပါ။ KBZ QR Code ပါဝင်သော Screenshot အပြည့်အစုံ ထပ်မံ Upload လုပ်ပါ',
      reason_en: 'QR code not detected. Upload a full screenshot with the QR code.',
    });
  }

  return NextResponse.json({
    status: 'manual_review',
    reason_mm: 'Payment Slip လက်ခံရရှိပါသည်။ စစ်ဆေးပြီးပါက အသိပေးပါမည်',
    reason_en: 'Payment slip received. Our team will verify shortly.',
  });
}
