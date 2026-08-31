create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  document_type text,
  document_number text,
  tax_condition text,
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers(id),
  status text not null default 'NEW' check (status in ('NEW','COMPLETED','CANCELLED')),
  subtotal numeric(12,2) not null,
  total numeric(12,2) not null,
  payment_method text not null default 'BANK_TRANSFER' check (payment_method in ('BANK_TRANSFER')),
  payment_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name_snapshot text not null,
  sku_snapshot text,
  unit_cost_snapshot numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  quantity int not null check (quantity > 0),
  subtotal numeric(12,2) not null
);
