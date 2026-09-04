# Fase 7: Usuarios y Roles — Design Spec

**Master spec:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md` §96 (Usuarios y Roles)

## Contexto

El esquema RBAC (`admin_profiles`, `roles`, `permissions`, `role_permissions`,
`admin_profile_roles`, `has_permission`, `is_super_admin`) ya existe completo
desde Fase 1a, incluyendo el módulo `usuarios` en el catálogo fijo de 8
módulos × 4 acciones. No existe todavía ninguna UI para gestionarlo: los
admins actuales (Jessica) fueron creados manualmente vía SQL/Auth Admin API.
Esta fase construye esa UI y la integración con la Auth Admin API de Supabase
para crear cuentas reales — no requiere tablas ni migraciones nuevas.

## Alcance

- Lista de usuarios admin, con estado (activa/inactiva) y rol.
- Crear usuario: genera una cuenta real de Supabase Auth + `admin_profile` +
  asignación de un rol, con contraseña temporal generada y mostrada una única
  vez.
- Editar usuario: nombre y rol (el email es de solo lectura una vez creado).
- Activar/desactivar usuario (no hay borrado duro).
- Restablecer contraseña de un usuario existente (genera y muestra una nueva
  temporal).
- Lista de roles (excluye `SUPER_ADMIN`, que no se gestiona desde esta UI).
- Crear/editar rol con matriz visual de permisos (8 módulos × 4 acciones).
- Borrar rol (bloqueado si tiene usuarios asignados).
- Guard de auto-bloqueo: no se puede desactivar al último SUPER_ADMIN activo.

**Fuera de alcance:** gestión del rol SUPER_ADMIN desde la UI (crear, editar
su matriz, borrarlo, asignárselo a alguien), edición de email de un usuario
existente, invitación por email (se usa contraseña temporal generada, no
`inviteUserByEmail`), múltiples roles por usuario (la tabla los soporta, la
UI no los expone), borrado duro de usuarios.

## Arquitectura

```
lib/auth/permissions.ts          (sin cambios — module "usuarios" ya existe)
lib/supabase/service.ts          (ya existe — createServiceClient(), usado hoy en /compra-exitosa)
lib/admin/users.ts               (nuevo) — operaciones sensibles sobre Auth Admin API, usa createServiceClient()

app/admin/(protected)/usuarios/
  page.tsx                       — lista de usuarios + "Crear usuario"
  actions.ts                     — createUser, updateUser, toggleActive, resetPassword
  roles/
    page.tsx                     — lista de roles + "Crear rol"
    actions.ts                   — createRole, updateRole, deleteRole
    nueva/page.tsx                — formulario de rol nuevo
    [id]/page.tsx                 — formulario de edición de rol

components/admin/
  user-dialog.tsx                — diálogo crear/editar usuario
  temp-password-dialog.tsx       — diálogo que muestra la contraseña temporal una vez
  role-form.tsx                  — formulario de rol con matriz de permisos
