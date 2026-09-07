# Documentación Técnica — Librería Blanco

> Documento de referencia técnica completa del proyecto. Para el recorrido funcional de pantallas con capturas, ver [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md).

## 1. Stack tecnológico

| Paquete | Versión | Uso |
|---|---|---|
| next | ^16.3.3 | Framework (App Router, Turbopack) |
| react / react-dom | ^19.2.8 | UI |
| typescript | ^6.0.3 | Tipado |
| @supabase/supabase-js | ^2.112.4 | Cliente Supabase (Postgres, Auth, Storage) |
| @supabase/ssr | ^0.12.5 | Cliente Supabase con cookies para SSR/Server Components |
| zod | ^4.5.4 | Validación de formularios y datos |
| tailwindcss | ^4.3.3 | Estilos |
| radix-ui | ^1.6.7 | Base headless de los componentes shadcn/ui |
| sonner | ^2.0.8 | Toasts |
| lucide-react | ^1.37.0 | Íconos |
| vitest | ^4.1.11 | Test runner |
| @testing-library/react | ^16.3.3 | Tests de componentes |
| eslint / eslint-config-next | ^9.39.5 / ^16.3.3 | Lint |
| supabase (CLI) | ^2.116.0 | Migraciones, generación de tipos |

Package manager: **pnpm**. Deploy: **Vercel**.

Scripts (`package.json`): `dev`, `build`, `start`, `lint` (`eslint . --max-warnings 0`), `format` (prettier), `typecheck` (`tsc --noEmit`), `test` (`vitest run`).

## 2. Estructura de rutas

### Públicas (`app/(shop)/...`)

| Ruta | Descripción |
|---|---|
| `/` | Home: hero, categorías destacadas, productos destacados, novedades |
| `/productos` | Listado de productos, con filtro por categoría, orden y búsqueda por texto |
| `/productos/[slug]` | Ficha de producto |
| `/categoria/[slug]` | Listado filtrado por categoría |
| `/carrito` | Carrito de compra (estado del lado del cliente, persistido en `localStorage`) |
| `/checkout` | Formulario de datos del cliente y confirmación del pedido |
| `/compra-exitosa/[orderNumber]` | Confirmación pública del pedido (sin datos personales del cliente), incluye datos de transferencia y link de WhatsApp para enviar el comprobante — no requiere sesión, se accede por el número de pedido |

### Administrativas (`app/admin/...`)

Fuera de `(protected)`: `/admin/login`, `/admin/logout` (route handler POST), `/admin/unauthorized`.

Dentro de `(protected)` — el layout verifica sesión activa vía `getCurrentAdmin()` y redirige a `/admin/login` o `/admin/unauthorized` si corresponde:

| Ruta | Descripción |
|---|---|
| `/admin` | Dashboard: pedidos nuevos, resumen de productos, ventas de hoy |
| `/admin/productos`, `/admin/productos/nuevo`, `/admin/productos/[id]` | CRUD de productos, con gestión de imágenes |
| `/admin/categorias` | CRUD de categorías (diálogo modal) |
| `/admin/pedidos`, `/admin/pedidos/[id]` | Listado (tabs Nuevos/Finalizados/Cancelados/Todos) y detalle con acciones de estado |
| `/admin/clientes`, `/admin/clientes/[id]` | Listado con búsqueda y detalle con historial de compras |
| `/admin/configuracion` | Datos del negocio, WhatsApp, transferencia, tienda (título/hero/imagen), logo |
| `/admin/usuarios` | Gestión de usuarios administrativos (única página que usa `service_role` para leer emails de `auth.users`) |
| `/admin/usuarios/roles`, `/admin/usuarios/roles/nueva`, `/admin/usuarios/roles/[id]` | Gestión de roles con matriz visual de permisos |

## 3. Esquema de base de datos

### Migraciones (orden cronológico)

1. `admin_rbac.sql` — esquema RBAC completo (`admin_profiles`, `roles`, `permissions`, `role_permissions`, `admin_profile_roles`, `has_permission()`, `is_super_admin()`, catálogo de 32 permisos sembrado, rol `SUPER_ADMIN` sembrado)
2. `catalogo.sql` — `categories`, `products`, `product_images`
3. `comercio.sql` — `customers`, `orders`, `order_items`
4. `settings_y_analitica.sql` — `settings`, `product_events`, `audit_logs`
5. `rls_policies.sql` — políticas RLS de todas las tablas + `is_product_visible()`
6. `fix_security_and_integrity.sql` — endurecimiento de `has_permission()`/`is_super_admin()`, columna generada `margin_percent`
7. `get_my_admin_profile.sql` — RPC `get_my_admin_profile()`
8. `revoke_anon_execute_on_permission_functions.sql` — revoca `EXECUTE` de `anon`/`public` sobre funciones de permisos
9. `product_images_bucket.sql` — bucket de Storage `product-images`
10. `set_updated_at_trigger.sql` — trigger genérico de `updated_at`
11. `product_images_bucket_limits.sql` — límites de tamaño/mime del bucket
12. `products_slug.sql` — columna `slug` única en `products`
13. `guest_order_creation.sql` — `next_order_number()`, `create_guest_order()`
14. `fix_guest_order_phone_upsert.sql` — fix de upsert de teléfono de cliente
15. `settings_images_bucket.sql` — bucket de Storage `settings-images`

