# Fase 1a — Modelo de datos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el esquema completo del MVP de Librería Blanco (14 tablas
+ 1 vista) como migraciones versionadas de Supabase, con RLS específico
por tabla, aplicado localmente (Docker) y en el proyecto real, con tipos
TypeScript generados y conectados al código existente.

**Architecture:** Supabase CLI + Postgres local vía Docker para
desarrollar y verificar cada migración antes de aplicarla al proyecto
real (`supabase db push`). Cada migración es un archivo SQL versionado
en `supabase/migrations/`. El motor de permisos vive en dos funciones
Postgres (`has_permission`, `is_super_admin`) reutilizables desde RLS y,
en la Fase 1b, desde código de servidor.

**Tech Stack:** Supabase CLI, PostgreSQL (vía Supabase local + el
proyecto real ya creado en Fase 0), `supabase-js`/`@supabase/ssr` (ya
instalados).

**Spec:** `docs/superpowers/specs/2026-08-31-fase1a-modelo-de-datos-design.md`

## Global Constraints

- RLS habilitado en las 14 tablas, sin excepción (spec de fase §6).
- Ninguna política usa `using (true)` sin una justificación de negocio
  explícita en un comentario SQL — las únicas dos excepciones legítimas
  de esta fase son `settings` (toda la fila es pública por diseño, spec
  maestra §26) y el `insert` anónimo en `product_events` (registrar una
  señal no expone ni compromete nada). Cualquier otra política debe
  filtrar por una condición real.
- `products.cost`, `products.profit` y `products.margin_percent` nunca
  deben ser alcanzables por el rol `anon` — ni por política de RLS ni
  por la vista pública.
- Los snapshots de `order_items` (`product_name_snapshot`,
  `sku_snapshot`, `unit_cost_snapshot`) nunca se recalculan ni se
  actualizan automáticamente si el producto cambia después.
- Todas las tablas usan `uuid` como clave primaria (`gen_random_uuid()`)
  salvo `settings` (fila única, `smallint` fijo) y las tablas puente
  (clave compuesta).
- No crear ninguna entidad evolutiva fuera de las 14 de la spec de fase
  (`payments`, `invoices`, `suppliers`, etc.) — spec maestra §49.

---

## File Structure

```text
supabase/
  config.toml                      # generado por `supabase init`
  migrations/
    <ts>_admin_rbac.sql             # Task 2
    <ts>_catalogo.sql               # Task 3
    <ts>_comercio.sql               # Task 4
    <ts>_settings_y_analitica.sql   # Task 5
    <ts>_rls_policies.sql           # Task 6

types/
  supabase.ts                       # generado, Task 7

lib/supabase/
  client.ts                         # modificado, Task 7 (Database genérico)
  server.ts                         # modificado, Task 7 (Database genérico)
```

`<ts>` es el timestamp de 14 dígitos que `supabase migration new`
genera automáticamente al momento de correrlo — no se puede fijar de
antemano; cada task localiza su archivo con un glob.

**Nota sobre `supabase db execute --local --sql "..."`:** este plan usa
ese comando para correr SQL ad-hoc de verificación contra el stack
local. Si la versión instalada del CLI no lo soporta con esa forma
exacta, usar como alternativa (en este orden de preferencia):

1. `psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "..."` (el connection string local que imprime `supabase start`/`supabase status` — ajustar usuario/password/puerto si difieren).
2. `pnpm exec supabase db execute --help` (o `supabase db --help`) para ver el subcomando real de la versión instalada, y adaptar la sintaxis manteniendo la misma intención (correr la consulta SQL indicada y confirmar el resultado esperado).
3. Como último recurso, pegar la consulta en el SQL Editor de Supabase Studio local (`http://localhost:54323`) y confirmar el resultado visualmente.

Cualquiera de las tres formas es válida — lo que importa es efectivamente
correr cada consulta de verificación y confirmar el resultado esperado,
no el comando exacto usado para hacerlo.

---

### Task 1: Instalar Supabase CLI y levantar el stack local

**Files:**
- Modify: `package.json` (agregar `supabase` a `devDependencies`)
- Create: `supabase/config.toml` (generado por `supabase init`)
- Create: `supabase/migrations/` (carpeta vacía, generada por `supabase init`)

