import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { authConfig } from '@/lib/auth';
import { sendMail } from '@/lib/mailer';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const payload = body.payload as Record<string, unknown> | undefined;
  const note = body.note as string | undefined;

  const supabase = getServiceSupabaseClient();
  const { data: orderRow, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_number, user:users(email)')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  if (!orderRow) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'FULFILLED', manual_payload: payload ?? null })
    .eq('id', params.id);

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 400 });
  }

  const { error: itemError } = await supabase
    .from('order_items')
    .update({ delivered_payload: payload ?? null, delivery_status: 'FULFILLED' })
    .eq('order_id', params.id);

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 400 });
  }

  const user = (orderRow as { user: { email: string | null } | null }).user;
  if (user?.email) {
    await sendMail({
      to: user.email,
      subject: `Your PremiumCity order #${orderRow.order_number} is ready`,
      html: `We have delivered your order.<br/>${note ?? ''}`
    });
  }

  return NextResponse.json({ success: true });
}
