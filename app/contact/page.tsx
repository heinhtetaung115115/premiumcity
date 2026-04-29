import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact us — PremiumCity'
};

const contacts = [
  {
    label: 'Viber',
    href: 'viber://chat?number=+959740934551',
    description: ''
  },
  {
    label: 'Facebook',
    href: 'https://m.me/pcitymarketplace',
    description: ''
  },
  {
    label: 'Telegram',
    href: 'https://t.me/premiumcity_support',
    description: ''
  }
];

export default function ContactPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">
          Contact our support
        </h1>
        <p className="text-sm text-slate-400">
          Need help with an order, wallet top-up, or manual delivery? Choose one of the channels below to reach us directly.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact) => (
          <a
            key={contact.label}
            href={contact.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition hover:border-emerald-500/60 hover:bg-slate-900/80"
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-br from-emerald-500/10 via-cyan-400/5 to-emerald-500/10" />

            <div className="relative space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-50">
                  {contact.label}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 group-hover:bg-emerald-500/20">
                  Tap to open
                </span>
              </div>

              <p className="text-xs text-slate-400">
                {contact.description}
              </p>

              <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 group-hover:text-emerald-200">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 group-hover:bg-emerald-300" />
                Open {contact.label}
              </p>
            </div>
          </a>
        ))}
      </div>

     
    </section>
  );
}
