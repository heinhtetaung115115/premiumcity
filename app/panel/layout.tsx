import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PANEL_PUBLIC_URL || 'https://pcity.online'),
  title: 'Account Panel',
  description: 'Your account details and login codes.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Account Panel', description: 'Your account details and login codes.', images: [] },
  twitter: { card: 'summary', title: 'Account Panel', images: [] },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_70%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
