# PremiumCity digital storefront

A Next.js 14 + Prisma implementation of a wallet-first digital goods storefront supporting instant credential delivery, manual subscription fulfillment, wallet top ups, and an admin control panel. Styling is powered by Tailwind CSS utility classes.

## Features

- Customer registration, login (NextAuth credentials provider)
- Wallet ledger with top-up submissions and admin approval flow
- Category-driven catalog with instant/manual product types and variant pricing
- Instant product stock management with credential vaulting
- Manual orders capture custom input fields for admin fulfilment
- Order history with copy-to-clipboard delivery details
- Admin panel for catalog configuration, bank accounts, inventory upload, top-up review, and order inspection
- Email notifications via SMTP (falls back to console logging if `SMTP_URL` is not set)

## Getting started

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

### Seed an admin user

```bash
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=supersecret npx tsx prisma/seed.ts
```

Log in at `/login` with the seeded credentials to access the admin panel.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | SQLite connection string (defaults to `file:./dev.db`) |
| `NEXTAUTH_SECRET` | Secret used by NextAuth JWT sessions |
| `NEXTAUTH_URL` | Base URL of the deployed site |
| `SMTP_URL` | SMTP connection string for transactional email (optional) |
| `MAIL_FROM` | From address for outgoing email (optional) |
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
- When `SMTP_URL` is not set, payloads log to the console for development

## Limitations & next steps

- Payment gateway integration for automated top-up validation is not implemented
- Admin table search is provided via browser find; dedicated filters or search endpoints can be added
- Audit logging and fine-grained permissions can be layered on top of the current Prisma data model
