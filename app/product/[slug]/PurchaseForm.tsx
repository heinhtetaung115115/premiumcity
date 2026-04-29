'use client';

import { useFormStatus } from 'react-dom';
import { useMemo, useState, useEffect } from 'react';
import { purchaseProductAction } from './actions';

type PurchaseFormProps = {
  product: any;
  isManual: boolean;
  isInstant: boolean;
  canPurchase: boolean;
  primaryVariant: any | null;
  otherErrorMessage: string | null;
};

function formatKS(amount: number) {
  return `${amount.toLocaleString()} KS`;
}

const COUNTRY_LABELS: Record<string, string> = {
  SG: 'Singapore',
  JP: 'Japan',
  TH: 'Thailand',
};

function flagForCountry(code: string | null | undefined) {
  if (!code) return '🌐';
  const c = code.trim().toUpperCase();

  const MAP: Record<string, string> = {
    SG: '🇸🇬',
    JP: '🇯🇵',
    TH: '🇹🇭',
  };
  if (MAP[c]) return MAP[c];

  // Generic 2-letter code → flag
  if (c.length === 2 && /^[A-Z]{2}$/.test(c)) {
    const cps = [...c].map(
      (ch) => 0x1f1e6 + ch.charCodeAt(0) - 65
    );
    return String.fromCodePoint(...cps);
  }

  return '🌐';
}

// Try to detect country from variant name like:
//   "SG 1 Month 200GB"
//   "1 Month SG 200GB"
//   "1 Month 200GB SG"
//   "1 Month Japan 200GB"
function parseVpnVariantName(name: string): { countryCode: string; planLabel: string } {
  const raw = String(name ?? '').trim();
  if (!raw) {
    return { countryCode: 'SG', planLabel: 'Plan' };
  }

  const parts = raw.split(/\s+/);
  let detectedCode: string | null = null;
  const loweredParts = parts.map((p) => p.toLowerCase());

  // Look for codes / full names anywhere in the string
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const u = p.toUpperCase();
    const l = loweredParts[i];

    if (u === 'SG' || l === 'singapore') {
      detectedCode = 'SG';
      break;
    }
    if (u === 'JP' || l === 'japan') {
      detectedCode = 'JP';
      break;
    }
    if (u === 'TH' || l === 'thailand') {
      detectedCode = 'TH';
      break;
    }
  }

  const countryCode = detectedCode || 'SG';

  // Remove any country tokens from the label
  const planTokens = parts.filter((p, idx) => {
    const u = p.toUpperCase();
    const l = loweredParts[idx];

    if (countryCode === 'SG' && (u === 'SG' || l === 'singapore')) return false;
    if (countryCode === 'JP' && (u === 'JP' || l === 'japan')) return false;
    if (countryCode === 'TH' && (u === 'TH' || l === 'thailand')) return false;

    return true;
  });

  const planLabel = planTokens.join(' ').trim() || raw;

  return { countryCode, planLabel };
}

