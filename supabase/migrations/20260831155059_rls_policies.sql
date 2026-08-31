-- Vista pública de productos: nunca expone cost/profit/margin_percent,
-- y ya filtra por publicado+disponible en su propia definición.
create view public.public_products
with (security_barrier = true)
as
select
  id, internal_code, sku, barcode, isbn, name, short_description, full_description,
  brand, publisher, author, category_id, tags, price, sale_price,
  available, is_published, is_featured, featured_order, is_new, created_at
from public.products
where is_published = true and available = true;

revoke all on public.public_products from anon, authenticated, public;
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
