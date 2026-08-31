# Fase 1a — Modelo de datos — Diseño

> **Proyecto:** Librería Blanco (plataforma e-commerce + backoffice)
> **Fase:** 1a de 8 (la Fase 1 original se partió en 1a "Modelo de datos" y 1b "Auth Admin + Roles/Permisos")
> **Fuente de verdad funcional:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`
> **Depende de:** Fase 0 (`docs/superpowers/specs/2026-08-30-fase0-fundaciones-design.md`) — completa
> **Estado:** Aprobado por el IA Maker el 2026-08-31

## 1. Contexto

Fase 0 dejó la aplicación conectada a Supabase pero sin ningún modelo de
datos de negocio. Esta fase crea el esquema completo del MVP (productos,
categorías, clientes, pedidos, administración) como migraciones
versionadas en el repositorio, junto con las políticas de Row Level
Security que definen qué puede leer/escribir el público anónimo frente a
lo que requiere autenticación de administrador.

Esta fase **no incluye ninguna pantalla**. Su criterio de éxito es que el
esquema exista, esté versionado, aplicado en Supabase, y verificable por
consulta directa (SQL / REST). La Fase 1b construye Supabase Auth, el
motor de roles/permisos en código de aplicación y la pantalla de login
sobre este modelo.

## 2. Objetivo de la fase

- Todas las tablas de la sección 3 creadas como migraciones de Supabase
  CLI, aplicadas localmente (Postgres vía Docker) y luego en el proyecto
  real (`supabase db push`).
- RLS habilitado en toda tabla, con políticas específicas por tabla (no
  `using (true)` genérico) — ver sección 4.
- Catálogo de permisos y el rol `SUPER_ADMIN` sembrados por migración.
- Tipos de TypeScript generados desde el esquema real
  (`supabase gen types typescript`) y conectados a `lib/supabase/*`.
- Verificación manual documentada de que cada regla de RLS hace lo que
  dice (público lee lo público, no lee lo privado).

## 3. Fuera de alcance de esta fase

- Supabase Auth, login, motor de roles/permisos en código de aplicación,
  protección de rutas `/admin/*` — todo eso es Fase 1b.
- Cualquier pantalla, tanto pública como de admin.
- Entidades evolutivas fuera del MVP (`payments`, `invoices`,
  `suppliers`, `purchases`, `promotions`, `addresses`,
  `inventory_movements`) — spec maestra §49, no crear hasta que haya
  necesidad real.
- El trigger de "no eliminar al último SUPER_ADMIN" (spec maestra §11) —
  es un invariante de datos real, pero no hay código todavía que lo
  ejercite (eso es Fase 1b/2). Se deja documentado como pendiente en la
  sección 8 para no construir protección sin tests que la ejerciten.

## 4. Decisiones de diseño

### 4.1 Ganancia y margen como columnas generadas

`products.profit` y `products.margin_percent` son
`GENERATED ALWAYS AS (...) STORED`, calculadas por Postgres a partir de
`cost`/`price`. Nunca se escriben desde la aplicación, siempre
consistentes, disponibles en cualquier `SELECT` sin duplicar la fórmula
en TypeScript.

### 4.2 Vista pública sin columnas sensibles

`products` tiene RLS que **no** otorga ningún acceso a `anon` — ni de
fila ni de columna. En su lugar, una vista `public_products` expone
solamente las columnas que un cliente puede ver (nunca `cost`, `profit`,
`margin_percent`, ni notas internas), filtrada además por
`is_published = true and available = true` en su propia definición. El
portal público siempre consulta `public_products`; el admin (fase 1b en
adelante) consulta `products` directamente con permisos.

RLS por fila no alcanza para ocultar columnas específicas — de ahí la
vista, no una política adicional sobre `products`.

### 4.3 Motor de permisos: relacional simple, no JWT claims

`permissions` es un catálogo fijo (módulo × acción) sembrado por
migración — nunca se inventa un permiso nuevo por código ni por UI.
`role_permissions` y `admin_profile_roles` (un admin puede tener más de
un rol, spec maestra §11) resuelven el árbol de qué puede hacer quién.

Una función `has_permission(user_id, module, action)` en Postgres,
`SECURITY DEFINER` y `STABLE`, es la única fuente de verdad — se usa
tanto en políticas RLS como (en Fase 1b) en checks de servidor, para que
nunca haya dos implementaciones del mismo chequeo (spec maestra §11:
"validarse también en servidor, no solamente ocultando botones").

Se descartó cachear permisos en el JWT (custom claims): más rápido, pero
un cambio de permiso no se reflejaría hasta que la sesión se renueve —
inconsistente con la expectativa de un `SUPER_ADMIN` que cambia un
permiso y espera que aplique de inmediato. El volumen de este proyecto
(un equipo chico) no justifica esa complejidad.

`SUPER_ADMIN` es un rol con `is_super_admin = true`: `has_permission`
devuelve `true` para cualquier módulo/acción sin necesitar filas en
`role_permissions`. La gestión de roles y permisos en sí (crear/editar
roles, asignar permisos) es exclusiva de `SUPER_ADMIN` — una función
separada `is_super_admin(user_id)` gatea esas tablas específicamente,
distinto del permiso genérico `usuarios` (que sí puede delegarse a un
rol no-super-admin para gestionar altas/bajas de usuarios comunes).

### 4.4 `settings` como fila única tipada

En vez de una tabla clave-valor genérica, `settings` es una tabla con
una columna por campo real de la spec maestra §34 (negocio, transferencia,
WhatsApp, tienda) y una única fila (`id smallint primary key default 1
check (id = 1)`). Da tipado real en cada columna sin parsear JSON, y
evita sobrearquitecturar para una configuración que no va a tener
cientos de claves dinámicas.

### 4.5 Snapshots en `order_items`

`order_items` guarda `product_name_snapshot`, `sku_snapshot` y
`unit_cost_snapshot` en el momento de la compra — nunca se recalculan
si el producto cambia después (spec maestra §22). `product_id` queda
como referencia para trazabilidad, pero el histórico de venta nunca
depende de que el producto siga existiendo o teniendo los mismos datos.

## 5. Entidades

Todas las tablas usan `id uuid primary key default gen_random_uuid()`
salvo `settings` (fila única) y las tablas puente (clave compuesta). Todas
tienen `created_at timestamptz not null default now()` y, donde aplica,
`updated_at timestamptz not null default now()`.

### 5.1 `categories`

| Columna | Tipo | Notas |
|---|---|---|
| `name` | text not null | |
| `slug` | text not null unique | URL amigable |
| `parent_id` | uuid references categories(id) | nullable, subcategoría |
| `icon` | text | nullable, ícono/emoji |
| `image_url` | text | nullable |
| `is_featured` | boolean not null default false | destacada en Home |
| `display_order` | int | nullable, orden manual |
| `is_active` | boolean not null default true | |

### 5.2 `products`

| Columna | Tipo | Notas |
|---|---|---|
| `internal_code` | text unique | nullable |
| `sku` | text unique | nullable |
| `barcode` | text | nullable |
| `isbn` | text | nullable |
| `name` | text not null | |
| `short_description` | text | nullable |
| `full_description` | text | nullable |
| `brand` | text | nullable |
| `publisher` | text | nullable (editorial) |
| `author` | text | nullable |
| `category_id` | uuid references categories(id) not null | |
| `tags` | text[] | nullable |
| `cost` | numeric(12,2) not null default 0 | nunca expuesto a `anon` |
| `price` | numeric(12,2) not null | |
| `sale_price` | numeric(12,2) | nullable, precio promocional |
| `profit` | numeric(12,2) generated always as (`price - cost`) stored | ver 4.1 |
| `margin_percent` | numeric(5,2) generated always as (`case when price = 0 then 0 else round(((price-cost)/price)*100,2) end`) stored | ver 4.1 |
| `available` | boolean not null default true | "Disponible en la tienda" |
| `is_published` | boolean not null default false | |
| `is_featured` | boolean not null default false | |
| `featured_order` | int | nullable |
| `is_new` | boolean not null default false | |
| `updated_by` | uuid references admin_profiles(id) | nullable |

### 5.3 `product_images`

| Columna | Tipo | Notas |
|---|---|---|
| `product_id` | uuid references products(id) on delete cascade not null | |
| `url` | text not null | |
| `position` | int not null default 0 | |
| `is_primary` | boolean not null default false | |

### 5.4 `customers`

| Columna | Tipo | Notas |
|---|---|---|
| `first_name` | text not null | |
| `last_name` | text not null | |
| `email` | text not null unique | permite upsert por email en checkout |
| `phone` | text | nullable |
| `document_type` | text | nullable |
| `document_number` | text | nullable |
| `tax_condition` | text | nullable |
| `auth_user_id` | uuid references auth.users(id) | nullable — invitado si es null |

### 5.5 `orders`

| Columna | Tipo | Notas |
|---|---|---|
| `order_number` | text not null unique | ej. `LB-1042` |
| `customer_id` | uuid references customers(id) not null | |
| `status` | text not null default `'NEW'` check in (`NEW`,`COMPLETED`,`CANCELLED`) | |
| `subtotal` | numeric(12,2) not null | |
| `total` | numeric(12,2) not null | |
| `payment_method` | text not null default `'BANK_TRANSFER'` check in (`BANK_TRANSFER`) | |
| `payment_confirmed_at` | timestamptz | nullable |

### 5.6 `order_items`

| Columna | Tipo | Notas |
|---|---|---|
| `order_id` | uuid references orders(id) on delete cascade not null | |
| `product_id` | uuid references products(id) | nullable, ver 4.5 |
| `product_name_snapshot` | text not null | |
| `sku_snapshot` | text | nullable |
| `unit_cost_snapshot` | numeric(12,2) not null | |
| `unit_price` | numeric(12,2) not null | |
| `quantity` | int not null check (`quantity > 0`) | |
| `subtotal` | numeric(12,2) not null | |

### 5.7 `admin_profiles`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid primary key references auth.users(id) on delete cascade | 1:1 con Supabase Auth |
| `full_name` | text not null | |
| `is_active` | boolean not null default true | |

### 5.8 `roles`

| Columna | Tipo | Notas |
|---|---|---|
| `name` | text not null unique | |
| `is_super_admin` | boolean not null default false | |

### 5.9 `permissions` (catálogo fijo, sembrado por migración)

| Columna | Tipo | Notas |
|---|---|---|
| `module` | text not null check in (`productos`,`precios`,`stock`,`pedidos`,`clientes`,`facturacion`,`usuarios`,`configuracion`) | |
| `action` | text not null check in (`ver`,`crear`,`editar`,`eliminar`) | |
| — | unique(`module`,`action`) | |

### 5.10 `role_permissions` (puente)

`role_id uuid references roles(id) on delete cascade`,
`permission_id uuid references permissions(id) on delete cascade`,
primary key (`role_id`, `permission_id`).

### 5.11 `admin_profile_roles` (puente, un admin puede tener ≥1 rol)

`admin_profile_id uuid references admin_profiles(id) on delete cascade`,
`role_id uuid references roles(id) on delete cascade`,
primary key (`admin_profile_id`, `role_id`).

### 5.12 `settings` (fila única)

`id smallint primary key default 1 check (id = 1)`, más:
`business_name`, `legal_name`, `tax_id`, `logo_url`, `address`, `phone`,
`whatsapp_number`, `email`, `business_hours` (negocio); `transfer_alias`,
`transfer_account_holder`, `transfer_cbu_cvu`, `transfer_bank_or_wallet`,
`transfer_instructions` (transferencia); `whatsapp_general_message`,
`whatsapp_receipt_template`, `whatsapp_shipping_inquiry_template`
(WhatsApp); `store_enabled boolean not null default true`, `hero_title`,
`hero_text`, `hero_image_url`, `hero_cta_text`, `hero_cta_link`,
`pickup_instructions_text` (tienda). Todas `text`, todas nullable salvo
`store_enabled`.

### 5.13 `product_events` (log de solo-inserción)

| Columna | Tipo | Notas |
|---|---|---|
| `event_type` | text not null check in (`view`,`search`,`add_to_cart`,`sale`) | |
| `product_id` | uuid references products(id) | nullable (null en `search` puro) |
| `search_term` | text | nullable |

### 5.14 `audit_logs`

| Columna | Tipo | Notas |
|---|---|---|
| `admin_profile_id` | uuid references admin_profiles(id) | nullable |
| `action` | text not null | |
| `entity_type` | text not null | |
| `entity_id` | text not null | |
| `before` | jsonb | nullable |
| `after` | jsonb | nullable |

## 6. Row Level Security — por tabla

Regla general: **RLS habilitado en toda tabla**, sin excepción. Ninguna
política usa `using (true)` sin una condición de negocio real de por
medio.

| Tabla | `anon` | `authenticated` (admin) |
|---|---|---|
| `categories` | `select` donde `is_active = true` | `all` si `has_permission(uid,'productos','ver'/'crear'/'editar')` según operación (sin `delete`, baja lógica vía `is_active`) |
| `products` | **sin acceso** (usar `public_products`) | `select`/`insert`/`update` según `has_permission(uid,'productos', 'ver'/'crear'/'editar')`; sin `delete` (spec §14, baja lógica) |
| `public_products` (vista) | `select` (columnas y filas ya acotadas en la vista, ver 4.2) | igual, más simple usar la vista también desde el admin para listados públicos-equivalentes si aplica |
| `product_images` | `select` si el producto padre está publicado y disponible | `all` según `has_permission(uid,'productos', ...)` |
| `customers` | **sin acceso** — el alta/edición ocurre server-side con la service role key (checkout), nunca vía RLS de cliente | `select`/`update` según `has_permission(uid,'clientes','ver'/'editar')` (spec: sin `crear`/`eliminar` para este módulo) |
| `orders` / `order_items` | **sin acceso** — se crean server-side (checkout) con service role | `select`/`update` según `has_permission(uid,'pedidos','ver'/'editar')` (sin `crear`; `eliminar` se interpreta como "anular", es un `update` de `status`) |
| `admin_profiles` | sin acceso | `select` con `usuarios:ver`; `update` con `usuarios:editar`. Alta se hace server-side (requiere crear el `auth.users` primero vía Admin API) |
| `roles` / `permissions` / `role_permissions` | sin acceso | `select` con `usuarios:ver` **o** `is_super_admin(uid)`; cualquier escritura exclusiva de `is_super_admin(uid)` |
| `admin_profile_roles` | sin acceso | `select` con `usuarios:ver`; escritura exclusiva de `is_super_admin(uid)` |
| `settings` | `select` (fila completa — spec muestra datos de transferencia al cliente post-checkout) | `update` con `configuracion:editar`; sin `insert`/`delete` (fila sembrada por migración) |
| `product_events` | `insert` (registrar señales) | `select` con `has_permission(uid,'productos','ver')` |
| `audit_logs` | sin acceso | `select` exclusivo de `is_super_admin(uid)` (no hay módulo de permisos dedicado; se usa el criterio más conservador) |

## 7. Migraciones y entorno local

- Supabase CLI (`pnpm dlx supabase`) inicializado en el repo
  (`supabase/` con `config.toml` y `migrations/`).
- Flujo: `supabase start` (Postgres local vía Docker) → escribir/aplicar
  migración localmente → verificar → `supabase link` al proyecto real →
  `supabase db push`.
- `supabase gen types typescript --local > types/supabase.ts` al final,
  wireado como parámetro genérico de `createClient<Database>(...)` en
  `lib/supabase/client.ts` y `lib/supabase/server.ts` (cierra el
  placeholder que Fase 0 dejó explícitamente afuera).

## 8. Testing / verificación de esta fase

No hay UI que ejercite este esquema todavía, así que la verificación es
directa contra la base:

1. `supabase db reset` (local) aplica todas las migraciones desde cero
   sin errores.
2. Consultas de verificación documentadas (no un framework de test
   nuevo como pgTAP — desproporcionado para este alcance):
   - `anon` puede leer `categories` activas, `public_products`,
     `settings`; **no puede** leer `products`, `customers`, `orders`
     directamente (la query debe devolver 0 filas o error de permiso,
     nunca datos).
   - Insertar un `admin_profile` + `role` (`is_super_admin = true`) +
     `admin_profile_roles` de prueba y confirmar que
     `has_permission(ese_id, 'productos', 'ver')` devuelve `true` sin
     tener ninguna fila en `role_permissions` (camino del
     `SUPER_ADMIN`).
   - Insertar un rol normal con un solo permiso y confirmar que
     `has_permission` devuelve `true` solo para ese módulo/acción y
     `false` para el resto.
3. `pnpm exec tsc --noEmit` sigue limpio con `types/supabase.ts`
   generado e importado.

## 9. Criterio de aceptación de la Fase 1a

- [ ] Las 14 tablas de la sección 5 existen en el proyecto real de
      Supabase, creadas por migraciones versionadas en el repo.
- [ ] RLS habilitado en las 14 tablas, con las políticas de la
      sección 6.
- [ ] `permissions` tiene las 32 combinaciones módulo×acción sembradas
      (8 módulos × 4 acciones) y `roles` tiene al menos un rol
      `SUPER_ADMIN` sembrado (sin asignar todavía a ningún
      `admin_profile` — eso ocurre manualmente cuando exista el primer
      usuario, ver sección 4.3).
  Nota: no todos los módulos usan las 4 acciones en la práctica (spec
  §11 muestra que "Precios" y "Clientes" no tienen `crear`/`eliminar`),
  pero el catálogo de `permissions` sí sembrará las 32 combinaciones
  completas por simplicidad — las políticas RLS de la sección 6 son las
  que efectivamente restringen qué combinaciones se usan. Si en Fase 1b
  se decide no sembrar combinaciones que ninguna política vaya a usar
  nunca, se ajusta ahí sin romper este criterio.
- [ ] Las 6 consultas de verificación de la sección 8 documentadas y
      confirmadas manualmente.
- [ ] `types/supabase.ts` generado, importado por `lib/supabase/client.ts`
      y `lib/supabase/server.ts` sin romper `pnpm typecheck`.
- [ ] `supabase db push` corrido contra el proyecto real; esquema
      confirmado también ahí (no solo local).

## 10. Decisiones que quedan para la Fase 1b

- Protección a nivel de base contra eliminar/desactivar al último
  `SUPER_ADMIN` (spec §11) — se construye junto con la UI/lógica de
  gestión de usuarios que la ejerce y testea.
- Bootstrap real del primer `SUPER_ADMIN`: se documenta el procedimiento
  manual (crear el usuario en Supabase Auth, luego un `UPDATE` para
  asignarle el rol sembrado), pero se ejecuta cuando exista login
  (Fase 1b), no en esta fase.
- Server Actions / Route Handlers que efectivamente usan
  `has_permission` en servidor (spec §11) — el esquema y la función
  quedan listos, el código que los llama es Fase 1b en adelante.
