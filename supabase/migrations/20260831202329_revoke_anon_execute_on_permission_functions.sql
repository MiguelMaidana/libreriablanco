-- has_permission / is_super_admin (Fase 1a) nunca tuvieron el EXECUTE de
-- anon/PUBLIC revocado, a diferencia de get_my_admin_profile (esta fase),
-- que sí lo hizo desde el principio. Sin esto, un caller no autenticado
-- puede sondear con la anon key si un UUID arbitrario es SUPER_ADMIN o
-- tiene un permiso dado — un oráculo de existencia sobre las tablas de
-- RBAC. Solo `authenticated` (las políticas RLS que las usan) necesita
-- poder ejecutarlas.
revoke execute on function public.has_permission(uuid, text, text) from public, anon;
revoke execute on function public.is_super_admin(uuid) from public, anon;
