import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { authConfig } from '@/lib/auth';
import { sendEmail, tplManualDeliveryToUser } from '@/lib/email';

type OrderRow = {
  id: string;
  order_number: string | number | null;
  user: {
    email: string | null;
  } | null;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const payload = body.payload as Record<string, unknown> | undefined;
  const note = body.note as string | undefined;

  const supabase = getServiceSupabaseClient();

  const { data, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_number, user:users(email)')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderRow = data as OrderRow;

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'FULFILLED', manual_payload: payload ?? null })
    .eq('id', params.id);

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 });
  }

  const { error: itemError } = await supabase
    .from('order_items')
    .update({
      delivered_payload: payload ?? null,
      delivery_status: 'FULFILLED'
    })
    .eq('order_id', params.id);

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 400 });
  }

  const user = orderRow.user;
  if (user?.email) {
    try {
      const { subject, html, text } = tplManualDeliveryToUser(
        user.email,
        orderRow.order_number,
        note
      );

      await sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (e) {
      console.error('Failed to send manual delivery email:', e);
      // don’t fail the API just because email failed
    }
  }

  return NextResponse.json({ success: true });
}
