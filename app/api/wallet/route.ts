import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getWalletOverview, listTopupRequests } from '@/lib/wallet';

export async function GET() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const [wallet, topups] = await Promise.all([
    getWalletOverview(session.user.id),
    listTopupRequests(session.user.id)
  ]);

  return NextResponse.json({ wallet, topups });
}
