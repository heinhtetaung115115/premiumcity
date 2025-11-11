-- Enable extensions
create extension if not exists "pgcrypto";

-- Timestamp trigger helper
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enumerations
create type public.user_role as enum ('CUSTOMER', 'ADMIN');
create type public.product_type as enum ('INSTANT', 'MANUAL');
create type public.product_status as enum ('ACTIVE', 'INACTIVE');
create type public.order_status as enum ('PENDING_FULFILLMENT', 'FULFILLED', 'CANCELLED');
create type public.wallet_transaction_type as enum ('TOPUP', 'PURCHASE', 'ADJUSTMENT', 'REFUND');
create type public.topup_status as enum ('PENDING', 'APPROVED', 'REJECTED');

-- Users
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  role public.user_role not null default 'CUSTOMER',
  wallet_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_current_timestamp_updated_at();

-- Wallet transactions
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.wallet_transaction_type not null,
  amount numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  reference text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index wallet_transactions_user_idx on public.wallet_transactions(user_id, created_at desc);

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_current_timestamp_updated_at();

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid not null references public.categories(id) on delete cascade,
  product_type public.product_type not null,
  status public.product_status not null default 'ACTIVE',
  is_in_stock boolean not null default true,
  input_schema jsonb,
  delivery_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id);

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_current_timestamp_updated_at();

-- Product variants
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric(14,2) not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants(product_id);

create trigger set_product_variants_updated_at
before update on public.product_variants
for each row execute function public.set_current_timestamp_updated_at();

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  user_id uuid not null references public.users(id) on delete cascade,
  total numeric(14,2) not null,
  status public.order_status not null default 'PENDING_FULFILLMENT',
  payment_method text not null default 'WALLET',
  manual_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx on public.orders(user_id, created_at desc);

create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_current_timestamp_updated_at();

-- Order items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null default 1,
  price numeric(14,2) not null,
  manual_input jsonb,
  delivered_payload jsonb,
  delivery_status public.order_status not null default 'PENDING_FULFILLMENT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);

create trigger set_order_items_updated_at
before update on public.order_items
for each row execute function public.set_current_timestamp_updated_at();

-- Inventory items
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  payload jsonb not null,
  note text,
  assigned_at timestamptz,
  order_item_id uuid references public.order_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_product_idx on public.inventory_items(product_id);
create index inventory_items_variant_idx on public.inventory_items(variant_id);
create index inventory_items_order_item_idx on public.inventory_items(order_item_id);

create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_current_timestamp_updated_at();

-- Topup requests
create table public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(14,2) not null,
  bank_name text not null,
  reference_hint text not null,
  status public.topup_status not null default 'PENDING',
  admin_comment text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index topup_requests_user_idx on public.topup_requests(user_id, created_at desc);

create trigger set_topup_requests_updated_at
before update on public.topup_requests
for each row execute function public.set_current_timestamp_updated_at();

-- Bank accounts
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_name text not null,
  account_no text not null,
  qr_code_url text,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_bank_accounts_updated_at
before update on public.bank_accounts
for each row execute function public.set_current_timestamp_updated_at();

-- Notifications log (optional)
create table if not exists public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  target text not null,
  payload jsonb,
  sent_at timestamptz not null default now(),
  status text
);

-- Wallet mutation helper
create or replace function public.record_wallet_transaction(
  p_user_id uuid,
  p_type public.wallet_transaction_type,
  p_amount numeric,
  p_reference text default null,
  p_metadata jsonb default null
) returns public.wallet_transactions
language plpgsql
as $$
declare
  v_balance numeric(14,2);
  v_transaction public.wallet_transactions%rowtype;
begin
  update public.users
  set wallet_balance = wallet_balance + p_amount,
      updated_at = now()
  where id = p_user_id
  returning wallet_balance into v_balance;

  if v_balance is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if v_balance < 0 then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  insert into public.wallet_transactions(user_id, type, amount, balance_after, reference, metadata)
  values (p_user_id, p_type, p_amount, v_balance, p_reference, p_metadata)
  returning * into v_transaction;

  return v_transaction;
end;
$$;