### Tablas principales

- **`admin_profiles`**: `id` (= `auth.users.id`, FK), `full_name`, `is_active`, `created_at`, `updated_at`.
- **`roles`**: `id`, `name` (único), `is_super_admin`, `created_at`.
- **`permissions`**: `id`, `module` (check: 8 valores fijos), `action` (check: `ver`/`crear`/`editar`/`eliminar`). Catálogo fijo de 32 filas.
- **`role_permissions`**: `role_id`, `permission_id` (PK compuesta).
- **`admin_profile_roles`**: `admin_profile_id`, `role_id` (PK compuesta — el esquema soporta múltiples roles por usuario, aunque la UI actual asigna uno solo).
- **`categories`**: `id`, `name`, `slug` (único), `parent_id`, `display_order`, `icon`, `image_url`, `is_active`, `is_featured`.
- **`products`**: `id`, `name`, `slug` (único), `category_id`, `short_description`, `cost`, `price`, `margin_percent` (columna generada), `sku`, `isbn`, `barcode`, `brand`, `author`, `publisher`, `tags`, `available`, `is_published`, `is_featured`, `is_new`.
- **`product_images`**: `id`, `product_id`, `url`, `position`, `is_primary`.
- **`customers`**: `id`, `first_name`, `last_name`, `email`, `phone`.
- **`orders`**: `id`, `order_number` (único, generado por `next_order_number()`), `customer_id`, `status`, `payment_method`, `total`.
- **`order_items`**: `id`, `order_id`, `product_id`, snapshots de `product_name`/`unit_price`/`unit_cost` al momento de la compra (para no depender del estado actual del producto), `quantity`.
- **`settings`**: fila única (`id=1`, constraint `check (id=1)`), ~20 columnas: nombre/dirección/horarios/teléfono/email de la librería, número y plantillas de mensaje de WhatsApp (general, comprobante, consulta de envío), alias/titular/CBU/banco/instrucciones de transferencia, título/texto/imagen del hero de la home, `store_enabled`.
- **`product_events`**, **`audit_logs`**: tablas de analítica/auditoría (esquema sembrado, sin UI de consumo todavía).

Vista: **`public_products`** — subconjunto seguro de columnas de `products` para el catálogo público (oculta costos y campos internos).

### Funciones / RPCs de Postgres

| Función | Firma | Uso |
|---|---|---|
| `has_permission` | `(p_user_id uuid, p_module text, p_action text) → boolean` | Fuente de verdad de autorización, usada en RLS y en `requirePermission` |
| `is_super_admin` | `(p_user_id uuid) → boolean` | Chequeo de SUPER_ADMIN, usado en RLS y en `requireSuperAdmin` |
| `get_my_admin_profile` | `() → {id, full_name, is_active, role_names[]}` | Perfil del usuario autenticado actual (usa `auth.uid()` internamente) |
| `next_order_number` | `() → text` | Genera el próximo número de pedido secuencial (`LB-NNNN`) |
| `create_guest_order` | `(p_first_name, p_last_name, p_email, p_phone, p_items) → {order_number}` | Crea un pedido de invitado (upsert de cliente + orden + items) en una sola llamada transaccional |
| `is_product_visible` | `(p_product_id uuid) → boolean` | Determina si un producto es visible públicamente (publicado + disponible) |

## 4. Modelo de autorización (RBAC)

**Catálogo de permisos:** 8 módulos (`productos`, `precios`, `stock`, `pedidos`, `clientes`, `facturacion`, `usuarios`, `configuracion`) × 4 acciones (`ver`, `crear`, `editar`, `eliminar`) = 32 permisos fijos, sembrados una única vez en `admin_rbac.sql`.

**SUPER_ADMIN:** un rol especial con `is_super_admin = true` que bypassea todo chequeo de permiso granular. Es exclusivo para gestionar roles/usuarios (spec maestra §11) — la RLS reserva toda escritura sobre `roles`, `permissions`, `role_permissions` y `admin_profile_roles` a SUPER_ADMIN, sin importar qué permiso granular tenga asignado un usuario común.

**Helpers de `lib/auth/permissions.ts`:**

