import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact us — PremiumCity'
};

const contacts = [
  { label: 'Viber', value: 'viber://chat?number=+95900000000' },
  { label: 'Telegram', value: 'https://t.me/premiumcity_support' },
  { label: 'Facebook Messenger', value: 'https://m.me/premiumcityshop' }
];

export default function ContactPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Contact our support</h1>
        <p className="text-sm text-slate-400">
          Reach out through any of the channels below for order questions or manual product delivery updates.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {contacts.map((contact) => (
          <li key={contact.label} className="rounded border border-slate-800 bg-slate-900/60 p-4">
            <span className="block text-sm font-medium text-emerald-400">{contact.label}</span>
            <a href={contact.value} className="text-sm text-slate-300 break-all">
              {contact.value}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
