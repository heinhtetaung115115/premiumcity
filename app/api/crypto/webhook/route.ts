// app/api/crypto/webhook/route.ts
// Heleket payment webhook.
//
// SECURITY — this endpoint can mint wallet balance. Treat it accordingly.
//
//  1. VERIFY THE SIGNATURE. Heleket puts `sign` inside the body; we strip it,
//     re-hash the rest with our payment API key, and compare (timing-safe).
//     An unsigned or mis-signed request is rejected outright. Without this,
//     anyone who learns the URL could POST a fake "paid" and print money.
//
//  2. RE-FETCH FROM HELEKET. Even with a valid signature we don't let the body
//     decide the money. We pull the invoice fresh from the API and trust that.
//
//  3. IDEMPOTENT CREDIT. Heleket retries and sends several status transitions
//     (paid -> paid_over etc). creditCryptoTopup claims the row atomically, so
//     a double delivery can never double-credit.

import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { verifyWebhookSign, getInvoice, isPaidStatus, isDeadStatus } from '@/lib/heleket';
import { creditCryptoTopup } from '@/lib/cryptoTopup';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const raw = await req.text();

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // ── 1) Signature ──
  if (!verifyWebhookSign(body)) {
    console.error('[heleket-webhook] INVALID SIGNATURE — rejected', {
      order_id: body?.order_id,
      uuid: body?.uuid,
    });
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const topupId = String(body?.order_id ?? '');
  const invoiceUuid = String(body?.uuid ?? '');
  if (!topupId || !invoiceUuid) {
    return NextResponse.json({ ok: true, ignored: 'missing ids' });
  }

  const supabase = getServiceSupabaseClient();

  // ── 2) Re-fetch — never trust the body for money ──
  let invoice: any;
  try {
    invoice = await getInvoice(invoiceUuid);
  } catch (err) {
    console.error('[heleket-webhook] could not re-fetch invoice:', err);
    // 500 -> Heleket retries. Better than silently dropping a real payment.
    return NextResponse.json({ error: 'verify failed' }, { status: 500 });
  }

  if (String(invoice?.order_id) !== topupId) {
    console.error('[heleket-webhook] order_id mismatch', {
      claimed: topupId,
      actual: invoice?.order_id,
    });
    return NextResponse.json({ error: 'order mismatch' }, { status: 400 });
  }

  const status = String(invoice.payment_status ?? body.status ?? '');

  // Record status (but never clobber an already-credited row).
  try {
    await supabase
      .from('crypto_topups')
      .update({ status: status.toUpperCase() })
      .eq('id', topupId)
      .eq('credited', false);
  } catch (err) {
    console.error('[heleket-webhook] status update failed:', err);
  }

  if (isDeadStatus(status)) return NextResponse.json({ ok: true, status });
  if (!isPaidStatus(status)) return NextResponse.json({ ok: true, status });

  // ── 3) Paid → credit (idempotent) ──
  try {
    const result = await creditCryptoTopup(topupId, {
      payment_amount: invoice.payment_amount,
      payment_amount_usd: body.payment_amount_usd, // only the webhook carries this
      merchant_amount: invoice.merchant_amount,
    });

    if (result.credited) {
      try {
        const { data: row } = await supabase
          .from('crypto_topups')
          .select('user_id,usd_amount,pay_currency,network')
          .eq('id', topupId)
          .maybeSingle();

        const r: any = row;
        const { data: u } = await supabase
          .from('users')
          .select('email')
          .eq('id', r?.user_id)
          .maybeSingle();

        await sendTelegramMessage({
          text:
            `💰 <b>Crypto top-up received</b>\n\n` +
            `User: ${(u as any)?.email ?? r?.user_id}\n` +
            `Paid: $${Number(r?.usd_amount)} in ${r?.pay_currency} (${r?.network})\n` +
            `Credited: <b>${(result.mmk ?? 0).toLocaleString()} Ks</b>`,
        });
      } catch (err) {
        console.error('[heleket-webhook] telegram failed:', err);
      }
    }

    return NextResponse.json({ ok: true, status, credited: result.credited });
  } catch (err) {
    console.error('[heleket-webhook] crediting threw:', err);
    // 500 -> Heleket retries; our credit is idempotent so a retry is safe.
    return NextResponse.json({ error: 'crediting failed' }, { status: 500 });
  }
}