```ts
getCurrentAdmin(): Promise<AdminProfile | null>
requirePermission(module, action): Promise<AdminProfile>       // throws ForbiddenError
requireSuperAdmin(): Promise<AdminProfile>                      // throws ForbiddenError
withPermission<T>(module, action, fn): Promise<T>
withPermissionAction<S>(module, action, forbiddenState, fn): Promise<S>
withSuperAdminAction<S>(forbiddenState, fn): Promise<S>
```

`withPermissionAction`/`withSuperAdminAction` son los wrappers que usa todo Server Action mutante del proyecto: ejecutan el chequeo, y si falla devuelven `forbiddenState` en vez de lanzar una excepción (para que el componente cliente pueda mostrar el error sin un error boundary).

`lib/auth/permission-catalog.ts` existe como módulo separado y **sin ninguna dependencia server-only** (sin `next/headers`, sin `@/lib/supabase/server`) porque expone los tipos `PermissionModule`/`PermissionAction` y las constantes `PERMISSION_MODULES`/`PERMISSION_ACTIONS` que también consume código de **Client Components** (ej. la matriz de permisos de `role-form.tsx`) — si un Client Component importara estas constantes desde `lib/auth/permissions.ts`, arrastraría al bundle de cliente el import de `next/headers` y Next.js rechazaría el build.

### Excepción de seguridad: `/admin/usuarios`

Es la única página de lectura de todo el admin que hace un chequeo de permiso explícito en vez de confiar en la RLS. Motivo: los emails de los usuarios viven en `auth.users`, no en `admin_profiles`, y listarlos requiere `supabase.auth.admin.listUsers()` (Auth Admin API, siempre con `service_role`). Como `service_role` bypassea la RLS por completo, sin este chequeo explícito cualquier admin logueado podría ver la lista completa de emails del personal. El resto de las páginas de lectura del admin no necesita esto: dependen de que la RLS filtre los datos con el cliente de sesión normal.

## 5. Módulos de `lib/`

```
lib/auth/permissions.ts           helpers de autorización (ver sección 4)
lib/auth/permission-catalog.ts    tipos y constantes de permisos, sin dependencias server-only

lib/admin/dashboard.ts            queries del dashboard administrativo
lib/admin/orders.ts               lógica de gestión de pedidos
lib/admin/users.ts                operaciones sensibles sobre la Auth Admin API (crear usuario, resetear
                                   contraseña, guard de auto-bloqueo de SUPER_ADMIN) — siempre con service_role
lib/admin/whatsapp.ts             construcción de mensajes de WhatsApp del lado admin

lib/shop/cart.ts                  lógica de carrito (localStorage)
lib/shop/cart-products.ts         hidratación de productos del carrito contra la base
lib/shop/format.ts                formatPrice (Intl.NumberFormat es-AR), formatDate (America/Argentina/Buenos_Aires)
lib/shop/products.ts              queries del catálogo público
lib/shop/settings.ts              getSettings() memoizado con React.cache()
lib/shop/sort.ts                  opciones de orden del listado de productos
lib/shop/whatsapp.ts              construcción de mensajes de WhatsApp (consulta, comprobante, envío)

lib/supabase/client.ts            cliente Supabase para Client Components (browser)
lib/supabase/middleware.ts        cliente Supabase para middleware (refresco de sesión)
lib/supabase/server.ts            cliente Supabase para Server Components/Actions (cookies, sesión del usuario)
lib/supabase/service.ts           cliente Supabase con service_role (síncrono, bypassea RLS)

lib/validations/auth.ts           schemas de login
lib/validations/category.ts       schema de categoría
lib/validations/checkout.ts       schema de checkout
lib/validations/product.ts        schema de producto
lib/validations/role.ts           schema de rol
lib/validations/settings.ts       schema de configuración del negocio
lib/validations/user.ts           schemas de crear/editar usuario

lib/pricing.ts                    cálculo de margen (costo/precio)
lib/slug.ts                       generación de slugs únicos
lib/utils.ts                      utilidades varias (cn, etc.)
```

**Distinción clave `server.ts` vs `service.ts`:** `createClient()` (server.ts) es **async**, usa cookies de la sesión del usuario y está sujeto a RLS. `createServiceClient()` (service.ts) es **síncrono**, usa la `service_role` key y bypassea RLS por completo — se usa únicamente cuando: (a) hace falta la Auth Admin API (crear usuario, resetear contraseña), o (b) la tabla no tiene política de RLS que permita la operación a nadie más que `service_role` (ej. INSERT en `admin_profiles`, todas las escrituras de `roles`/`role_permissions`/`admin_profile_roles`).

## 6. Componentes

**Admin** (`components/admin/`): `category-active-toggle`, `category-dialog`, `delete-role-button`, `order-status-actions`, `price-warning-dialog`, `product-form`, `product-image-manager`, `product-quick-actions`, `role-form`, `settings-form`, `settings-image-upload`, `sidebar`, `temp-password-dialog`, `user-dialog`, `user-row-actions`.

