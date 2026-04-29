import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { createOrderForUser } from '@/lib/orders';
import { productPurchaseSchema } from '@/utils/validators';

export async function POST(request: Request) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const json = await request.json();
  const parsed = productPurchaseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const order = await createOrderForUser({
      userId: session.user.id,
      productId: parsed.data.productId,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
      manualInput: parsed.data.manualInput
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
