import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { getServiceSupabaseClient } from './supabase';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const authConfig: NextAuthConfig = {
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const supabase = getServiceSupabaseClient();
        const { data: user, error } = await supabase
          .from('users')
          .select('id, email, password_hash, name, role')
          .eq('email', parsed.data.email.toLowerCase())
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!user || !user.password_hash) {
          return null;
        }

        const valid = await compare(parsed.data.password, user.password_hash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role ?? 'CUSTOMER'
        };
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user = {
          ...session.user,
          id: token.sub,
          role: (token.role as string | undefined) ?? 'CUSTOMER'
        } as typeof session.user & { id: string; role: string };
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? 'CUSTOMER';
      }
      return token;
    }
  }
};
