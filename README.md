# PremiumCity digital storefront

A Next.js 14 storefront for wallet-based digital goods powered by Supabase for persistence/auth data and Twilio SendGrid for transactional email. Styling uses Tailwind CSS utility classes.

## Features

- Customer registration & login (NextAuth credentials provider backed by Supabase `users` table)
- Wallet ledger with Supabase-stored transactions plus top-up submissions and admin approval flow
- Category-driven catalog with instant/manual product types and variant pricing
- Instant product stock management with credential vaulting
- Manual orders capture custom input fields for admin fulfilment
- Order history with copy-to-clipboard delivery details
- Admin panel for catalog configuration, bank accounts, inventory upload, top-up review, and order inspection
- Email notifications delivered via Twilio SendGrid (console fallback when not configured)

## Getting started

1. Make sure you are on the latest `work` branch revision (the project no longer ships a `prisma/` directory or `schema.prisma`). Run `git status` and `git pull` to confirm you have the Supabase version locally.

2. Copy the environment template and populate credentials. `NEXTAUTH_SECRET` (or `AUTH_SECRET`) **must** be set before running `npm run build` or deploying; use any long random string for local development:

```bash
cp .env.example .env
```

3. Initialise Supabase by running the full schema in the hosted SQL editor. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) into the SQL editor and execute it **once**; this creates all tables, enums, triggers, and helper RPC functions that the app expects. No Prisma migrations are required.

4. (Optional) Verify the Supabase schema with your environment variables set:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="service-role-key" \
npm run verify:supabase
```

5. Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

6. Manually insert your first admin user in Supabase (replace the email/password accordingly):

```sql
insert into public.users (email, password_hash, role)
values ('admin@example.com', crypt('supersecret', gen_salt('bf')), 'ADMIN');
```

> ℹ️ The schema enables the `pgcrypto` extension so `crypt`/`gen_salt` are available.

Log in at `/login` with the seeded credentials to access the admin panel.

## Deploying to Vercel

1. Create a new project from this repository in the Vercel dashboard.
2. In **Project Settings → Environment Variables**, add the variables listed above. Use your production Supabase credentials, set
   `NEXTAUTH_URL` to your Vercel domain (for example `https://premiumcity.vercel.app`), and choose a strong `NEXTAUTH_SECRET`.
3. Trigger a new deployment. The catalog and product pages are forced to render dynamically so they no longer try to run Supabase
   queries during the build step, avoiding `SUPABASE_SERVICE_ROLE_KEY` errors when the build environment lacks that secret.
4. After the first deploy, seed at least one admin user through the Supabase SQL editor or an admin script so you can log in to the
   dashboard in production.

## Environment variables

| Variable | Description |
| --- | --- |
| `NEXTAUTH_SECRET` | Secret used by NextAuth JWT sessions |
| `NEXTAUTH_URL` | Base URL of the deployed site |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (used on the client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for server actions |
| `SENDGRID_API_KEY` | Twilio SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Verified sender email for SendGrid |
| `SENDGRID_FROM_NAME` | Display name for outgoing email |
| `ADMIN_ALERT_EMAIL` | Address that receives top-up/manual fulfillment alerts |

## Manual input schema format

Products that require customer input should specify JSON array of fields when created from the admin panel:

```json
[
  { "id": "zoomEmail", "label": "Zoom email", "required": true },
  { "id": "note", "label": "Notes", "placeholder": "e.g. renewal date" }
]
```

## Email notifications

- Customer wallet top-ups trigger an email to `ADMIN_ALERT_EMAIL`
- Manual orders trigger admin email and, upon fulfilment, customer delivery email
- When `SENDGRID_API_KEY` is not set, payloads log to the console for development

## Limitations & next steps

- Payment gateway integration for automated top-up validation is not implemented
- Admin table search is provided via browser find; dedicated filters or search endpoints can be added
- Additional automation (low-stock alerts, daily sales summaries) can be layered on top of the Supabase functions included in `supabase/schema.sql`