**Interfaces:**
- Consumes: nada (primer task de la fase).
- Produces: comando `pnpm exec supabase <subcomando>` disponible;
  stack local corriendo (`supabase start`) con Postgres accesible en
  `localhost:54322`, API REST en `localhost:54321`, Studio en
  `localhost:54323`.

- [ ] **Step 1: Instalar el CLI de Supabase como devDependency**

```bash
pnpm add -D supabase
```

- [ ] **Step 2: Inicializar el proyecto Supabase**

```bash
pnpm exec supabase init
```

Si pide confirmación interactiva (por ejemplo sobre generar
`.vscode/settings.json` o extensiones recomendadas), aceptar los
defaults o pasar el flag de no-interactivo que la versión instalada
soporte (`-y` / `--yes` / similar) — el objetivo es terminar con
`supabase/config.toml` y `supabase/migrations/` creados.

- [ ] **Step 3: Levantar el stack local (requiere Docker Desktop corriendo)**

```bash
pnpm exec supabase start
```

Expected: al terminar, imprime una tabla con `API URL`, `DB URL`,
`Studio URL`, `anon key` y `service_role key` **locales** (no son
secretos reales de producción — son claves fijas y públicas del stack
de desarrollo de Supabase, documentadas así por Supabase mismo; no
requieren tratamiento especial). Confirmar que el comando termina sin
errores.

- [ ] **Step 4: Verificar conexión**

```bash
pnpm exec supabase status
```

Expected: muestra el mismo resumen de URLs, confirma que los servicios
están corriendo.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml supabase/config.toml supabase/.gitignore
git commit -m "chore: instalar Supabase CLI y levantar stack local"
```

(`supabase init` genera su propio `supabase/.gitignore` — usarlo tal
cual, no hace falta editarlo.)

---

### Task 2: Migración — Admin & RBAC

**Files:**
- Create: `supabase/migrations/<ts>_admin_rbac.sql`

**Interfaces:**
- Consumes: `auth.users` (esquema propio de Supabase Auth, ya existe).
- Produces: tablas `admin_profiles`, `roles`, `permissions`,
  `role_permissions`, `admin_profile_roles`; funciones
  `has_permission(uuid, text, text) returns boolean` y
  `is_super_admin(uuid) returns boolean` — ambas usadas por Task 6 (RLS)
  y, en Fase 1b, por código de servidor.

- [ ] **Step 1: Generar el archivo de migración**

```bash
pnpm exec supabase migration new admin_rbac
```

Anotar el path exacto que imprime (algo como
`supabase/migrations/20260831120000_admin_rbac.sql`) — se usa en los
pasos siguientes.

- [ ] **Step 2: Escribir el contenido de la migración**

```sql
create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('productos','precios','stock','pedidos','clientes','facturacion','usuarios','configuracion')),
  action text not null check (action in ('ver','crear','editar','eliminar')),
  unique (module, action)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.admin_profile_roles (
  admin_profile_id uuid not null references public.admin_profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (admin_profile_id, role_id)
);

-- Fuente de verdad única de autorización: se usa tanto en políticas RLS
-- (Task 6) como en checks de servidor (Fase 1b). SECURITY DEFINER para
-- poder leer role_permissions/admin_profile_roles sin depender de que
-- el rol que llama tenga permiso de lectura directa sobre esas tablas.
create or replace function public.has_permission(p_user_id uuid, p_module text, p_action text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_profile_roles apr
    join public.roles r on r.id = apr.role_id
    where apr.admin_profile_id = p_user_id
      and (
        r.is_super_admin
        or exists (
          select 1
          from public.role_permissions rp
          join public.permissions p on p.id = rp.permission_id
          where rp.role_id = r.id
            and p.module = p_module
            and p.action = p_action
        )
      )
  );
$$;

-- Gestionar roles/permisos en sí (no un módulo del catálogo normal) es
-- exclusivo de SUPER_ADMIN — spec maestra §11.
create or replace function public.is_super_admin(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_profile_roles apr
    join public.roles r on r.id = apr.role_id
    where apr.admin_profile_id = p_user_id
      and r.is_super_admin
  );
$$;

