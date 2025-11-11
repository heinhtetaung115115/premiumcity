import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/catalog';
import { ProductPurchaseForm } from '@/components/product-purchase-form';
import { formatCurrency } from '@/utils/currency';
import type { ProductInputField } from '@/types/product';

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    notFound();
  }

  const manualFields = (product.inputSchema as ProductInputField[] | null) ?? [];
  const cheapestVariant = product.variants.reduce((prev, current) => {
    if (!prev) return current;
    return Number(current.price) < Number(prev.price) ? current : prev;
  }, product.variants[0]);

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section className="space-y-4">
        <div className="space-y-2">
          <span className="inline-flex rounded border border-emerald-400/40 px-2 py-1 text-xs uppercase text-emerald-300">
            {product.productType === 'INSTANT' ? 'Instant delivery' : 'Manual delivery'}
          </span>
          <h1 className="text-3xl font-semibold">{product.name}</h1>
          {product.description && <p className="text-sm text-slate-400">{product.description}</p>}
        </div>
        {cheapestVariant && (
          <p className="text-sm text-slate-300">Starts at {formatCurrency(Number(cheapestVariant.price))}</p>
        )}
        {!product.isInStock && (
          <p className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            Currently out of stock. Check back soon.
          </p>
        )}
        {manualFields.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            <p className="font-medium text-emerald-300">Information required after purchase</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-400">
              {manualFields.map((field) => (
                <li key={field.id}>{field.label}</li>
              ))}
            </ul>
          </div>
        )}
        {product.deliveryNote && (
          <div className="rounded border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
            {product.deliveryNote}
          </div>
        )}
      </section>
      <aside className="rounded border border-slate-800 bg-slate-900 p-6">
        {product.isInStock ? (
          <ProductPurchaseForm product={product} />
        ) : (
          <p className="text-sm text-slate-400">This product is currently unavailable.</p>
        )}
      </aside>
    </div>
  );
}