-- Order creation workflow
create or replace function public.create_order(
  p_user_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_manual_input jsonb default null
) returns uuid
language plpgsql
as $$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_quantity integer := greatest(coalesce(p_quantity, 1), 1);
  v_total numeric(14,2);
  v_order public.orders%rowtype;
  v_order_item public.order_items%rowtype;
  v_inventory_ids uuid[];
  v_credentials jsonb;
begin
  select * into v_product
  from public.products
  where id = p_product_id;

  if not found or v_product.status <> 'ACTIVE' or v_product.is_in_stock = false then
    raise exception 'PRODUCT_UNAVAILABLE';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id
    and product_id = p_product_id
    and is_active = true;

  if not found then
    raise exception 'INVALID_VARIANT';
  end if;

  v_total := v_variant.price * v_quantity;

  if v_product.product_type = 'INSTANT' then
    with inventory_selection as (
      select id
      from public.inventory_items
      where product_id = p_product_id
        and (variant_id = p_variant_id or variant_id is null)
        and order_item_id is null
      order by created_at asc
      limit v_quantity
      for update skip locked
    )
    select array_agg(id) into v_inventory_ids from inventory_selection;

    if array_length(v_inventory_ids, 1) is distinct from v_quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;
  end if;

  insert into public.orders(user_id, total, status, payment_method, manual_payload)
  values (
    p_user_id,
    v_total,
    case when v_product.product_type = 'INSTANT' then 'FULFILLED' else 'PENDING_FULFILLMENT' end,
    'WALLET',
    null
  )
  returning * into v_order;

  insert into public.order_items(order_id, product_id, variant_id, quantity, price, manual_input, delivered_payload, delivery_status)
  values (
    v_order.id,
    p_product_id,
    p_variant_id,
    v_quantity,
    v_variant.price,
    p_manual_input,
    null,
    case when v_product.product_type = 'INSTANT' then 'FULFILLED' else 'PENDING_FULFILLMENT' end
  )
  returning * into v_order_item;

  if v_product.product_type = 'INSTANT' then
    update public.inventory_items
    set order_item_id = v_order_item.id,
        assigned_at = now()
    where id = any(v_inventory_ids);

    select jsonb_build_object('credentials', jsonb_agg(payload))
      into v_credentials
    from public.inventory_items
    where id = any(v_inventory_ids);

    update public.order_items
    set delivered_payload = v_credentials
    where id = v_order_item.id;
  end if;

  perform public.record_wallet_transaction(
    p_user_id,
    'PURCHASE',
    -v_total,
    v_order.id::text,
    jsonb_build_object('productName', v_product.name, 'variantName', v_variant.name, 'quantity', v_quantity)
  );

  return v_order.id;
end;
$$;

-- Top up approval workflow
create or replace function public.approve_topup(
  p_topup_id uuid,
  p_admin_id uuid
) returns public.topup_requests
language plpgsql
as $$
declare
  v_topup public.topup_requests%rowtype;
begin
  select * into v_topup
  from public.topup_requests
  where id = p_topup_id
  for update;

  if not found then
    raise exception 'TOPUP_NOT_FOUND';
  end if;

  if v_topup.status <> 'PENDING' then
    raise exception 'INVALID_STATUS';
  end if;

  update public.topup_requests
  set status = 'APPROVED',
      admin_comment = coalesce(v_topup.admin_comment, format('Approved by %s', p_admin_id)),
      processed_at = now(),
      updated_at = now()
  where id = p_topup_id
  returning * into v_topup;

  perform public.record_wallet_transaction(
    v_topup.user_id,
    'TOPUP',
    v_topup.amount,
    v_topup.id::text,
    jsonb_build_object('bankName', v_topup.bank_name, 'referenceHint', v_topup.reference_hint)
  );

  return v_topup;
end;
$$;

create or replace function public.reject_topup(
  p_topup_id uuid,
  p_admin_id uuid,
  p_comment text default null
) returns public.topup_requests
language plpgsql
as $$
declare
  v_topup public.topup_requests%rowtype;
begin
  update public.topup_requests
  set status = 'REJECTED',
      admin_comment = coalesce(p_comment, format('Rejected by %s', p_admin_id)),
      processed_at = now(),
      updated_at = now()
  where id = p_topup_id
  returning * into v_topup;

  if not found then
    raise exception 'TOPUP_NOT_FOUND';
  end if;

  return v_topup;
end;
$$;