-- Catálogo fijo: 8 módulos x 4 acciones = 32 combinaciones. Las
-- políticas de Task 6 son las que efectivamente restringen cuáles se
-- usan; sembrar el catálogo completo es más simple que sembrar
-- selectivamente.
insert into public.permissions (module, action)
select m.module, a.action
from (values ('productos'),('precios'),('stock'),('pedidos'),('clientes'),('facturacion'),('usuarios'),('configuracion')) as m(module)
cross join (values ('ver'),('crear'),('editar'),('eliminar')) as a(action)
on conflict (module, action) do nothing;

-- Rol SUPER_ADMIN sembrado, sin asignar a nadie todavía (se asigna
-- manualmente cuando exista el primer usuario, en Fase 1b).
insert into public.roles (name, is_super_admin)
values ('SUPER_ADMIN', true)
on conflict (name) do nothing;
```

- [ ] **Step 3: Aplicar localmente**

```bash
pnpm exec supabase db reset
```

Expected: reaplica todas las migraciones existentes desde cero sin
errores (en esta etapa, solo esta migración).

- [ ] **Step 4: Verificar el catálogo sembrado**

```bash
pnpm exec supabase db execute --local --sql "select count(*) from public.permissions;"
```

Expected: `32`.

```bash
pnpm exec supabase db execute --local --sql "select name, is_super_admin from public.roles;"
```

Expected: una fila, `SUPER_ADMIN | t`.

- [ ] **Step 5: Verificar `has_permission` e `is_super_admin` con datos de prueba**

```sql
-- Insertar un usuario de auth de prueba (solo en el stack LOCAL — nunca
-- hacer esto contra el proyecto real)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'super@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'vendedora@test.local');

insert into public.admin_profiles (id, full_name) values
  ('00000000-0000-0000-0000-000000000001', 'Super de prueba'),
  ('00000000-0000-0000-0000-000000000002', 'Vendedora de prueba');

-- Asignar SUPER_ADMIN al primer usuario
insert into public.admin_profile_roles (admin_profile_id, role_id)
select '00000000-0000-0000-0000-000000000001', id from public.roles where name = 'SUPER_ADMIN';

-- Crear un rol normal con un único permiso y asignarlo al segundo usuario
insert into public.roles (name) values ('Vendedora');
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.name = 'Vendedora' and p.module = 'pedidos' and p.action = 'ver';
insert into public.admin_profile_roles (admin_profile_id, role_id)
select '00000000-0000-0000-0000-000000000002', id from public.roles where name = 'Vendedora';

-- Verificaciones
select public.has_permission('00000000-0000-0000-0000-000000000001', 'productos', 'eliminar'); -- true (super admin bypass)
select public.has_permission('00000000-0000-0000-0000-000000000002', 'pedidos', 'ver');          -- true
select public.has_permission('00000000-0000-0000-0000-000000000002', 'pedidos', 'eliminar');     -- false
select public.is_super_admin('00000000-0000-0000-0000-000000000001');                            -- true
select public.is_super_admin('00000000-0000-0000-0000-000000000002');                            -- false
```

Correr cada `select` con `pnpm exec supabase db execute --local --sql "..."` y confirmar
los valores esperados indicados en los comentarios. Estos datos de
prueba son solo para verificar esta migración — no hace falta
conservarlos ni limpiarlos (el stack local se resetea libremente).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: migración de admin, roles y permisos (RBAC)"
```

---

### Task 3: Migración — Catálogo (categorías, productos, imágenes)

**Files:**
- Create: `supabase/migrations/<ts>_catalogo.sql`

**Interfaces:**
- Consumes: `admin_profiles` (Task 2, para `products.updated_by`).
- Produces: tablas `categories`, `products` (con `profit` y
  `margin_percent` generadas), `product_images` — usadas por Task 4
  (`order_items.product_id`), Task 5 (`product_events.product_id`) y
  Task 6 (RLS + vista `public_products`).

- [ ] **Step 1: Generar el archivo de migración**

```bash
pnpm exec supabase migration new catalogo
```

- [ ] **Step 2: Escribir el contenido**

```sql
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
```

- [ ] **Step 3: Aplicar localmente**

```bash
pnpm exec supabase db reset
```

Expected: sin errores (esta migración + la de Task 2, en orden).

- [ ] **Step 4: Verificar las columnas generadas**