```

`lib/admin/users.ts` existe como capa separada porque crear un usuario
implica una secuencia de 3 pasos (Auth Admin API → `admin_profiles` →
`admin_profile_roles`) que debe comportarse como una unidad: si un paso falla
después de crear la cuenta de Auth, hay que compensar borrándola para no
dejar un usuario fantasma. Esa lógica no debe vivir en el Server Action ni
duplicarse entre `createUser` y `resetPassword`.

## Flujo: crear usuario

Server Action `createUser(prevState, formData)`, envuelta en
`withPermissionAction("usuarios", "crear", ...)`.

Validación (Zod): `fullName` requerido, `email` formato válido, `roleId` uuid
existente en `roles` con `is_super_admin = false` (el selector de rol en la
UI nunca lista SUPER_ADMIN).

`lib/admin/users.ts` — `createAdminUser({ fullName, email, roleId })`, usa
`createServiceClient()` de `lib/supabase/service.ts`:

1. Genera contraseña temporal random (formato tipo `LB-xxxxxxxx!Aa`, cumple
   reglas mínimas de Supabase).
2. `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`.
   Si falla (ej. email duplicado) → retorna error, no toca nada más.
3. Inserta `admin_profiles` (id = auth user id, full_name, is_active: true).
   Si falla → compensa con `auth.admin.deleteUser(id)`, retorna error.
4. Inserta `admin_profile_roles` (admin_profile_id, role_id). Si falla →
   misma compensación (`deleteUser` cascadea `admin_profiles` vía FK
   `on delete cascade`).
5. Éxito → `{ error: null, tempPassword }`.

La UI abre `TempPasswordDialog` con el email y la contraseña temporal, botón
"Copiar", advertencia de que no se puede volver a ver.

## Flujo: editar / desactivar usuario

`updateUser` — `withPermissionAction("usuarios", "editar", ...)`. Permite
cambiar `fullName`, `roleId` (mismo filtro anti-SUPER_ADMIN) e `isActive`.

Guard de auto-bloqueo, `wouldRemoveLastSuperAdmin(targetUserId)` en
`lib/admin/users.ts`: antes de desactivar a alguien, si ese usuario tiene rol
SUPER_ADMIN, cuenta cuántos usuarios activos con rol SUPER_ADMIN quedarían
tras el cambio; si el resultado es 0, rechaza con
`"No podés dejar el sistema sin ningún SUPER_ADMIN activo."`. Corre en el
servidor, no solo deshabilitando el botón en el cliente.

Desactivar: `update admin_profiles set is_active = false` tras pasar el
guard. No se toca la cuenta de Supabase Auth. Reactivar es la acción
inversa, sin guard.

El email se muestra de solo lectura en el formulario de edición.

## Flujo: restablecer contraseña

`resetPassword(userId)` — `withPermissionAction("usuarios", "editar", ...)`
(se reutiliza el permiso `editar`; el catálogo fijo de 4 acciones no tiene una
acción `resetear` y no se amplía el enum para esto).

`resetAdminPassword(userId)`: genera nueva contraseña temporal,
`auth.admin.updateUserById(userId, { password })`, retorna
`{ error: null, tempPassword }`. La UI confirma antes de ejecutar y reutiliza
`TempPasswordDialog`. Botón oculto si el usuario está inactivo.

## Flujo: roles y matriz de permisos

`/admin/usuarios/roles/page.tsx`: lista de roles (nombre + cantidad de
usuarios asignados), excluye `SUPER_ADMIN`.

`role-form.tsx`: campo nombre + matriz con una fila por módulo (los 8 ya
sembrados: `productos`, `precios`, `stock`, `pedidos`, `clientes`,
`facturacion`, `usuarios`, `configuracion`) y una columna por acción (`ver`,
`crear`, `editar`, `eliminar`). Al guardar, se recalcula el set completo de
`role_permissions` (borra existentes, inserta marcadas).

`createRole`/`updateRole` — `withPermissionAction("usuarios", "crear"/"editar", ...)`.
`updateRole` rechaza si el rol destino tiene `is_super_admin = true`
(defensa en profundidad; la UI no debería poder llegar ahí).

`deleteRole(roleId)` — `withPermissionAction("usuarios", "eliminar", ...)`.
Cuenta usuarios en `admin_profile_roles` con ese `role_id`; si `count > 0`
rechaza con `"Este rol tiene N usuario(s) asignado(s). Reasignalos antes de
borrarlo."`. También rechaza si el rol es SUPER_ADMIN.

## Manejo de errores

Mismo patrón `{ error: string | null }` de todas las fases anteriores,
mensajes en español para el dueño del negocio, nunca el error crudo de
Postgres/Auth.

- Email duplicado → `"Ya existe un usuario con ese email."`
- Guard de auto-bloqueo → mensaje de la sección correspondiente.
- Rol en uso al borrar → mensaje de la sección correspondiente.
- Cualquier otro error → `"Ocurrió un error. Intentá de nuevo."`

## Testing

Mismo patrón de mocking del proyecto (`vi.mock("@/lib/supabase/server", ...)`),
más un mock nuevo para `lib/supabase/service.ts`
(`auth: { admin: { createUser, deleteUser, updateUserById } }`).

- `lib/admin/users.test.ts`: éxito de `createAdminUser`, rollback si falla el
  insert de `admin_profiles`, rollback si falla el insert de
  `admin_profile_roles`, guard de auto-bloqueo (caso permitido y caso
  rechazado), `resetAdminPassword` éxito/error.
- `app/admin/(protected)/usuarios/actions.test.ts` y `roles/actions.test.ts`:
  forbidden por falta de permiso, mapeo de errores a mensajes, filtrado de
  SUPER_ADMIN en `updateRole`/`deleteRole`.
- Sin tests de componentes dedicados para `user-dialog.tsx`/`role-form.tsx`/
  `temp-password-dialog.tsx` salvo lógica no trivial — son formularios
  mecánicos cubiertos por los tests de las actions (mismo criterio que
  `SettingsForm` en Fase 6).

## Global Constraints (heredadas del proyecto)

- Next.js 16 App Router, React 19, TypeScript, Tailwind v4 + shadcn/ui, Zod v4.
- Todo Server Action mutante pasa por `withPermissionAction`.
- Mensajes de error en español, sin exponer errores crudos de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa server-side, nunca en código de
  cliente.
