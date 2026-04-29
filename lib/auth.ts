import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

async function fetchUserByEmail(email: string) {
  const url =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users` +
    `?select=id,email,role,password_hash&email=eq.${encodeURIComponent(email)}&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      Accept: "application/json",
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error("AUTH_DEBUG supabase REST error:", res.status, await res.text());
    return null;
  }

  const rows = (await res.json()) as Array<{
    id: string | number;
    email: string;
    role: string;
    password_hash: string;
  }>;
  return rows?.[0] ?? null;
}

export const authConfig: NextAuthOptions = {
  debug: true,
  logger: {
    error: (code, metadata) => console.error("NEXTAUTH_ERROR:", code, metadata),
    warn: (code) => console.warn("NEXTAUTH_WARN:", code),
    debug: (code, metadata) => console.log("NEXTAUTH_DEBUG:", code, metadata),
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const user = await fetchUserByEmail(credentials.email);
          console.log("AUTH_DEBUG fetched user:", user?.email ?? null);
          if (!user) return null;

          const ok = await bcrypt.compare(credentials.password, user.password_hash);
          console.log("AUTH_DEBUG password_ok:", ok);
          if (!ok) return null;

          return { id: String(user.id), email: user.email, role: user.role } as any;
        } catch (e) {
          console.error("AUTH_DEBUG authorize exception:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // token.sub is set from user.id by NextAuth
        // @ts-ignore
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) session.user = {} as any;
      if (token?.sub) (session.user as any).id = token.sub;
      if (token?.role) (session.user as any).role = token.role as string;
      return session;
    },
  },
  // pages: { signIn: "/login" }, // keep default page for now while debugging
};