```sql
insert into public.categories (name, slug) values ('Cuadernos', 'cuadernos');

insert into public.products (name, category_id, cost, price)
select 'Cuaderno de prueba', id, 1000, 1500
from public.categories where slug = 'cuadernos';

select name, cost, price, profit, margin_percent from public.products;
```

Expected: `profit = 500.00`, `margin_percent = 33.33`.

```sql
insert into public.products (name, category_id, cost, price)
select 'Producto a costo cero', id, 0, 0
from public.categories where slug = 'cuadernos';

select margin_percent from public.products where name = 'Producto a costo cero';
```

Expected: `0.00` (no un error de división por cero).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: migración de catálogo (categorías, productos, imágenes)"
```

---

### Task 4: Migración — Comercio (clientes, pedidos, items)

**Files:**
- Create: `supabase/migrations/<ts>_comercio.sql`

**Interfaces:**
- Consumes: `products` (Task 3, para `order_items.product_id`).
- Produces: tablas `customers`, `orders`, `order_items` — usadas por
  Task 6 (RLS).

- [ ] **Step 1: Generar el archivo de migración**

```bash
pnpm exec supabase migration new comercio
```

- [ ] **Step 2: Escribir el contenido**

```sql
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
```

- [ ] **Step 3: Aplicar localmente**

```bash
pnpm exec supabase db reset
```

Expected: sin errores.

- [ ] **Step 4: Verificar con un pedido de punta a punta**

```sql
insert into public.customers (first_name, last_name, email)
values ('María', 'González', 'maria@test.local');

insert into public.orders (order_number, customer_id, subtotal, total)
select 'LB-0001', id, 1500, 1500 from public.customers where email = 'maria@test.local';

insert into public.order_items (order_id, product_id, product_name_snapshot, unit_cost_snapshot, unit_price, quantity, subtotal)
select o.id, p.id, p.name, p.cost, p.price, 1, p.price
from public.orders o, public.products p
where o.order_number = 'LB-0001' and p.name = 'Cuaderno de prueba';

select c.email, o.order_number, o.total, oi.product_name_snapshot, oi.quantity
from public.orders o
join public.customers c on c.id = o.customer_id
join public.order_items oi on oi.order_id = o.id;
```

Expected: una fila con los datos insertados, sin errores de FK.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: migración de comercio (clientes, pedidos, items)"
```

---

### Task 5: Migración — Configuración y analítica

**Files:**
- Create: `supabase/migrations/<ts>_settings_y_analitica.sql`

**Interfaces:**
- Consumes: `products` (Task 3, para `product_events.product_id`),
  `admin_profiles` (Task 2, para `audit_logs.admin_profile_id`).
- Produces: tablas `settings` (con fila sembrada), `product_events`,
  `audit_logs` — usadas por Task 6 (RLS).

- [ ] **Step 1: Generar el archivo de migración**

```bash
pnpm exec supabase migration new settings_y_analitica
```

- [ ] **Step 2: Escribir el contenido**

```sql
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
```

- [ ] **Step 3: Aplicar localmente**

```bash
pnpm exec supabase db reset
```

Expected: sin errores.

- [ ] **Step 4: Verificar la fila única de settings**

```sql
select count(*) from public.settings; -- esperado: 1

insert into public.settings (id, business_name) values (2, 'Otra fila');
```

Expected: el segundo `insert` falla con una violación del `check`
(`id = 1`) — confirmar que efectivamente rechaza la segunda fila.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: migración de configuración y analítica (settings, product_events, audit_logs)"
```

---

### Task 6: Migración — RLS y vista pública de productos

**Files:**
- Create: `supabase/migrations/<ts>_rls_policies.sql`

**Interfaces:**
- Consumes: las 11 tablas de Tasks 2-5.
- Produces: RLS habilitado + políticas en las 14 tablas; vista
  `public_products`; función auxiliar
  `is_product_visible(uuid) returns boolean`.

- [ ] **Step 1: Generar el archivo de migración**

```bash
pnpm exec supabase migration new rls_policies
```

- [ ] **Step 2: Escribir el contenido**

```sql
-- Vista pública de productos: nunca expone cost/profit/margin_percent,
-- y ya filtra por publicado+disponible en su propia definición.
create view public.public_products as
select
  id, internal_code, sku, barcode, isbn, name, short_description, full_description,
  brand, publisher, author, category_id, tags, price, sale_price,
  available, is_published, is_featured, featured_order, is_new, created_at
