// app/api/crypto/webhook/route.ts
//
// NOWPayments IPN (webhook) handler.
//
// SECURITY: this endpoint is public — anyone can POST to it. We credit a
// wallet ONLY after verifying the HMAC-SHA512 signature against our IPN
// secret. Never relax this.

import { NextResponse } from 'next/server';
import { verifyIpnSignature } from '@/lib/nowpayments';
import {
  findByOrderId,
  creditCryptoTopup,
  updateCryptoTopupStatus,
} from '@/lib/cryptoTopup';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// NOWPayments payment_status values we care about:
//   waiting          - invoice created, not paid yet
//   confirming       - seen on-chain, awaiting confirmations
//   confirmed        - confirmed on-chain
//   sending          - being forwarded to us
//   partially_paid   - underpaid (needs manual review)
//   finished         - fully settled  <-- credit here
//   failed / expired / refunded

export async function POST(req: Request) {
  // Read the RAW body — the signature is over the exact bytes.
  const rawBody = await req.text();
  const signature = req.headers.get('x-nowpayments-sig');

  if (!verifyIpnSignature(rawBody, signature)) {
    console.error('[crypto-webhook] INVALID SIGNATURE — rejecting');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const orderId = String(payload.order_id ?? '');
  const status = String(payload.payment_status ?? '').toLowerCase();
  const actuallyPaid = Number(payload.actually_paid ?? 0);
  const payAmount = Number(payload.pay_amount ?? 0);

  console.log(
    `[crypto-webhook] order=${orderId} status=${status} paid=${actuallyPaid}/${payAmount}`
  );

  if (!orderId) {
    return NextResponse.json({ error: 'missing order_id' }, { status: 400 });
  }

  const topup = await findByOrderId(orderId);
  if (!topup) {
    console.error(`[crypto-webhook] no crypto_topups row for order_id=${orderId}`);
    // 200 so NOWPayments stops retrying a payment we can't match.
    return NextResponse.json({ ok: true, note: 'unknown order' });
  }

  try {
    if (status === 'finished') {
      // Underpayment guard: if they sent materially less than invoiced, do NOT
      // auto-credit. Flag for manual review instead of guessing.
      if (payAmount > 0 && actuallyPaid > 0 && actuallyPaid < payAmount * 0.98) {
        await updateCryptoTopupStatus(topup.id, 'UNDERPAID');
        await sendTelegramMessage({
          text: `⚠️ Crypto top-up UNDERPAID\nOrder: ${orderId}\nInvoiced: ${payAmount} USDT\nPaid: ${actuallyPaid} USDT\nNeeds manual review.`,
        }).catch(() => {});
        return NextResponse.json({ ok: true, note: 'underpaid, flagged' });
      }

      const result = await creditCryptoTopup(topup.id);

      if (result.credited) {
        await sendTelegramMessage({
          text: `✅ Crypto top-up credited\n$${topup.usd_amount} USDT → ${Number(
            topup.mmk_amount
          ).toLocaleString()} Ks\nOrder: ${orderId}`,
        }).catch(() => {});
      }
      // If already_credited, this was a duplicate delivery — still return 200.
      return NextResponse.json({ ok: true, credited: result.credited });
    }

    if (status === 'partially_paid') {
      await updateCryptoTopupStatus(topup.id, 'UNDERPAID');
      await sendTelegramMessage({
        text: `⚠️ Crypto top-up partially paid\nOrder: ${orderId}\nPaid: ${actuallyPaid} USDT\nNeeds manual review.`,
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (status === 'failed' || status === 'expired' || status === 'refunded') {
      await updateCryptoTopupStatus(topup.id, status.toUpperCase());
      return NextResponse.json({ ok: true });
    }

    // waiting / confirming / confirmed / sending — just record progress.
    await updateCryptoTopupStatus(topup.id, status.toUpperCase());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[crypto-webhook] handler error:', err);
    // 500 => NOWPayments retries. Our crediting is idempotent, so a retry is safe.
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
