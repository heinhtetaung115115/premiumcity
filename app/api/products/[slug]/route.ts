import { NextResponse } from 'next/server';
import { getProductBySlug } from '@/lib/catalog';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.json(product);
}
