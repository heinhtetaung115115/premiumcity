import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact us — PremiumCity',
};

const contacts = [
  {
    label: 'Viber',
    href: 'viber://chat?number=+959740934551',
    tint: 'rgba(124,58,237,0.08)',
    border: 'rgba(124,58,237,0.25)',
    iconBg: 'rgba(124,58,237,0.2)',
    iconColor: '#a78bfa',
    icon: 'viber',
  },
  {
    label: 'Facebook',
    href: 'https://m.me/pcitymarketplace',
    tint: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    iconBg: 'rgba(59,130,246,0.2)',
    iconColor: '#60a5fa',
    icon: 'messenger',
  },
  {
    label: 'Telegram',
    href: 'https://t.me/premiumcity_support',
    tint: 'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.25)',
    iconBg: 'rgba(14,165,233,0.2)',
    iconColor: '#38bdf8',
    icon: 'telegram',
  },
];

function ChannelIcon({ name, color }: { name: string; color: string }) {
  const style = { width: 26, height: 26 };
  if (name === 'viber') {
    return (
      <svg viewBox="0 0 24 24" style={style} fill={color} aria-hidden="true">
        <path d="M11.4 0C9.5.1 5.4.4 3.1 2.5 1.4 3.2.9 4.1.6 5.3.3 6.5 0 8.4 0 10.6c0 2.2.3 4.1.6 5.3.3 1.2.8 2.1 1.5 2.8.6.5 1.4 1 2.6 1.3v2.8c0 .5.6.8 1 .4l2.2-2.3h.9c1.9 0 6-.3 8.3-2.4.7-.7 1.2-1.6 1.5-2.8.3-1.2.6-3.1.6-5.3 0-2.2-.3-4.1-.6-5.3-.3-1.2-.8-2.1-1.5-2.8C14.9.3 10.8 0 8.9 0h2.5zm.3 3.6c1.5 0 4.6.2 6.2 1.7.4.4.8 1 1 1.9.2.9.4 2.5.4 4.4 0 1.9-.2 3.5-.4 4.4-.2.9-.6 1.5-1 1.9-1.6 1.5-4.7 1.7-6.2 1.7h-.6l-.3.3-1.5 1.5v-1.5l-.6-.1c-1.1-.2-1.7-.5-2.1-.9-.4-.4-.8-1-1-1.9-.2-.9-.4-2.5-.4-4.4 0-1.9.2-3.5.4-4.4.2-.9.6-1.5 1-1.9 1.6-1.5 4.7-1.7 6.2-1.7h-.5zm-.2 1.9c-.2 0-.3.2-.3.3 0 .2.1.3.3.3 1.3 0 2.3.4 3.1 1.1.7.7 1.1 1.8 1.1 3.1 0 .2.2.3.3.3.2 0 .3-.1.3-.3 0-1.4-.4-2.7-1.3-3.5-.9-.9-2.1-1.3-3.5-1.3zm-2.5.9c-.2-.1-.5-.1-.7.1L7.3 7.5c-.2.2-.3.5-.2.8 0 0 .3 1.2 1.5 2.7 1.2 1.5 2.4 2 2.4 2 .3.1.6 0 .8-.2l.5-.7c.2-.2.1-.6-.1-.7l-1-.7c-.2-.1-.4-.1-.5.1l-.3.4s-.6-.3-1.2-1c-.6-.7-.8-1.3-.8-1.3l.4-.3c.2-.1.2-.4.1-.5l-.7-1zm3 .1c-.2 0-.3.1-.3.3 0 .1.1.3.3.3.6 0 1 .2 1.3.5.3.3.5.7.5 1.3 0 .1.1.3.3.3.1 0 .3-.2.3-.3 0-.7-.3-1.3-.7-1.7-.4-.4-1-.7-1.7-.7zm.1 1.3c-.2 0-.3.1-.3.2 0 .2.1.3.2.3.2 0 .3.1.4.2.1.1.2.2.2.4 0 .2.1.3.3.3.1 0 .3-.1.3-.3 0-.3-.2-.6-.4-.8-.2-.2-.5-.3-.7-.3z"/>
      </svg>
    );
  }
  if (name === 'messenger') {
    return (
      <svg viewBox="0 0 24 24" style={style} fill={color} aria-hidden="true">
        <path d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.4 3.1 7.1.2.1.3.4.3.6l.1 1.8c0 .6.6 1 1.1.7l2-.9c.2-.1.4-.1.6 0 .9.3 1.9.4 2.8.4 5.6 0 10-4.1 10-9.7S17.6 2 12 2zm6 7.5l-2.9 4.7c-.5.7-1.5.9-2.2.4l-2.3-1.7c-.2-.2-.5-.2-.8 0l-3.1 2.4c-.4.3-1-.2-.7-.6l2.9-4.7c.5-.7 1.5-.9 2.2-.4l2.3 1.7c.2.2.5.2.8 0l3.1-2.4c.4-.3 1 .2.7.6z"/>
      </svg>
    );
  }
  // telegram
  return (
    <svg viewBox="0 0 24 24" style={style} fill={color} aria-hidden="true">
      <path d="M21.9 4.3l-3.3 15.5c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.3-.1-.5-.6-.2L6.4 13.4l-4.8-1.5c-1-.3-1.1-1 .2-1.5l18.7-7.2c.9-.3 1.6.2 1.4 1.1z"/>
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
        {/* Header */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M3 5a2 2 0 012-2h3l2 5-2.5 1.5a11 11 0 005 5L17 12l5 2v3a2 2 0 01-2 2A16 16 0 013 5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-50">Contact Support</h1>
          <p className="mt-1 text-xs text-slate-500">Pick a channel to reach us</p>
        </div>

        {/* Channel grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {contacts.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl p-4 text-center transition hover:brightness-125"
              style={{ background: c.tint, border: `0.5px solid ${c.border}` }}
            >
              <div
                className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: c.iconBg }}
              >
                <ChannelIcon name={c.icon} color={c.iconColor} />
              </div>
              <p className="text-xs font-medium text-slate-100">{c.label}</p>
            </a>
          ))}
        </div>

        {/* Support hours */}
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3">
          <svg className="h-[18px] w-[18px] flex-shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs text-slate-300">Support hours: 9 AM – 10 PM daily</span>
        </div>
      </div>
    </div>
  );
}
