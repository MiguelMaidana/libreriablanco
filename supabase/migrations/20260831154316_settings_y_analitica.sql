create table public.settings (
  id smallint primary key default 1 check (id = 1),
  business_name text,
  legal_name text,
  tax_id text,
  logo_url text,
  address text,
  phone text,
  whatsapp_number text,
  email text,
  business_hours text,
  transfer_alias text,
  transfer_account_holder text,
  transfer_cbu_cvu text,
  transfer_bank_or_wallet text,
  transfer_instructions text,
  whatsapp_general_message text,
  whatsapp_receipt_template text,
  whatsapp_shipping_inquiry_template text,
  store_enabled boolean not null default true,
  hero_title text,
  hero_text text,
  hero_image_url text,
  hero_cta_text text,
  hero_cta_link text,
  pickup_instructions_text text,
  updated_at timestamptz not null default now()
);

-- Fila única sembrada — el check (id = 1) de la columna impide una segunda fila.
insert into public.settings (id) values (1)
on conflict (id) do nothing;

create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('view','search','add_to_cart','sale')),
  product_id uuid references public.products(id),
  search_term text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid references public.admin_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