**Shop** (`components/shop/`): `add-to-cart-button`, `cart-link`, `cart-provider`, `cart-view`, `category-pill`, `checkout-form`, `footer`, `header`, `hero`, `info-bar`, `order-confirmation`, `product-card`, `product-filters`, `product-gallery`, `search-input`, `whatsapp-button`.

## 7. Patrones de código

### Server Actions

Todo Server Action mutante devuelve `{ error: string | null }` (algunos agregan campos opcionales, ej. `{ error, tempPassword? }` en las acciones de usuarios). Nunca se expone un error crudo de Postgres/Supabase al cliente — siempre se loguea con `console.error` server-side y se devuelve un mensaje fijo en español.

### Formularios

- **`useActionState`** para formularios que envían un Server Action directamente (`ProductForm`, `CheckoutForm`, `SettingsForm`, `RoleForm`, y los diálogos de crear/editar).
- **Patrón de diálogo** (`CategoryDialog`, `UserDialog`): `useActionState` + un `useEffect` que reacciona al resultado (toast de éxito + cierre del diálogo, o mostrar el error) usando un `useRef` para distinguir "recién se envió" de "el estado inicial".
- **Patrón de botón con confirmación** (`OrderStatusActions`, `UserRowActions`, `DeleteRoleButton`): `useTransition` + llamada directa al Server Action (sin `<form>`) + `AlertDialog` de shadcn/ui para confirmar antes de ejecutar acciones irreversibles.

### Validación

Zod v4 en `lib/validations/*.ts`, `safeParse` en el Server Action, primer mensaje de error de Zod mostrado al usuario si la validación falla.

## 8. Storage de Supabase

| Bucket | Público | Restricciones | Política de escritura |
|---|---|---|---|
| `product-images` | Sí | límite de tamaño/mime (migración posterior) | gateada por `productos:editar` |
| `settings-images` | Sí | jpeg/png/webp/avif, 5MB | gateada por `configuracion:editar` |

Ambos con política pública de `SELECT` y política de escritura (`ALL`) que exige el permiso correspondiente vía `has_permission()`.

## 9. Configuración de Next.js (`next.config.ts`)

- `images.remotePatterns`: apunta al hostname de Supabase Storage, para poder usar `next/image` con las URLs públicas de los buckets.
- `experimental.serverActions.bodySizeLimit: "5mb"`: Next.js limita el body de los Server Actions a 1MB por defecto, lo cual rechazaba silenciosamente cualquier foto real de celular antes de que la propia validación de la app (`MAX_FILE_SIZE_BYTES`) llegara a correr. Ajustado en la Fase 6 tras encontrarlo en la revisión final.

## 10. Variables de entorno

| Variable | Dónde se usa |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente público y `service.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts`, `server.ts`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Únicamente `lib/supabase/service.ts` — nunca debe llegar a código de cliente |

## 11. Testing

53 archivos de test (`*.test.ts`/`*.test.tsx`), corridos con `pnpm test` (`vitest run`). Patrón de mocking uniforme en todo el proyecto:

```ts
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc, from: mockFrom, storage: {...} })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom, auth: { admin: {...} } })),
}));
```

Con helpers `mockAdminAllowed()`/`mockAdminForbidden()` (o `mockSuperAdmin()`/`mockNotSuperAdmin()`) que configuran `mockRpc` según el RPC invocado (`get_my_admin_profile`, `has_permission`, `is_super_admin`). No hay tests dedicados para componentes de formulario puramente mecánicos (diálogos, formularios que solo envían un Server Action) — esa lógica está cubierta por los tests del Server Action correspondiente.

## 12. Deploy

**Plataforma:** Vercel. No hay `vercel.json` en el repo (configuración por defecto de detección de framework Next.js).

**Mecanismo crítico:** el Production Branch configurado en Vercel es `main`, **no** `nueva-ui` (la rama donde ocurre el desarrollo activo). Pushear solo a `nueva-ui` genera un deploy de preview, no de producción. El flujo real para deployar a producción es:

```bash
git push origin nueva-ui
git push origin nueva-ui:main
```

**Migraciones:** se aplican a producción con `supabase db push` (requiere el proyecto linkeado vía `supabase link`), y los tipos de TypeScript se regeneran con `supabase gen types typescript --linked > types/supabase.ts`.

## 13. Proceso de desarrollo

El proyecto se desarrolló en fases incrementales (una por área funcional de la spec maestra), cada una siguiendo el mismo proceso: brainstorming → spec escrita → plan de implementación → ejecución con subagentes (implementador + revisor independiente por tarea, con rondas de fix cuando hace falta) → revisión final de toda la rama → deploy a producción → verificación interactiva. El historial completo de specs, planes y decisiones de diseño de cada fase está en `docs/superpowers/specs/` y `docs/superpowers/plans/`.
