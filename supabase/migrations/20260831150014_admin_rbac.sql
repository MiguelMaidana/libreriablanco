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