function PurchaseFormInner({
  product,
  isManual,
  isInstant,
  primaryVariant,
  otherErrorMessage,
}: PurchaseFormProps) {
  const { pending } = useFormStatus();

  const isOutlineVpn = product?.slug === 'outline-vpn';

  // --- VPN variant parsing (for outline-vpn only) ---
  type VpnVariantInfo = {
    id: string;
    countryCode: string;
    planLabel: string;
    price: number;
    name: string;
  };

  const vpnVariants: VpnVariantInfo[] = useMemo(() => {
    if (!isOutlineVpn) return [];
    if (!Array.isArray(product?.variants)) return [];

    return product.variants.map((variant: any) => {
      const fullName = String(variant.name ?? '').trim();
      const { countryCode, planLabel } = parseVpnVariantName(fullName);

      return {
        id: String(variant.id),
        countryCode,
        planLabel,
        price: Number(variant.price ?? 0),
        name: fullName,
      };
    });
  }, [isOutlineVpn, product?.variants]);

  const countryOptions = useMemo(
    () =>
      Array.from(new Set(vpnVariants.map((v) => v.countryCode))).sort(),
    [vpnVariants]
  );

  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  // Initialize selectedCountry when variants load
  useEffect(() => {
    if (!isOutlineVpn) return;
    if (!countryOptions.length) return;
    if (!selectedCountry) {
      setSelectedCountry(countryOptions[0]);
    }
  }, [isOutlineVpn, countryOptions, selectedCountry]);

  // Plan options depend on selectedCountry
  const planOptions = useMemo(() => {
    if (!isOutlineVpn || !selectedCountry) return [];
    const candidates = vpnVariants.filter(
      (v) => v.countryCode === selectedCountry
    );
    return Array.from(new Set(candidates.map((v) => v.planLabel)));
  }, [isOutlineVpn, selectedCountry, vpnVariants]);

  // Initialize / reset selectedPlan when country or plans change
  useEffect(() => {
    if (!isOutlineVpn) return;
    if (!planOptions.length) {
      if (selectedPlan) setSelectedPlan('');
      return;
    }
    if (!selectedPlan || !planOptions.includes(selectedPlan)) {
      setSelectedPlan(planOptions[0]);
    }
  }, [isOutlineVpn, planOptions, selectedPlan]);

  const selectedVpnVariant = useMemo(() => {
    if (!isOutlineVpn || vpnVariants.length === 0) return null;
    const country = selectedCountry || vpnVariants[0].countryCode;

    // Prefer exact match (country + plan)
    if (selectedPlan) {
      const exact = vpnVariants.find(
        (v) => v.countryCode === country && v.planLabel === selectedPlan
      );
      if (exact) return exact;
    }

    // Fallback: any variant in that country
    const anyInCountry = vpnVariants.find(
      (v) => v.countryCode === country
    );
    if (anyInCountry) return anyInCountry;

    return vpnVariants[0];
  }, [isOutlineVpn, vpnVariants, selectedCountry, selectedPlan]);

  const selectedVpnPrice = selectedVpnVariant?.price ?? 0;

  // === Non-VPN (normal) variants: pre-calc per-variant stock for INSTANT products ===
  type AnyVariant = {
    id: string;
    availableInventoryCount?: number;
    [key: string]: any;
  };

  const instantVariantsStock: Record<string, number> = useMemo(() => {
    if (!isInstant || isOutlineVpn) return {};
    if (!Array.isArray(product?.variants)) return {};
    const out: Record<string, number> = {};
    for (const v of product.variants as AnyVariant[]) {
      const id = String(v.id);
      const raw = v.availableInventoryCount;
      const count =
        typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      out[id] = count;
    }
    return out;
  }, [isInstant, isOutlineVpn, product?.variants]);

  const preferredVariantId: string | null = useMemo(() => {
    if (!Array.isArray(product?.variants)) return null;
    const variants = product.variants as AnyVariant[];

    // Helper: how many we think are available for this variant
    const getStock = (v: AnyVariant): number => {
      if (!isInstant || isOutlineVpn) {
        // For MANUAL or outline-vpn we treat as "unlimited" here
        return Number.MAX_SAFE_INTEGER;
      }
      const id = String(v.id);
      return instantVariantsStock[id] ?? 0;
    };

    if (primaryVariant) {
      const stock = getStock(primaryVariant as AnyVariant);
      if (stock > 0) return String(primaryVariant.id);
    }

    const firstWithStock = variants.find((v) => getStock(v) > 0);
    if (firstWithStock) return String(firstWithStock.id);

    // Fallback: original behaviour – first variant
    return variants[0] ? String(variants[0].id) : null;
  }, [
    product?.variants,
    primaryVariant,
    isInstant,
    isOutlineVpn,
    instantVariantsStock,
  ]);

  // --- Track selected non-VPN variant for quantity max calculation ---
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    preferredVariantId
  );

  useEffect(() => {
    setSelectedVariantId(preferredVariantId);
  }, [preferredVariantId]);

  // Total available for product (fallback if per-variant stock not available)
  const totalAvailableForProduct: number =
    typeof product?.availableInventoryCount === 'number'
      ? product.availableInventoryCount
      : 0;

  const currentVariantStock = useMemo(() => {
    if (!isInstant || isOutlineVpn) return null;
    if (!selectedVariantId) return null;
    return instantVariantsStock[selectedVariantId] ?? null;
  }, [isInstant, isOutlineVpn, selectedVariantId, instantVariantsStock]);

  // Quantity rules:
  // - MANUAL products: no quantity input, always 1
  // - outline-vpn: quantity allowed, max 10
  // - INSTANT products: quantity allowed, max = min(stock for selected variant, 10)
  const showQuantityInput = isInstant || isOutlineVpn;
  const outlineMaxPerOrder = 10;

  let maxQuantity = 1;
  if (isOutlineVpn) {
    maxQuantity = outlineMaxPerOrder;
  } else if (isInstant) {
    const stock = currentVariantStock ?? totalAvailableForProduct;
    if (stock && stock > 0) {
      maxQuantity = Math.min(stock, 10);
    } else {
      maxQuantity = 10;
    }
  }

  if (maxQuantity < 1) {
    maxQuantity = 1;
  }

  return (
    <>
      {/* Full-screen loading overlay when purchase is processing */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-6 py-5 shadow-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <p className="text-sm text-slate-100">Processing your order…</p>
            <p className="text-[11px] text-slate-400">
              Please don&apos;t close the page or click again.
            </p>
          </div>
        </div>
      )}

      {/* hidden ids */}
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="productSlug" value={product.slug} />

      {/* For outline-vpn: hidden selected variantId field */}
      {isOutlineVpn && (
        <input
          type="hidden"
          name="variantId"
          value={selectedVpnVariant?.id ?? ''}
        />
      )}

      {/* Error alert – only for non-wallet errors */}
      {otherErrorMessage && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-xs text-red-100">
          {otherErrorMessage}
        </div>
      )}

      {/* Variants / pricing */}
      <div className="space-y-3">
        {isOutlineVpn ? (
          <>
            {/* COUNTRY SELECT */}
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-400">
                Choose country
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setSelectedPlan(''); // let effect pick default for new country
                }}
              >
                {countryOptions.map((code) => {
                  const label = COUNTRY_LABELS[code] ?? code;
                  return (
                    <option key={code} value={code}>
                      {flagForCountry(code)} {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* PLAN SELECT */}
            <div className="space-y-1">
              <label className="text-xs uppercase text-slate-400">
                Choose data plan
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
              >
                {planOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price display */}
            {selectedVpnVariant && (
              <p className="text-xs text-slate-400">
                Price{' '}
                <span className="font-semibold text-emerald-300">
                  {formatKS(selectedVpnPrice)}
                </span>
              </p>
            )}
          </>
        ) : (
          <>
            <label className="text-xs uppercase text-slate-400">
              Choose plan
            </label>
            <div className="mt-1 grid gap-2">
              {product.variants.length === 0 && (
                <p className="text-xs text-slate-500">
                  Pricing not configured for this product.
                </p>
              )}

              {product.variants.map((variant: any) => {
                const variantId = String(variant.id);
                const variantStock =
                  isInstant && !isOutlineVpn
                    ? instantVariantsStock[variantId] ?? 0
                    : null;

                const isVariantOutOfStock =
                  isInstant &&
                  !isOutlineVpn &&
                  (variantStock ?? 0) <= 0;

                return (
                  <label
                    key={variant.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition
                      ${
                        isVariantOutOfStock
                          ? 'border-slate-800 bg-slate-900/60 opacity-60'
                          : 'border-slate-800 bg-slate-900 hover:border-emerald-400 hover:bg-slate-900/80'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        className="h-4 w-4 accent-emerald-500"
                        type="radio"
                        name="variantId"
                        value={variant.id}
                        disabled={isVariantOutOfStock}
                        defaultChecked={
                          preferredVariantId !== null &&
                          String(variant.id) === preferredVariantId
                        }
                        onChange={() =>
                          setSelectedVariantId(String(variant.id))
                        }
                      />
                      <span className="font-medium text-slate-100">
                        {variant.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-medium text-emerald-300">
                        {formatKS(variant.price)}
                      </span>
                      {isVariantOutOfStock && (
                        <span className="text-[11px] font-medium text-red-400">
                          Out of stock
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Quantity */}
      {showQuantityInput ? (
        <div className="space-y-1">
          <label
            className="text-xs uppercase text-slate-400"
            htmlFor="quantity"
          >
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={maxQuantity}
            defaultValue={1}
            name="quantity"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500">
            {isOutlineVpn
              ? 'Maximum 10 VPN keys per order.'
              : `You can buy up to ${maxQuantity} for this selection.`}
          </p>
        </div>
      ) : (
        // MANUAL products: always quantity = 1
        <input type="hidden" name="quantity" value={1} />
      )}

      {/* Manual input fields */}
      {isManual && product.inputSchema && product.inputSchema.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-400">
            Your details
          </p>
          {product.inputSchema.map((field: any) => (
            <div key={field.id} className="space-y-1">
              <label
                htmlFor={`field_${field.id}`}
                className="text-xs text-slate-300"
              >
                {field.label}
                {field.required && (
                  <span className="text-red-400"> *</span>
                )}
              </label>
              <input
                id={`field_${field.id}`}
                name={`field_${field.id}`}
                required={field.required}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>
          ))}
          <p className="text-[11px] text-slate-500">
            We use these details only to deliver your subscription correctly.
          </p>
        </div>
      )}

      {/* Stock message for INSTANT products (whole product) */}
      {isInstant && !product.isInStock && (
        <p className="text-xs text-red-400">
          Currently out of stock. Check back soon.
        </p>
      )}

      {/* CTA – disabled while pending or cannot purchase */}
      <button
        type="submit"
        disabled={!product.isInStock || pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>💳</span>
        <span>{pending ? 'Processing…' : 'Purchase with wallet'}</span>
      </button>

      {/* Small hint under button */}
      <p className="text-[11px] text-slate-500">
        Payment is deducted from your PremiumCity wallet balance.
      </p>
    </>
  );
}

export function PurchaseForm(props: PurchaseFormProps) {
  return (
    <form action={purchaseProductAction} className="space-y-5">
      <PurchaseFormInner {...props} />
    </form>
  );
}