from public.products
where is_published = true and available = true;

grant select on public.public_products to anon, authenticated;

-- Helper SECURITY DEFINER: una política RLS que consulta OTRA tabla
-- (aquí, product_images consultando products) queda sujeta a la RLS de
-- esa otra tabla para el rol que ejecuta la consulta. Como `anon` no
-- tiene ninguna política de lectura sobre `products`, una subconsulta
-- directa siempre devolvería cero filas. Esta función, al ser
-- SECURITY DEFINER, se ejecuta con los privilegios de quien la creó
-- (bypassea RLS), evitando ese problema.
create or replace function public.is_product_visible(p_product_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.products
    where id = p_product_id
      and is_published = true
      and available = true
  );
$$;

-- categories
alter table public.categories enable row level security;

create policy "public reads active categories"
  on public.categories for select
  to anon, authenticated
  using (is_active = true);

create policy "admins with productos ver read categories"
  on public.categories for select
  to authenticated
  using (public.has_permission(auth.uid(), 'productos', 'ver'));

create policy "admins with productos crear insert categories"
  on public.categories for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'productos', 'crear'));

create policy "admins with productos editar update categories"
  on public.categories for update
  to authenticated
  using (public.has_permission(auth.uid(), 'productos', 'editar'))
  with check (public.has_permission(auth.uid(), 'productos', 'editar'));

-- products (sin acceso público directo — usar public_products)
alter table public.products enable row level security;

create policy "admins with productos ver read products"
  on public.products for select
  to authenticated
  using (public.has_permission(auth.uid(), 'productos', 'ver'));

create policy "admins with productos crear insert products"
  on public.products for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'productos', 'crear'));

create policy "admins with productos editar update products"
  on public.products for update
  to authenticated
  using (public.has_permission(auth.uid(), 'productos', 'editar'))
  with check (public.has_permission(auth.uid(), 'productos', 'editar'));

-- product_images
alter table public.product_images enable row level security;

create policy "public reads images of visible products"
  on public.product_images for select
  to anon, authenticated
  using (public.is_product_visible(product_id));

create policy "admins with productos editar manage images"
  on public.product_images for all
  to authenticated
  using (public.has_permission(auth.uid(), 'productos', 'editar'))
  with check (public.has_permission(auth.uid(), 'productos', 'editar'));

-- customers (sin acceso público — alta/edición server-side con service role)
alter table public.customers enable row level security;

create policy "admins with clientes ver read customers"
  on public.customers for select
  to authenticated
  using (public.has_permission(auth.uid(), 'clientes', 'ver'));

create policy "admins with clientes editar update customers"
  on public.customers for update
  to authenticated
  using (public.has_permission(auth.uid(), 'clientes', 'editar'))
  with check (public.has_permission(auth.uid(), 'clientes', 'editar'));

-- orders / order_items (sin acceso público — creación server-side)
alter table public.orders enable row level security;

create policy "admins with pedidos ver read orders"
  on public.orders for select
  to authenticated
  using (public.has_permission(auth.uid(), 'pedidos', 'ver'));

create policy "admins with pedidos editar update orders"
  on public.orders for update
  to authenticated
  using (public.has_permission(auth.uid(), 'pedidos', 'editar'))
  with check (public.has_permission(auth.uid(), 'pedidos', 'editar'));

alter table public.order_items enable row level security;

create policy "admins with pedidos ver read order_items"
  on public.order_items for select
  to authenticated
  using (public.has_permission(auth.uid(), 'pedidos', 'ver'));

-- admin_profiles
alter table public.admin_profiles enable row level security;

create policy "admins with usuarios ver read admin_profiles"
  on public.admin_profiles for select
  to authenticated
  using (public.has_permission(auth.uid(), 'usuarios', 'ver'));

create policy "admins with usuarios editar update admin_profiles"
  on public.admin_profiles for update
  to authenticated
  using (public.has_permission(auth.uid(), 'usuarios', 'editar'))
  with check (public.has_permission(auth.uid(), 'usuarios', 'editar'));

