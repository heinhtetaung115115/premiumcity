'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { decodeKbzQr, extractSlipData, scanQrFromImage } from '@/lib/slip-verify';

export type SlipResult = {
  ok: boolean;
  error?: string;
  message?: string;
  /** The slip was already used for a website top-up. */
  websiteMatches?: { id: string; status: string; amount: number; createdAt: string; email: string | null }[];
  needManualTid?: boolean;
};

const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

/** Website top-ups that used this transaction number (any status). */
async function findWebsiteTopups(tidDigits: string) {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('topups')
    .select('id,user_id,amount,status,created_at,metadata')
    .eq('method', 'qr')
    .order('created_at', { ascending: false })
    .limit(5000);
  const hits = ((data ?? []) as any[]).filter((r) => {
    let m = r.metadata;
    if (typeof m === 'string') {
      try {
        m = JSON.parse(m);
      } catch {
        return false;
      }
    }
    if (!m || typeof m !== 'object') return false;
    const cands = [
      m.verified_transaction_id,
      m?.slip_verification?.extracted?.transactionId,
      m?.slip_verification?.qr_payload?.transactionId,
    ];
    return cands.some((c) => {
      const d = digits(c);
      return d.length >= 6 && (d === tidDigits || d.endsWith(tidDigits) || tidDigits.endsWith(d));
    });
  });
  if (hits.length === 0) return [];
  const ids = Array.from(new Set(hits.map((h) => h.user_id).filter(Boolean)));
  const { data: users } = ids.length
    ? await supabase.from('users').select('id,email').in('id', ids)
    : { data: [] as any[] };
  const emailById = new Map(((users ?? []) as any[]).map((u) => [u.id, u.email]));
  return hits.map((h) => ({
    id: h.id,
    status: h.status,
    amount: Number(h.amount) || 0,
    createdAt: h.created_at,
    email: emailById.get(h.user_id) ?? null,
  }));
}

export async function registerSlipAction(formData: FormData): Promise<SlipResult> {
  await requireAdmin();
  const supabase = getServiceSupabaseClient();

  const typedTid = String(formData.get('transactionId') ?? '').trim();
  const typedAmount = Number(String(formData.get('amount') ?? '').replace(/[^\d.]/g, '')) || null;
  const note = String(formData.get('note') ?? '').trim() || null;
  const file = formData.get('slip') as File | null;

  let tid: string | null = typedTid || null;
  let readBy: 'qr' | 'ai' | 'manual' = 'manual';
  let amount = typedAmount;
  let sender: string | null = null;
  let slipTime: string | null = null;

  if (!tid && file && file.size > 0) {
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const mediaType = file.type || 'image/jpeg';

    // 1) QR on the slip (free, exact)
    const qrRaw = await scanQrFromImage(base64);
    const qr = qrRaw ? decodeKbzQr(qrRaw) : null;
    if (qr?.transactionId) {
      tid = qr.transactionId;
      readBy = 'qr';
    }

    // 2) Read the slip text (also gives amount / sender). Skip quietly if AI is down.
    try {
      const data = await extractSlipData(base64, mediaType);
      if (!tid && data.transactionId) {
        tid = data.transactionId;
        readBy = 'ai';
      }
      amount = amount ?? data.amount ?? null;
      sender = data.senderName ?? null;
      slipTime = data.dateTime ?? null;
    } catch {
      /* AI unavailable — QR or typed number still works */
    }
  }

  const tidDigits = digits(tid);
  if (tidDigits.length < 6) {
    return {
      ok: false,
      needManualTid: true,
      error: file && file.size > 0
        ? 'Could not read the Transaction No. from this slip. Type it in the box and save again.'
        : 'Upload the slip or type the Transaction No.',
    };
  }

  const websiteMatches = await findWebsiteTopups(tidDigits);

  const { error } = await supabase.from('used_slips').insert({
    transaction_id: tid,
    tid_digits: tidDigits,
    amount,
    sender_name: sender,
    slip_time: slipTime,
    note,
    read_by: readBy,
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: true, message: `Already blocked: ${tid}.`, websiteMatches };
    }
    if (/relation .*used_slips.* does not exist/i.test(error.message)) {
      return { ok: false, error: 'Run the used_slips SQL in Supabase first (see instructions).' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/slips');
  return {
    ok: true,
    message: `Blocked ${tid}${amount ? ` · ${Number(amount).toLocaleString()} Ks` : ''}${
      readBy === 'qr' ? ' (read from QR)' : readBy === 'ai' ? ' (read from slip text — double-check the number)' : ''
    }. It can no longer be used for a website top-up.`,
    websiteMatches,
  };
}

export async function deleteSlipAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await getServiceSupabaseClient().from('used_slips').delete().eq('id', id);
  revalidatePath('/admin/slips');
}
