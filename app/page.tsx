// app/page.tsx
import { getAllProducts } from '@/lib/catalog';
import { HomeClient } from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { categories, products } = await getAllProducts();

  return <HomeClient categories={categories} products={products} />;
}
