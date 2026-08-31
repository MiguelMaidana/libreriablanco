# Fase 1b — Auth Admin + Roles/Permisos — Diseño

> **Proyecto:** Librería Blanco (plataforma e-commerce + backoffice)
> **Fase:** 1b de 8
> **Fuente de verdad funcional:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`
> **Depende de:** Fase 1a (`docs/superpowers/specs/2026-08-31-fase1a-modelo-de-datos-design.md`) — completa
> **Estado:** Aprobado por el IA Maker el 2026-08-31

## 1. Contexto

Fase 1a dejó el esquema completo de la base (14 tablas, RLS, y el motor
de permisos `has_permission`/`is_super_admin`) pero sin ninguna forma de
que una persona real se autentique. Esta fase conecta Supabase Auth al
backoffice: login, protección de `/admin/*`, y los helpers de servidor
que el resto de las fases van a usar para chequear permisos antes de
cualquier operación sensible.

El criterio de éxito de esta fase (spec maestra, acuerdo de fases) es:
**una administradora entra a `/admin`, se loguea, y ve una pantalla que
demuestra que el sistema sabe quién es y qué rol tiene** — no el
backoffice completo, que es la Fase 2 en adelante.

## 2. Objetivo de la fase

- Login de administradoras con email + contraseña (Supabase Auth).
- `/admin/*` inaccesible sin sesión válida; con sesión pero sin un
  `admin_profiles` activo, tampoco.
- Helpers de servidor reutilizables (`getCurrentAdmin`,
  `requirePermission`) que llaman a las funciones de Fase 1a — nunca
  reimplementan la lógica de autorización en TypeScript.
- Primer `SUPER_ADMIN` real, creado y verificado contra el proyecto de
  producción.
- Primer esquema de validación Zod del proyecto, estableciendo la
  convención que la spec maestra §66 pide para las fases siguientes.

## 3. Fuera de alcance de esta fase

- Pantallas de gestión de usuarios/roles (crear usuario, crear rol,
  matriz de permisos — spec maestra §96). Se decide en qué fase futura
  van cuando llegue el momento; no bloquea esta fase.
- Cualquier pantalla de catálogo, pedidos, clientes o configuración —
  Fases 2 en adelante.
- Layout completo del admin (sidebar, navegación) — spec maestra §38,
  Fase 2 ("Layout Admin").
- Recuperación de contraseña, cambio de contraseña, MFA — no pedidos por
  la spec maestra para el MVP; se agregan si hace falta más adelante.
- El trigger de "no eliminar/dejar sin acceso al último SUPER_ADMIN"
  (spec maestra §11) — sigue diferido, ahora sí con código real que
  podría necesitarlo (gestión de usuarios), pero esa gestión todavía no
  existe en esta fase.

## 4. Decisiones de diseño

### 4.1 Validación: Zod + Server Actions nativas

Primer uso de un esquema de validación compartido en el proyecto
(`lib/validations/auth.ts`, `adminLoginSchema`), consistente con spec
maestra §66 ("Las validaciones del navegador son UX. Las validaciones
del servidor son seguridad e integridad. Se necesitan ambas."). Sin
react-hook-form — un form de 2 campos no lo justifica; se reevalúa en la
Fase 2 si el formulario de producto (muchos más campos) lo amerita.

### 4.2 Sesión: middleware acotado + layout como gate real

Patrón oficial de `@supabase/ssr`: un `middleware.ts` en la raíz que
refresca la sesión (lee/reescribe cookies) en cada request. A diferencia
del ejemplo genérico de Supabase (que suele aplicar a todo el sitio), el
`matcher` se acota a `/admin/:path*` — el portal público (Fases 3-4) no
usa autenticación de ningún tipo, así que no tiene sentido pagar el
costo de refrescar sesión en cada request a `/`, `/productos`, etc.

El middleware **solo** refresca cookies; nunca decide quién puede pasar.
Esa decisión vive en `app/admin/layout.tsx` (Server Component), que:
1. Si no hay sesión → `redirect("/admin/login")`.
2. Si hay sesión pero no existe un `admin_profiles` activo para ese
   usuario → muestra una pantalla de "sin acceso" (nunca un error
   técnico crudo, spec maestra §47).
3. Si todo está bien → renderiza los children.

Se separan las dos responsabilidades (refrescar vs. autorizar) porque el
middleware corre en el Edge Runtime con restricciones (no puede hacer
queries complejas cómodamente) y porque la lógica de autorización real
—incluyendo el chequeo de permisos específicos— seguirá creciendo en
fases futuras; conviene que viva en Server Components/Server Actions
normales, no en el middleware.

### 4.3 Motor de permisos en código: llamar a la función de la base, no reimplementarla

```typescript
// lib/auth/permissions.ts
getCurrentAdmin(): Promise<AdminProfile | null>
requirePermission(module: PermissionModule, action: PermissionAction): Promise<AdminProfile>
```

Ambos usan `supabase.rpc("has_permission", ...)` / `supabase.rpc("is_super_admin", ...)`
contra las funciones ya creadas en Fase 1a. `requirePermission` lanza un
error específico (`ForbiddenError`) si el chequeo falla — las fases
futuras deciden cómo mostrar ese error (spec maestra §47: nunca crudo),
pero el helper en sí no sabe de UI.

Esto garantiza que la autorización del servidor y la de RLS usan
exactamente la misma regla (spec maestra §11: "validarse también en
servidor, no solamente ocultando botones") — nunca hay dos
implementaciones que puedan desalinearse.

### 4.4 Bootstrap del primer SUPER_ADMIN

Manual, ejecutado durante la implementación (no una pantalla de setup en
la app, sigue siendo un evento que pasa una sola vez):

1. Crear el usuario real en Supabase Auth (dashboard o Admin API) con el
   email/nombre reales de quien va a administrar Librería Blanco.
2. Insertar su fila en `admin_profiles`.
3. Asignarle el rol `SUPER_ADMIN` ya sembrado en Fase 1a
   (`admin_profile_roles`).
4. Deshabilitar el self-signup público en el proyecto real (Authentication
   → Settings en el dashboard de Supabase) — hoy está habilitado por
   default y este es un backoffice interno, no un producto con alta
   pública de cuentas.

## 5. Estructura de archivos

```text
middleware.ts                        # refresca sesión, matcher /admin/:path*

lib/
  auth/
    permissions.ts                   # getCurrentAdmin, requirePermission
    permissions.test.ts
  validations/
    auth.ts                          # adminLoginSchema
    auth.test.ts
  supabase/
    middleware.ts                    # cliente Supabase específico para middleware (patrón @supabase/ssr)

app/
  admin/
    layout.tsx                       # gate de autorización
    login/
      page.tsx                       # formulario de login
      actions.ts                     # Server Action signIn
    page.tsx                         # dashboard mínimo (nombre + roles)
    logout/
      route.ts                       # Route Handler POST, cierra sesión
    unauthorized/
      page.tsx                       # "tu cuenta no tiene acceso" (sesión válida, sin admin_profile activo)
```

No se crea `components/admin/` todavía — el login usa componentes de
`components/ui/*` de Fase 0 directamente; una carpeta de componentes
específicos del admin se justifica recién en Fase 2 cuando haya más de
una pantalla que los necesite.

## 6. Flujo de datos

### Login

```text
Usuario completa el form (email + password)
  → adminLoginSchema valida en el cliente (feedback inmediato)
  → Server Action `signIn`
  → adminLoginSchema revalida en servidor
  → supabase.auth.signInWithPassword(...)
  → si falla: mensaje amigable ("No pudimos iniciar sesión. Revisá tus datos."),
    nunca el error crudo de Supabase
  → si funciona: redirect a /admin
```

### Navegación protegida

```text
Request a /admin/**
  → middleware refresca cookies de sesión
  → app/admin/layout.tsx (Server Component):
      sin sesión           → redirect /admin/login
      sesión sin perfil activo → renderiza /admin/unauthorized
      sesión + perfil activo   → renderiza la página pedida
```

### Logout

```text
POST /admin/logout → supabase.auth.signOut() → redirect /admin/login
```

## 7. Seguridad

- La contraseña nunca se valida ni se compara en código propio — siempre
  vía `supabase.auth.signInWithPassword`.
- `requirePermission`/`getCurrentAdmin` corren en servidor únicamente
  (Server Components, Server Actions, Route Handlers) — nunca se
  exponen a un Client Component.
- El error de login nunca distingue "el email no existe" de "la
  contraseña es incorrecta" en el mensaje al usuario (evita enumeración
  de cuentas) — mismo mensaje genérico para ambos casos.
- `minimum_password_length` del proyecto real se sube de 6 (default) a
  8 como parte del bootstrap — backoffice interno, vale la pena el
  mínimo un poco más alto sin generar fricción real para un equipo
  chico.

## 8. Testing

- `adminLoginSchema`: unitario, casos válidos e inválidos (email mal
  formado, password vacío).
- `getCurrentAdmin`/`requirePermission`: unitarios, mockeando el cliente
  de Supabase (mismo patrón que `lib/supabase/*.test.ts` de fases
  anteriores) — casos: sin sesión, con sesión pero sin perfil, con
  perfil activo y permiso concedido, con perfil activo y permiso
  denegado.
- Verificación manual end-to-end contra el stack local (Playwright,
  mismo patrón usado para verificar visualmente la Fase 0): login
  correcto, contraseña incorrecta, acceso a `/admin` sin sesión
  (confirma el redirect), acceso con un admin desactivado (confirma
  `/admin/unauthorized`).

## 9. Criterio de aceptación de la Fase 1b

- [ ] `/admin/login` renderiza un formulario funcional con la
      identidad visual del proyecto (Fase 0).
- [ ] Login correcto redirige a `/admin` y muestra el nombre real y los
      roles reales del usuario logueado.
- [ ] Login incorrecto muestra un mensaje amigable, nunca el error
      crudo de Supabase.
- [ ] Acceder a `/admin` sin sesión redirige a `/admin/login`.
- [ ] Un `admin_profiles.is_active = false` con sesión válida ve
      `/admin/unauthorized`, no el dashboard.
- [ ] Logout invalida la sesión (un `/admin` posterior vuelve a pedir
      login).
- [ ] `getCurrentAdmin`/`requirePermission` tienen tests unitarios
      cubriendo los 4 casos de la sección 8.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pasan sin errores.
- [ ] El primer `SUPER_ADMIN` real existe en el proyecto de producción,
      verificado con un login real (no solo en local).
- [ ] Self-signup público deshabilitado en el proyecto real.
- [ ] `minimum_password_length` del proyecto real es 8.

## 10. Decisiones que quedan para fases futuras

- En qué fase van las pantallas de gestión de Usuarios y Roles (spec
  maestra §96) — el IA Maker decidió explícitamente no resolverlo ahora.
- El trigger de "no eliminar al último SUPER_ADMIN" — se construye junto
  con esa gestión de usuarios, cuando exista.
- Recuperación/cambio de contraseña — no pedido por el MVP; agregar si
  surge la necesidad real.
