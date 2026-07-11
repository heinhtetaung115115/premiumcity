// app/api/crypto/status/route.ts
//
// Polled by the payment page. Also acts as a SAFETY NET: if the IPN webhook
// was missed (NOWPayments outage, our deploy restarting, etc), we ask
// NOWPayments directly and credit from here. Crediting is idempotent, so this
// racing the webhook is harmless.

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getPayment } from '@/lib/nowpayments';
import {
  getCryptoTopupById,
  creditCryptoTopup,
  updateCryptoTopupStatus,
} from '@/lib/cryptoTopup';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const topup = await getCryptoTopupById(id, session.user.id as string);
  if (!topup) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Already done — nothing to check.
  if (topup.credited) {
    return NextResponse.json({ status: topup.status, credited: true });
  }

  // Reconcile against NOWPayments in case the webhook never arrived.
  if (topup.payment_id) {
    try {
      const p = await getPayment(topup.payment_id);
      const status = String(p?.payment_status ?? '').toLowerCase();
      const actuallyPaid = Number(p?.actually_paid ?? 0);
      const payAmount = Number(p?.pay_amount ?? 0);

      if (status === 'finished') {
        const underpaid =
          payAmount > 0 && actuallyPaid > 0 && actuallyPaid < payAmount * 0.98;
        if (underpaid) {
          await updateCryptoTopupStatus(topup.id, 'UNDERPAID');
          return NextResponse.json({ status: 'UNDERPAID', credited: false });
        }
        const result = await creditCryptoTopup(topup.id);
        return NextResponse.json({ status: 'CREDITED', credited: true, ...result });
      }

      if (status) {
        const upper = status.toUpperCase();
        if (upper !== topup.status) await updateCryptoTopupStatus(topup.id, upper);
        return NextResponse.json({ status: upper, credited: false });
      }
    } catch (err) {
      console.error('[crypto-status] reconcile failed:', err);
      // Fall through and just report what we have stored.
    }
  }

  return NextResponse.json({ status: topup.status, credited: false });
}
