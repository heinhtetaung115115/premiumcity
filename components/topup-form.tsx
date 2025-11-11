'use client';

import { useFormState } from 'react-dom';
import type { BankAccount } from '@prisma/client';
import { requestTopup } from '@/app/topup/actions';
import { Button, Input, TextArea } from './ui';

const initialState = { success: false, error: '' };

export function TopupForm({ banks }: { banks: BankAccount[] }) {
  const [state, formAction] = useFormState(requestTopup, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="text-xs uppercase text-slate-400" htmlFor="bankName">
          Bank
        </label>
        <Input id="bankName" name="bankName" list="bankOptions" placeholder="KBZ" required />
        <datalist id="bankOptions">
          {banks.map((bank) => (
            <option key={bank.id} value={bank.bankName} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="text-xs uppercase text-slate-400" htmlFor="amount">
          Amount
        </label>
        <Input id="amount" name="amount" type="number" min={1} step="0.01" placeholder="50" required />
      </div>
      <div>
        <label className="text-xs uppercase text-slate-400" htmlFor="referenceHint">
          Last 4 digits of transaction ID
        </label>
        <Input id="referenceHint" name="referenceHint" placeholder="1234" required minLength={4} maxLength={10} />
      </div>
      <div>
        <label className="text-xs uppercase text-slate-400" htmlFor="note">
          Note for admin (optional)
        </label>
        <TextArea id="note" name="note" rows={3} placeholder="Transferred from UAB mobile on 10 Jan" />
      </div>
      {state.error && <p className="text-sm text-rose-400">{state.error}</p>}
      <Button type="submit">Submit top up</Button>
    </form>
  );
}
