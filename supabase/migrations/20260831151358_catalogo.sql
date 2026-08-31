create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id),
  icon text,
  image_url text,
  is_featured boolean not null default false,
  display_order int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  internal_code text unique,
  sku text unique,
  barcode text,
  isbn text,
  name text not null,
  short_description text,
  full_description text,
  brand text,
  publisher text,
  author text,
  category_id uuid not null references public.categories(id),
  tags text[],
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null,
  sale_price numeric(12,2),
  profit numeric(12,2) generated always as (price - cost) stored,
  margin_percent numeric(5,2) generated always as (
    case when price = 0 then 0 else round(((price - cost) / price) * 100, 2) end
  ) stored,
  available boolean not null default true,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  featured_order int,
  is_new boolean not null default false,
  updated_by uuid references public.admin_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  position int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
