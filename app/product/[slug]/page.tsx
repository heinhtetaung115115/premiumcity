import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProductBySlug } from '@/lib/catalog';
import { InsufficientFundsModal } from '@/components/InsufficientFundsModal';
import { PurchaseForm } from './PurchaseForm';

type ProductPageProps = {
  params: { slug: string };
  searchParams?: { error?: string };
};

function formatKS(amount: number) {
  return `${amount.toLocaleString()} KS`;
}

function decodeError(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const product = await getProductBySlug(params.slug);

  if (!product || product.status !== 'ACTIVE') {
    notFound();
  }

  const errorCode = searchParams?.error || null;
  const showInsufficientModal = errorCode === 'INSUFFICIENT_FUNDS';
  const otherErrorMessage =
    errorCode && errorCode !== 'INSUFFICIENT_FUNDS'
      ? decodeError(errorCode)
      : null;

  const hasVariants = product.variants.length > 0;
  const primaryVariant = hasVariants ? product.variants[0] : null;

  const isInstant = product.productType === 'INSTANT';
  const isManual = product.productType === 'MANUAL';

  const canPurchase =
    hasVariants &&
    (isManual || (isInstant && product.isInStock));

  const categorySlug = product.category?.slug ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* 🔔 Wallet insufficient funds modal */}
      <InsufficientFundsModal showOnMount={showInsufficientModal} />

      {/* Back link */}
      <div className="mb-4">
        <Link
          href={categorySlug ? `/category/${categorySlug}` : '/'}
          className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200"
        >
          ← Back
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
        {/* LEFT: Product overview */}
        <section className="space-y-6">
          {/* Type badge + title + price */}
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                {isInstant ? 'Instant delivery' : 'Manual delivery'}
              </span>
              {isInstant && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    product.isInStock
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-red-500/10 text-red-300'
                  }`}
                >
                  {product.isInStock ? 'In stock' : 'Out of stock'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
                  {product.name}
                </h1>
                {product.category?.name && (
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {product.category.name}
                  </p>
                )}
              </div>

              {primaryVariant && (
                <div className="text-right">
                  <p className="text-xs uppercase text-slate-500">From</p>
                  <p className="text-xl font-semibold text-emerald-300">
                    {formatKS(primaryVariant.price)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Description & delivery note */}
          <div className="space-y-4">
            {product.description && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-100">
                  Details
                </h2>
                <p className="text-sm leading-relaxed text-slate-300">
                  {product.description}
                </p>
              </div>
            )}

            {product.deliveryNote && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-100">
                  Delivery info
                </h2>
                <p className="text-sm text-slate-300">
                  {product.deliveryNote}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: Purchase card */}
        <aside className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5 shadow-lg shadow-black/40">
          <PurchaseForm
            product={product}
            isManual={isManual}
            isInstant={isInstant}
            canPurchase={canPurchase}
            primaryVariant={primaryVariant}
            otherErrorMessage={otherErrorMessage}
          />
        </aside>
      </div>
    </main>
  );
}
