import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authConfig } from './auth';

export async function requireAuth() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    redirect('/login');
  }
  return session;
}

export async function getOptionalSession() {
  return getServerSession(authConfig);
}

export async function requireAdmin() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    redirect('/login');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }
  return session;
}
