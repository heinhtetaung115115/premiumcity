import { NextResponse } from 'next/server';
import { getActiveCategories } from '@/lib/catalog';

export async function GET() {
  const categories = await getActiveCategories();
  return NextResponse.json(categories);
}