-- roles / permissions / role_permissions / admin_profile_roles:
-- lectura con permiso "usuarios:ver" O super admin; cualquier
-- escritura exclusiva de super admin (spec maestra §11).
alter table public.roles enable row level security;

create policy "read roles with usuarios ver or super admin"
  on public.roles for select
  to authenticated
  using (public.has_permission(auth.uid(), 'usuarios', 'ver') or public.is_super_admin(auth.uid()));

create policy "only super admin writes roles"
  on public.roles for all
  to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

alter table public.permissions enable row level security;

create policy "read permissions with usuarios ver or super admin"
  on public.permissions for select
  to authenticated
  using (public.has_permission(auth.uid(), 'usuarios', 'ver') or public.is_super_admin(auth.uid()));

create policy "only super admin writes permissions"
  on public.permissions for all
  to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

alter table public.role_permissions enable row level security;

create policy "read role_permissions with usuarios ver or super admin"
  on public.role_permissions for select
  to authenticated
  using (public.has_permission(auth.uid(), 'usuarios', 'ver') or public.is_super_admin(auth.uid()));

create policy "only super admin writes role_permissions"
  on public.role_permissions for all
  to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

alter table public.admin_profile_roles enable row level security;

create policy "read admin_profile_roles with usuarios ver or super admin"
  on public.admin_profile_roles for select
  to authenticated
  using (public.has_permission(auth.uid(), 'usuarios', 'ver') or public.is_super_admin(auth.uid()));

create policy "only super admin writes admin_profile_roles"
  on public.admin_profile_roles for all
  to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- settings: toda la fila es pública por diseño (spec maestra §26 — el
-- cliente ve los datos de transferencia después de confirmar el
-- pedido). No hay ninguna columna sensible en esta tabla, a diferencia
-- de products. `using (true)` es intencional y no un genérico
-- copiado sin pensar.
alter table public.settings enable row level security;

create policy "public reads settings"
  on public.settings for select
  to anon, authenticated
  using (true);

create policy "admins with configuracion editar update settings"
  on public.settings for update
  to authenticated
  using (public.has_permission(auth.uid(), 'configuracion', 'editar'))
  with check (public.has_permission(auth.uid(), 'configuracion', 'editar'));

-- product_events: insertar una señal de actividad no expone ni
-- compromete ningún dato — `with check (true)` es intencional.
alter table public.product_events enable row level security;

create policy "public inserts product_events"
  on public.product_events for insert
  to anon, authenticated
  with check (true);

create policy "admins with productos ver read product_events"
  on public.product_events for select
  to authenticated
  using (public.has_permission(auth.uid(), 'productos', 'ver'));

-- audit_logs: sin módulo de permiso dedicado en el catálogo; se usa el
-- criterio más conservador (solo super admin).
alter table public.audit_logs enable row level security;

create policy "only super admin reads audit_logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_super_admin(auth.uid()));
```

- [ ] **Step 3: Aplicar localmente**

```bash
pnpm exec supabase db reset
```

Expected: sin errores (las 5 migraciones aplican en orden).

- [ ] **Step 4: Verificar acceso anónimo vía REST local**

Usar la `anon key` local que imprimió `supabase status` en Task 1.

```bash
ANON_KEY="<pegar la anon key local>"

# Debe funcionar (categorías activas)
curl -s "http://localhost:54321/rest/v1/categories?select=name" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# Debe funcionar (vista pública)
curl -s "http://localhost:54321/rest/v1/public_products?select=name,price" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# Debe funcionar (settings)
curl -s "http://localhost:54321/rest/v1/settings?select=business_name" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# Debe devolver [] (0 filas), NUNCA datos ni un error de permiso distinto a vacío
curl -s "http://localhost:54321/rest/v1/products?select=name,cost" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
curl -s "http://localhost:54321/rest/v1/customers?select=email" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
curl -s "http://localhost:54321/rest/v1/orders?select=order_number" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

Confirmar cada resultado contra lo esperado indicado en el comentario
de cada bloque.

- [ ] **Step 5: Verificar que product_images respeta la visibilidad del producto**

```sql
insert into public.product_images (product_id, url, is_primary)
select id, 'https://example.com/foto.jpg', true
from public.products where name = 'Cuaderno de prueba';

update public.products set is_published = true, available = true where name = 'Cuaderno de prueba';
```

