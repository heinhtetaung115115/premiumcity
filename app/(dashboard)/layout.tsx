import { requireAuth } from '@/lib/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <div className="space-y-8">{children}</div>;
}
