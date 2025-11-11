import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { submitTopupRequest } from '@/lib/wallet';
import { topupSchema } from '@/utils/validators';

export async function POST(request: Request) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const parsed = topupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const topup = await submitTopupRequest({
    userId: session.user.id,
    amount: parsed.data.amount,
    bankName: parsed.data.bankName,
    referenceHint: parsed.data.referenceHint
  });

  return NextResponse.json(topup);
}