```bash
# Debe devolver la imagen (producto ahora publicado+disponible)
curl -s "http://localhost:54321/rest/v1/product_images?select=url" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

```sql
update public.products set is_published = false where name = 'Cuaderno de prueba';
```

```bash
# Debe devolver [] ahora que el producto no está publicado
curl -s "http://localhost:54321/rest/v1/product_images?select=url" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: RLS por tabla y vista pública de productos"
```

---

### Task 7: Tipos TypeScript generados + wiring en lib/supabase

**Files:**
- Create: `types/supabase.ts`
- Modify: `lib/supabase/client.ts`
- Modify: `lib/supabase/server.ts`
- Modify: `lib/supabase/client.test.ts`, `lib/supabase/server.test.ts` (si hace falta ajustar tipos de los mocks)

**Interfaces:**
- Consumes: el esquema completo de Tasks 2-6.
- Produces: `Database` type exportado desde `types/supabase.ts`;
  `createClient()` en ambos archivos ahora tipado como
  `SupabaseClient<Database>`.

- [ ] **Step 1: Generar los tipos desde el esquema local**

```bash
pnpm exec supabase gen types typescript --local > types/supabase.ts
```

- [ ] **Step 2: Actualizar lib/supabase/client.ts**

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Actualizar lib/supabase/server.ts**

Mantener toda la lógica de cookies existente, solo tipar el cliente:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura;
            // se ignora porque el middleware de sesión (Fase 1b) se
            // encarga de refrescar cookies cuando corresponde.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Verificar que typecheck y los tests existentes siguen pasando**

```bash
pnpm typecheck
pnpm test
```

Expected: ambos limpios. Si algún mock de `client.test.ts`/`server.test.ts`
falla por el tipo más estricto de `SupabaseClient<Database>`, ajustar el
mock para que su forma siga siendo asignable (por ejemplo, tipando el
mock como `unknown` antes del cast, o usando `as unknown as ReturnType<typeof createClient>`)
sin relajar el tipo real de `createClient`.

- [ ] **Step 5: Commit**

```bash
git add types/supabase.ts lib/supabase/
git commit -m "feat: generar tipos de Supabase y tipar los clientes"
```

---

### Task 8: Link al proyecto real y push de las migraciones

**Esta tarea requiere un login interactivo (`supabase login` abre el
navegador) — lo ejecuta el IA Maker, no un subagente sin supervisión.**

**Files:** ninguno versionado (`supabase/.temp/` queda local, ya
ignorado por el `.gitignore` que generó `supabase init`).

- [ ] **Step 1: Login (interactivo, lo corre el IA Maker)**

```bash
pnpm exec supabase login
```

- [ ] **Step 2: Link al proyecto real**

```bash
pnpm exec supabase link --project-ref mjnfhedqhftwuakgnvmj
```

Puede pedir la contraseña de la base (la que se generó al crear el
proyecto en Fase 0) — si no se tiene a mano, se puede resetear desde
Project Settings → Database en el dashboard de Supabase.

- [ ] **Step 3: Push de las migraciones**

```bash
pnpm exec supabase db push
```

Expected: aplica las 5 migraciones al proyecto real, en orden, sin
errores.

- [ ] **Step 4: Verificar contra el proyecto real (no el local)**

```bash
source .env.local

curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/categories?select=name" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/public_products?select=name" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/products?select=name,cost" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: las dos primeras devuelven `[]` (tablas vacías pero
accesibles, sin error), la tercera también devuelve `[]` — la
diferencia real (que `products` está bloqueada para `anon` aunque esté
vacía) ya quedó probada en local en Task 6; acá solo se confirma que el
esquema y las políticas llegaron bien al proyecto real.

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/permissions?select=module,action" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `[]` con status 200 (RLS bloquea a `anon`, pero la tabla
existe) — nunca un error 404 de "tabla no existe".

- [ ] **Step 5: Commit (si `supabase link` generó algún archivo versionable)**

```bash
git status --short supabase/
```

Si aparece algo nuevo y no sensible (por ejemplo, el `project_id`
guardado en `supabase/.temp/` — normalmente ya ignorado), evaluar si
corresponde commitear. Si no hay nada nuevo que commitear, este paso no
genera un commit.
