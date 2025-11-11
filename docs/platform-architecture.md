# Platform Architecture and Feature Plan

## Overview
This document outlines a recommended architecture and implementation plan for the e-commerce platform described in the project brief. The goal is to deliver a wallet-based digital goods storefront with instant-delivery and manual-fulfillment product flows, top-up management, and a comprehensive admin console.

## High-Level Architecture
- **Frontend:** Next.js or React SPA with TypeScript for maintainability, component reuse, and SSR/SSG options. Authentication handled via Supabase Auth UI components to minimize custom work.
- **Backend-as-a-Service:** Supabase (PostgreSQL + Auth + Storage + Edge Functions) leveraged for user auth, database, real-time updates, and serverless functions. This aligns with your Supabase Pro subscription.
- **Email & SMS Notifications:** Supabase Edge Functions integrating with Twilio SendGrid (email) and Twilio Programmable SMS if SMS alerts are required in the future.
- **Admin Panel:** Use a protected Next.js route with Supabase Row Level Security (RLS) enforcing admin role access. Alternatively, leverage open-source admin templates (e.g., React Admin) backed by Supabase REST endpoints.

## Data Model Recommendations
All tables reside in Supabase PostgreSQL. Suggested tables and key fields:

1. **users** (extend Supabase auth.users via `public.profiles`)
   - `id`, `email`, `display_name`, `phone_number`
   - `role` enum (`customer`, `admin`)
   - Wallet balance is stored in a separate `wallets` table to allow ledger tracking.

2. **wallets**
   - `user_id` (FK to users)
   - `balance`

3. **wallet_transactions** (ledger)
   - `id`
  - `user_id`
  - `type` enum (`topup`, `purchase`, `adjustment`)
  - `amount`
  - `status` (`pending`, `approved`, `rejected`)
  - `reference` (transaction reference/last 4 digits)
  - `created_at`, `approved_at`
  - `admin_comment`

4. **categories**
  - `id`, `name`, `slug`, `is_visible`

5. **products**
  - `id`, `category_id`
  - `name`, `slug`, `description`
  - `type` enum (`instant`, `manual`)
  - `status` (`in_stock`, `out_of_stock`)
  - `requires_customer_inputs` boolean
  - `customer_input_schema` JSONB (array of objects with `label`, `placeholder`, `field_key`, `required`)

6. **product_variants**
  - `id`, `product_id`
  - `name` (e.g., "1 Month", "3 Months")
  - `price`
  - `stock_quantity` (for instant goods tied to stock pool)
  - `is_active`

7. **inventory_items** (for instant products)
  - `id`, `product_variant_id`
  - `credential_email`, `credential_secret`
  - `metadata` JSONB (e.g., extra instructions)
  - `status` (`available`, `reserved`, `delivered`)
  - `delivered_at`

8. **orders**
  - `id` (numeric)
  - `user_id`
  - `status` (`pending`, `processing`, `completed`, `cancelled`)
  - `total_amount`
  - `payment_method` (`wallet`)
  - `created_at`, `completed_at`
  - `notes`

9. **order_items**
  - `id`, `order_id`, `product_variant_id`
  - `quantity`, `unit_price`
  - `delivery_type` (`instant`, `manual`)
  - `customer_inputs` JSONB (customer-provided form values)
  - `delivered_payload` JSONB (stores credentials or manual delivery info)

10. **topup_requests**
   - `id`, `user_id`
   - `amount`
   - `bank_option` (FK to `payment_channels`)
   - `transaction_last4`
   - `status` (`pending`, `approved`, `rejected`)
   - `submitted_at`, `processed_at`

11. **payment_channels**
   - `id`, `name`, `account_holder`, `account_number`, `qr_code_url`, `instructions`
   - `is_active`

12. **notifications_log**
   - `id`, `type`, `target`, `payload`, `sent_at`, `status`

## Key Functional Workflows

### Category & Product Browsing
- Landing page fetches categories only.
- Upon selecting a category, fetch products and variants via Supabase RPC or REST.
- Variants displayed with stock status; out-of-stock variants disabled.

### Product Detail & Purchase Flow
- Variant selection drives price display and stock check.
- Checkout uses wallet balance; enforce guard to ensure balance >= total.
- Manual products display dynamic form inputs based on `customer_input_schema`.
- Instant products reserve inventory items during checkout; mark as delivered once payment confirmed.
- Manual products remain in `processing` until admin updates with fulfillment details.

### Wallet Top-Up Flow
- Top-up modal lists `payment_channels` (bank accounts/QR codes).
- Customer submits amount and last 4 digits; record in `topup_requests` and `wallet_transactions` (status pending).
- Trigger Supabase Edge Function to email admin with approval link.
- Admin reviews in panel; approval updates status, credits wallet via transaction entry, sends confirmation email to customer.

### Orders & Delivery
- Customer Orders page lists `orders` with copy buttons for delivered credentials.
- Use clipboard.js or navigator.clipboard for copy actions.
- Each order item row includes email/password fields rendered conditionally when `delivered_payload` contains credentials.
- Manual fulfillment: admin updates `delivered_payload` with relevant data (invitation link, instructions) once ready; triggers notification to customer.

### Notifications
- Use Supabase Functions + Twilio SendGrid to send emails on top-up submission, approval, rejection, order delivery, and stock depletion.
- Consider webhook to notify admin when inventory runs low by subscribing to PostgreSQL trigger that checks `stock_quantity`.

## Admin Panel Features
- Dashboard charts (sales today, month-to-date, pending top-ups, low-stock alerts) using Supabase queries.
- Wallet adjustments: form to add/remove balance by inserting `wallet_transactions` with `adjustment` type.
- Product management: toggle status, manage variants, upload inventory CSV for instant products.
- Order search: search by `id`, `customer email`, `phone number` using Supabase full-text search or filtered queries.
- Top-up review workflow with approve/reject buttons storing admin comment.

## Security & Access Control
- Use Supabase RLS policies to restrict customers to their data.
- Admin role stored in `profiles.role`; Supabase JWT includes custom claim.
- Edge Functions handle sensitive operations (wallet adjustments, notifications) with service role key.

## Deployment Considerations
- Host frontend on Vercel or Supabase Hosting.
- Configure environment variables for Supabase keys and Twilio credentials.
- Set up cron/Edge scheduler to send daily sales summary emails.

## Recommended Next Steps
1. Scaffold Next.js app with Supabase client integration and auth guard.
2. Implement database schema via Supabase SQL migrations (DB Designer -> SQL).
3. Build wallet top-up flow (UI + Supabase functions).
4. Implement product catalog browsing and checkout logic.
5. Create admin dashboard with RBAC enforcement.
6. Add notification automations and stock alerts.

## Additional Notes
- Supabase is recommended as the primary database, leveraging PostgreSQL for structured data and JSONB flexibility.
- Twilio SendGrid for transactional emails; plain Twilio SMS optional add-on.
- Consider storing sensitive credentials encrypted (pgcrypto) or using Supabase Vault once available.

