-- Las políticas RLS de admin_profiles/roles (Fase 1a) exigen el
-- permiso 'usuarios:ver' para leer esas tablas — correcto para
-- consultar el perfil de OTRO admin, pero bloquearía a cualquier admin
-- sin ese permiso específico de leer su PROPIO perfil, algo que el
-- login necesita para funcionar sin importar el rol. Esta función,
-- SECURITY DEFINER y auto-referida a auth.uid() (sin parámetro, no se
-- le puede pedir el perfil de otro usuario), resuelve ese problema sin
-- tener que aflojar ninguna política existente.
create or replace function public.get_my_admin_profile()
returns table (
  id uuid,
  full_name text,
  is_active boolean,
  role_names text[]
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    ap.id,
    ap.full_name,
    ap.is_active,
    coalesce(array_agg(r.name) filter (where r.name is not null), '{}')
  from public.admin_profiles ap
  left join public.admin_profile_roles apr on apr.admin_profile_id = ap.id
  left join public.roles r on r.id = apr.role_id
  where ap.id = auth.uid()
  group by ap.id, ap.full_name, ap.is_active;
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto en toda función nueva,
-- y el esquema `public` de Supabase además concede EXECUTE explícito a
-- `anon`/`authenticated`/`service_role` vía default privileges — el
-- GRANT de abajo (tal como está en el plan) por sí solo no alcanza
-- para bloquear a `anon`, porque ya tiene acceso por esas dos vías.
-- Se revoca explícitamente antes de otorgar el acceso previsto, mismo
-- patrón de "revoke primero" ya usado en la migración anterior
-- (fix_security_and_integrity.sql) para otros objetos sensibles.
revoke execute on function public.get_my_admin_profile() from public;
revoke execute on function public.get_my_admin_profile() from anon;

grant execute on function public.get_my_admin_profile() to authenticated;
