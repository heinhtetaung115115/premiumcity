'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import type { Product, ProductVariant } from '@/types/entities';
import { purchaseProduct } from '@/app/product/[slug]/actions';
import { Button, Input, TextArea } from './ui';
import type { ProductInputField } from '@/types/product';

interface Props {
  product: Product & { variants: ProductVariant[] };
}

const initialState = { success: false, error: '' };

export function ProductPurchaseForm({ product }: Props) {
  const [state, formAction] = useFormState(purchaseProduct, initialState);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(
    product.variants.find((variant) => variant.isDefault)?.id ?? product.variants[0]?.id
  );

  const manualFields = (product.inputSchema as ProductInputField[] | null) ?? [];

  if (product.variants.length === 0) {
    return <p className="text-sm text-rose-400">Add a pricing plan before selling this product.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={product.id} />
      <div>
        <label className="text-xs uppercase text-slate-400">Choose plan</label>
        <div className="mt-2 grid gap-2">
          {product.variants.map((variant) => (
            <label
              key={variant.id}
              className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm transition ${
                selectedVariant === variant.id
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-900 hover:border-emerald-400'
              }`}
            >
              <div>
                <input
                  className="sr-only"
                  type="radio"
                  name="variantId"
                  value={variant.id}
                  checked={selectedVariant === variant.id}
                  onChange={() => setSelectedVariant(variant.id)}
                />
                <span className="font-medium text-slate-100">{variant.name}</span>
              </div>
              <span className="text-sm text-emerald-300">${Number(variant.price).toFixed(2)}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs uppercase text-slate-400" htmlFor="quantity">
          Quantity
        </label>
        <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
      </div>
      {manualFields.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase text-slate-400">Information for manual delivery</p>
          {manualFields.map((field) => (
            <div key={field.id}>
              <label className="text-xs uppercase text-slate-500" htmlFor={`manual:${field.id}`}>
                {field.label}
              </label>
              {field.placeholder && <p className="text-xs text-slate-500">{field.placeholder}</p>}
              {field.id.toLowerCase().includes('note') || field.id.toLowerCase().includes('instructions') ? (
                <TextArea id={`manual:${field.id}`} name={`manual:${field.id}`} required={field.required} rows={3} />
              ) : (
                <Input id={`manual:${field.id}`} name={`manual:${field.id}`} required={field.required} />
              )}
            </div>
          ))}
        </div>
      )}
      {state.error && <p className="text-sm text-rose-400">{state.error}</p>}
      <Button type="submit" className="w-full">
        Purchase with wallet
      </Button>
    </form>
  );
}
