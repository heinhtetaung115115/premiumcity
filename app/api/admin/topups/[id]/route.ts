import { NextResponse } from 'next/server';
import { approveTopup, rejectTopup } from '@/lib/orders';
import { requireAdmin } from '@/lib/session';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const action = body.action as 'approve' | 'reject' | undefined;
  const comment = body.comment as string | undefined;

  if (action === 'approve') {
    const user = await approveTopup(params.id, session.user.id!);
    return NextResponse.json(user);
  }

  if (action === 'reject') {
    const result = await rejectTopup(params.id, session.user.id!, comment ?? '');
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
