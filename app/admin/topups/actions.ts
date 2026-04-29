'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/session';
import { sendEmail, tplTopupApproved } from '@/lib/email';

/**
 * Fallback template because tplTopupRejected
 * does not exist inside lib/email.ts
 */
function tplTopupRejectedFallback(
  userName: string,
  amount: number,
  reason?: string
) {
  const amt = Number(amount).toLocaleString();
  const text = `Your top-up was rejected.\nAmount: ${amt} MMK\nReason: ${reason ?? 'Not specified'}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h2>Top-up Rejected</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Your top-up of <b>${amt} MMK</b> could not be approved.</p>
      ${
        reason
          ? `<p><b>Reason:</b> ${reason}</p>`
          : `<p>No specific reason was provided.</p>`
      }
      <p>— Premium City</p>
    </div>
  `;
  return { html, text };
}

export async function processTopup(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const actionRaw = String(formData.get('action') ?? '');
  const action = actionRaw.toUpperCase(); // APPROVE | REJECT
  const reason = String(formData.get('reason') ?? '').trim() || undefined;

  if (!id || (action !== 'APPROVE' && action !== 'REJECT')) {
    return { success: false, error: 'Invalid action' };
  }

  const supabase = getServiceSupabaseClient();

  // 1) Load the topup row
  const { data: topupRow, error: fetchError } = await supabase
    .from('topups')
    .select('id,user_id,amount,status,last4')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }
  if (!topupRow) {
    return { success: false, error: 'Top-up not found' };
  }

  const topup = topupRow as any; // cast to any to avoid TS "unknown"

  if (topup.status !== 'PENDING') {
    return { success: false, error: 'Top-up already processed' };
  }

  const nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  // 2) If approving, credit the wallet via your existing RPC
  if (nextStatus === 'APPROVED') {
    const { error: creditError } = await supabase.rpc('credit_wallet', {
      p_amount: topup.amount,
      p_user_id: topup.user_id
    });

    if (creditError) {
      return { success: false, error: creditError.message };
    }
  }

  // 3) Update topup status
  const { error: updateError } = await supabase
    .from('topups')
    .update({ status: nextStatus })
    .eq('id', id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // 4) Load user to email them
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('email,name')
    .eq('id', topup.user_id)
    .maybeSingle();

  if (!userError && userRow) {
    const user = userRow as any; // <-- FIX: cast to any
    if (user.email) {
      const email: string = user.email as string;
      const userName: string = (user.name as string) || email;
      const amount = Number(topup.amount);

      try {
        if (nextStatus === 'APPROVED') {
          // ✅ "Your top-up was approved" email
          const { html, text } = tplTopupApproved(userName, amount);
          await sendEmail({
            to: email,
            subject: 'Your top-up was approved',
            text,
            html
          });
        } else {
          // ❌ "Your top-up could not be approved" email
          const { html, text } = tplTopupRejectedFallback(
            userName,
            amount,
            reason
          );
          await sendEmail({
            to: email,
            subject: 'Your top-up could not be approved',
            text,
            html
          });
        }
      } catch (err) {
        console.error('Topup notification email error:', err);
        // don’t fail the whole action just because email failed
      }
    }
  }

  // 5) Refresh admin & wallet pages
  revalidatePath('/admin/topups');
  revalidatePath('/(dashboard)/wallet');

  return { success: true };
}
