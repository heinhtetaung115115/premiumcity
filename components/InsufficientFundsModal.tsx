'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

type Props = {
  showOnMount?: boolean;
};

export function InsufficientFundsModal({ showOnMount = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(showOnMount);

  // If the prop changes (page loaded with error=INSUFFICIENT_FUNDS), open once
  useEffect(() => {
    if (showOnMount) {
      setOpen(true);
    }
  }, [showOnMount]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-100">
          Not enough wallet balance
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          Your PremiumCity wallet does not have enough MMK to complete this purchase.
          You can top up your wallet now, or cancel and try a different product.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              // Close and go to topup page
              setOpen(false);
              router.push('/topup');
            }}
          >
            Top up wallet
          </Button>
        </div>
      </div>
    </div>
  );
}
