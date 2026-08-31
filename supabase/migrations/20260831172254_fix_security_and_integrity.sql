-- Fix 1 (Critical): has_permission / is_super_admin deben respetar
-- admin_profiles.is_active. Antes de este fix, desactivar un admin
-- (is_active = false) no revocaba ningún acceso mientras su sesión
-- siguiera viva, porque ninguna de las dos funciones consultaba
-- admin_profiles en absoluto.
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
    join public.admin_profiles ap on ap.id = apr.admin_profile_id and ap.is_active
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
    join public.admin_profiles ap on ap.id = apr.admin_profile_id and ap.is_active
    where apr.admin_profile_id = p_user_id
      and r.is_super_admin
  );
$$;

-- Fix 2 (Important): tighten public_products further — service_role
-- no debe poder escribir a través de la vista tampoco. El fix del
-- Task 6 ya revocó escritura de anon/authenticated; service_role
-- todavía tenía grants completos de escritura sobre la vista, lo cual
-- es un footgun: escribir a través de la vista omite silenciosamente
-- `cost`, por lo que una server action con service role podría crear
-- un producto con cost = 0 (el default de la columna) sin querer.
-- Ningún flujo real debe escribir a través de public_products —
-- se restringe al dueño del esquema únicamente.
revoke all on public.public_products from anon, authenticated, service_role, public;
grant select on public.public_products to anon, authenticated;

-- Fix 3 (Important): revocar los grants por defecto de anon sobre
-- tablas a las que anon no tiene acceso legítimo alguno. Por defecto,
-- Supabase otorga a `anon` INSERT/UPDATE/DELETE/SELECT completo sobre
-- toda tabla nueva, y RLS es actualmente lo único que impide que anon
-- toque estas 10 tablas (anon no tiene ninguna política sobre
-- ninguna de ellas). Esto es defensa en profundidad: aunque una
-- migración futura debilite o elimine una política por accidente,
-- estas tablas siguen cerradas por grant.
--
-- No se incluyen categories, product_images, settings ni
-- product_events: esas cuatro tienen políticas de anon reales e
-- intencionales (lecturas y/o inserts) y revocar sus grants base
-- rompería esos caminos legítimos.
revoke all on public.products, public.customers, public.orders, public.order_items,
              public.admin_profiles, public.roles, public.permissions,
              public.role_permissions, public.admin_profile_roles, public.audit_logs
       from anon;

-- Fix 4 (Important): ampliar products.margin_percent para evitar un
-- overflow numérico ante un input erróneo pero plausible.
-- margin_percent numeric(5,2) desborda (tope ±999.99) cada vez que
-- `cost` se ingresa como ~12x o más de `price` — un typo de carga de
-- datos plausible (p. ej. un cero de más en cost) — y hoy eso provoca
-- un error crudo y no atribuido de la base de datos en lugar de un
-- fallo de validación normal. Al ser una columna
-- GENERATED ALWAYS AS ... STORED, cambiar su precisión requiere
-- borrarla y recrearla (la tabla está vacía, así que esto es seguro e
-- instantáneo).
alter table public.products drop column margin_percent;

alter table public.products add column margin_percent numeric(8,2) generated always as (
  case when price = 0 then 0 else round(((price - cost) / price) * 100, 2) end
) stored;

-- Fix 5 (Important): cuatro foreign keys deben hacer SET NULL al
-- borrar, no bloquear el borrado. Actualmente, borrar un admin_profile
-- (lo cual se dispara en cascada al borrar la fila subyacente de
-- auth.users) o un producto chocaría contra una foreign key NO ACTION
-- y abortaría con una violación de FK cruda, bloqueando exactamente
-- los flujos "eliminar usuario"/"producto con historial" que la spec
-- maestra espera que funcionen (vía soft-delete para productos, y
-- eventual borrado de usuarios para admins). El historial de
-- pedidos/auditoría debe sobrevivir al actor o producto referenciado,
-- no bloquear su eliminación — las cuatro columnas destino ya son
-- nullable.
alter table public.products
  drop constraint products_updated_by_fkey,
  add constraint products_updated_by_fkey
    foreign key (updated_by) references public.admin_profiles(id) on delete set null;

alter table public.audit_logs
  drop constraint audit_logs_admin_profile_id_fkey,
  add constraint audit_logs_admin_profile_id_fkey
    foreign key (admin_profile_id) references public.admin_profiles(id) on delete set null;

alter table public.order_items
  drop constraint order_items_product_id_fkey,
  add constraint order_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;

alter table public.product_events
  drop constraint product_events_product_id_fkey,
  add constraint product_events_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;

-- Nota: order_items no tiene política de UPDATE a propósito. Los items de un
-- pedido son inmutables una vez creados (snapshots, spec maestra §22/§4.5);
-- los cambios de estado del pedido se hacen a nivel `orders.status`, no
-- editando order_items.
