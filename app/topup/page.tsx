import { listActiveBanks } from '@/lib/banks';
import { Card } from '@/components/ui';
import { TopupForm } from '@/components/topup-form';

export default async function TopupPage() {
  const banks = await listActiveBanks();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Top up your wallet</h1>
        <p className="text-sm text-slate-400">
          Transfer funds using any of the bank accounts below then submit the reference details for instant review.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {banks.map((bank) => (
          <Card key={bank.id}>
            <h2 className="text-lg font-medium text-emerald-300">{bank.bankName}</h2>
            <p className="text-sm text-slate-400">{bank.instructions ?? 'Transfer and keep the receipt for verification.'}</p>
            <div className="mt-4 space-y-1 text-sm">
              <p>
                <span className="text-slate-500">Account name:</span> {bank.accountName}
              </p>
              <p>
                <span className="text-slate-500">Account number:</span> {bank.accountNo}
              </p>
              {bank.qrCodeUrl && (
                <p>
                  <a href={bank.qrCodeUrl} className="text-emerald-400 hover:text-emerald-300" target="_blank" rel="noreferrer">
                    View QR code
                  </a>
                </p>
              )}
            </div>
          </Card>
        ))}
        {banks.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">No bank accounts configured yet.</p>
          </Card>
        )}
      </section>
      <section>
        <Card>
          <TopupForm banks={banks} />
        </Card>
      </section>
    </div>
  );
}
