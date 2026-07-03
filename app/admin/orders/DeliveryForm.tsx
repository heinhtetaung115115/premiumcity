'use client';

import { useState } from 'react';
import { Input, Button } from '@/components/ui';
import { DELIVERY_TYPE_OPTIONS, type DeliveryType } from '@/lib/deliveryTypes';

export function DeliveryForm({
  orderItemId,
  action,
}: {
  orderItemId: string;
  action: (formData: FormData) => void;
}) {
  const [type, setType] = useState<DeliveryType>('EMAIL_PASSWORD');

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderItemId" value={orderItemId} />

      <label className="block text-[11px] uppercase text-slate-500">
        Delivery type
        <select
          name="deliveryType"
          value={type}
          onChange={(e) => setType(e.target.value as DeliveryType)}
          className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          {DELIVERY_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-2 md:grid-cols-2">
        {type === 'EMAIL_PASSWORD' && (
          <>
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-slate-500">Email</label>
              <Input name="email" placeholder="customer@example.com" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase text-slate-500">Password</label>
              <Input name="password" placeholder="password" className="h-8 text-xs" />
            </div>
          </>
        )}

        {type === 'KEY' && (
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] uppercase text-slate-500">Key</label>
            <Input name="key" placeholder="XXXX-XXXX-XXXX-XXXX" className="h-8 text-xs" />
          </div>
        )}

        {type === 'INVITE_LINK' && (
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] uppercase text-slate-500">Invite link</label>
            <Input name="inviteLink" placeholder="https://..." className="h-8 text-xs" />
          </div>
        )}

        <div className="space-y-1 md:col-span-2">
          <label className="text-[11px] uppercase text-slate-500">
            {type === 'NOTE' ? 'Note (delivered to customer)' : 'Note (optional)'}
          </label>
          <Input name="note" placeholder="Profile, region, extra notes…" className="h-8 text-xs" />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" className="px-3 py-1.5 text-xs">
          Save &amp; deliver
        </Button>
      </div>
    </form>
  );
}
