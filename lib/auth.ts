import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "./rate-limit";

const isProd = process.env.NODE_ENV === "production";

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
    console.error("AUTH: supabase REST error looking up user:", res.status);
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

function getRequestIp(req: { headers?: Record<string, string> } | undefined): string {
  const headers = req?.headers ?? {};
  return (
    headers["cf-connecting-ip"]?.trim() ||
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    headers["x-real-ip"]?.trim() ||
    "unknown"
  );
}

export const authConfig: NextAuthOptions = {
  debug: false,
  logger: {
    error: (code, metadata) => console.error("NEXTAUTH_ERROR:", code, (metadata as any)?.message ?? ""),
    warn: (code) => console.warn("NEXTAUTH_WARN:", code),
    debug: () => {},
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: isProd,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // This is the ONLY place that actually authenticates a login. Rate
      // limiting here is enforced server-side no matter how the request was
      // made, so it can't be bypassed by calling the credentials callback
      // directly and skipping the client-side /api/auth/login-guard
      // pre-check (which only exists for fast UX feedback).
      authorize: async (credentials, req) => {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const email = credentials.email.toLowerCase().trim();
          const ip = getRequestIp(req as any);

          const [emailRl, ipRl] = await Promise.all([
            checkRateLimit({
              key: `login:email:${email}`,
              route: "login-authorize",
              windowInSeconds: 15 * 60,
              maxRequests: 8,
            }),
            checkRateLimit({
              key: `login:ip:${ip}`,
              route: "login-authorize",
              windowInSeconds: 15 * 60,
              maxRequests: 40,
            }),
          ]);

          if (!emailRl.allowed || !ipRl.allowed) {
            return null;
          }

          const user = await fetchUserByEmail(email);
          if (!user) return null;

          const ok = await bcrypt.compare(credentials.password, user.password_hash);
          if (!ok) return null;

          return { id: String(user.id), email: user.email, role: user.role } as any;
        } catch (e) {
          console.error("AUTH: authorize exception:", (e as Error)?.message);
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
};
