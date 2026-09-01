# Fase 2 — Admin: Catálogo — Diseño

> **Proyecto:** Librería Blanco (plataforma e-commerce + backoffice)
> **Fase:** 2 de 8
> **Fuente de verdad funcional:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`
> **Depende de:** Fase 1a (esquema de datos), Fase 1b (auth admin + permisos) — ambas completas
> **Estado:** Aprobado por el IA Maker el 2026-08-31

## 1. Contexto

Fase 1b dejó un backoffice que solo sabe autenticar y decirle a una
administradora quién es y qué rol tiene. Esta fase construye el primer
módulo de trabajo real: gestión de categorías y productos, que es
además el módulo del que dependen todas las fases siguientes (Fase 3
portal público, Fase 4 compra, Fase 5 pedidos) — sin productos
cargados, no hay nada que mostrar ni vender.

También es la primera fase con más de una pantalla de admin, así que
construye el layout (`app/admin/(protected)/layout.tsx`) que Fase 1b
dejó pendiente explícitamente (spec maestra §38, "Layout Admin").

## 2. Objetivo de la fase

- Layout de admin con sidebar de navegación (spec maestra §89: solo
  módulos que existen hoy).
- CRUD de categorías (crear, editar, activar/desactivar) — spec
  maestra §15: "no hardcodear categorías, administrarse desde la base
  de datos".
- Alta y edición de productos con el formulario orientado a una
  librera (spec maestra §92), incluyendo cálculo de ganancia/margen en
  vivo y advertencia de precio por debajo del costo (spec maestra
  §100).
- Carga de hasta 4 imágenes por producto a Supabase Storage.
- Control de disponibilidad, publicación y destacado sin terminología
  de inventario (spec maestra §93: "no utilizar terminología de
  inventario").
- Todas las Server Actions que mutan datos de catálogo verifican
  permiso de servidor como primera línea, no solo confían en RLS.

## 3. Fuera de alcance de esta fase

- Pantallas de Pedidos, Clientes, Usuarios/Roles, Configuración del
  negocio — fases futuras.
- Borrado físico de productos/categorías — solo baja lógica
  (`is_active` / `available` / `is_published`) en esta fase. El
  hard-delete con el chequeo de "sin ventas registradas" (spec
  maestra §100) se construye en la fase de Pedidos, cuando exista
  historial real de ventas contra el que verificar.
- Historial de precios (spec maestra §17) — es "idealmente" en la spec
  maestra, no obligatorio para el MVP, y hoy no hay ninguna pantalla
  que lo consuma. Se construye si una fase futura de analítica/reportes
  lo necesita.
- Subcategorías anidadas — el esquema ya tiene `categories.parent_id`
  desde Fase 1a, pero el formulario de producto (spec maestra §92) solo
  pide "Categoría", sin mencionar subcategoría en el wireframe. Se deja
  el campo en el esquema sin UI de anidamiento.
- Portal público de catálogo (`/productos`, `/productos/[slug]`) —
  Fase 3.
- react-hook-form — se reevaluó explícitamente (pendiente de Fase 1b) y
  se decidió no sumarlo; ver §4.4.

## 4. Decisiones de diseño

### 4.1 Layout de admin: sidebar mínimo, no especulativo

`app/admin/(protected)/layout.tsx` (ya existe como gate de auth desde
Fase 1b) se extiende para envolver `children` en un layout de dos
columnas: sidebar fijo en desktop (colapsa a `Sheet` con botón
hamburguesa en mobile) + área de contenido. El sidebar lista
únicamente:

- Productos (con sub-ítem Categorías)
- (footer) nombre del usuario logueado + botón de logout

No se agregan ítems para Pedidos/Clientes/Usuarios/Configuración —
spec maestra §89 es explícita: "si todavía no existe una
funcionalidad, no mostrarla". Cada fase futura agrega su propio ítem
cuando construye esa pantalla.

El gate de auth (`getCurrentAdmin`, `redirect` si no hay sesión/perfil)
no cambia — vive en el mismo Server Component, antes del layout visual.

### 4.2 Categorías: CRUD simple en un diálogo, sin página dedicada

Una categoría son 3 campos reales (nombre, destacada, activa) más un
slug derivado — no justifica una ruta `/admin/categorias/nuevo`
separada. `/admin/categorias` es una lista con un botón "+ Crear
categoría" que abre un `Dialog` (shadcn, ya instalado) con el
formulario; "Editar" en cada fila abre el mismo diálogo pre-poblado.

Slug: función propia `slugify(name)` en `lib/utils.ts` (minúsculas,
sin acentos, espacios a guiones — sin sumar una dependencia nueva para
esto). La Server Action verifica unicidad contra `categories.slug` y,
si choca, agrega un sufijo numérico (`papeleria-2`).

Desactivar (`is_active = false`) es un `update`, nunca un `delete` —
no existe ninguna política RLS de `DELETE` sobre `categories` (Fase
1a) y esta fase no la agrega. Una categoría desactivada:
- Deja de listarse como opción en el selector de categoría del
  formulario de producto.
- No rompe productos que ya la tengan asignada (la FK sigue siendo
  válida; `is_active` no es parte de la relación).

Permiso: reutiliza el módulo `productos` ya sembrado en Fase 1a (no
existe módulo `categorias` separado en `permissions.module`).

### 4.3 Productos: formulario único, cálculo de precio en vivo, imágenes limitadas

**Lista** (`/admin/productos`): tabla en desktop (`Table`, shadcn),
cards en mobile (`< 768px`, mismo criterio de breakpoint que spec
maestra §101). Columnas: foto (thumbnail), nombre, precio, disponible
(switch inline), estado (badge Publicado/Borrador), acciones (Editar,
Destacar/quitar). Tabs de filtro (`Tabs`, shadcn): Todos, Publicados,
No disponibles, Destacados. Buscador por nombre con `ilike` server-side
(sin debounce complejo — un input con Server Action en submit o
`useDeferredValue` simple).

Acciones rápidas de la fila (disponible, publicar, destacar) son
botones que disparan una Server Action de un solo campo cada uno
(`toggleProductAvailability`, `toggleProductPublished`,
`toggleProductFeatured`) — nunca abren el formulario completo, spec
maestra §91: "no obligar a abrir el producto para tareas simples".

**Alta** (`/admin/productos/nuevo`) y **edición**
(`/admin/productos/[id]`) comparten el mismo Client Component de
formulario (`components/admin/product-form.tsx`), parametrizado por
`mode: "create" | "edit"` y valores iniciales. Estructura de campos,
siguiendo el wireframe spec maestra §92 exactamente:

1. **Principal:** nombre*, categoría* (select, solo categorías
   activas), descripción corta, foto (ver §4.5).
2. **Precio:** costo, precio de venta — ganancia y margen calculados
   **en el cliente**, en vivo, con JS puro (sin librería, son dos
   restas/divisiones) mientras la usuaria tipea, mostrando el mismo
   texto de la spec ("Ganás por unidad: $X — Eso representa: Y% del
   precio"). Antes de enviar el form, si `price < cost` (o
   `sale_price < cost` cuando hay precio promocional), se muestra un
   `AlertDialog` de confirmación con el texto exacto de spec maestra
   §100 ("Vas a perder $350 por unidad. ¿Querés guardar igualmente?")
   — no bloquea, solo confirma.
3. **Tienda online:** 4 checkboxes/switches — disponible, mostrar en
   la tienda (`is_published`), destacar (`is_featured`), novedad
   (`is_new`).
4. **Más datos** (colapsable, componente `Accordion` de shadcn — se
   agrega en esta fase, no existe todavía): SKU, ISBN, código de
   barras, marca, autor, editorial, tags (input de texto separado por
   comas → `text[]`).

Validación: `lib/validations/product.ts`, un único `productSchema` Zod
consumido por el formulario (mensajes inline) y revalidado server-side
en la Server Action — mismo patrón que `adminLoginSchema` de Fase 1b.
`price` y `cost` son `z.coerce.number().nonnegative()`; `name` y
`category_id` son requeridos; el resto opcional.

"Salir con cambios sin guardar" (spec maestra §100): el formulario usa
un `beforeunload` guard simple basado en si el form está `dirty`
(comparación shallow contra los valores iniciales) — sin sumar
react-hook-form solo para esto.

### 4.4 Por qué no react-hook-form

Confirmado con el IA Maker: el formulario de producto, aunque tiene
~20 campos, vive en una sola pantalla sin arrays dinámicos ni
validación cruzada compleja más allá del warning de precio (que ya se
resuelve con un chequeo puntual antes de enviar). `useActionState` +
Zod cubre esto con el mismo patrón ya probado en el login de Fase 1b,
sin sumar una dependencia ni un segundo patrón de formularios en el
proyecto. Se reevalúa si una fase futura necesita listas dinámicas
reales (por ejemplo, variantes de producto).

### 4.5 Imágenes: bucket público, máximo 4, sin reordenamiento por arrastre

Nuevo bucket de Supabase Storage `product-images` (público — la
vidriera pública, Fase 3, necesita servirlas sin autenticación).
Políticas de Storage (`storage.objects`):

- Lectura pública (`select`) para cualquiera — son imágenes de
  catálogo, no hay dato sensible.
- Escritura (`insert`/`update`/`delete`) solo para `authenticated` con
  `has_permission(auth.uid(), 'productos', 'editar')` — misma función
  ya creada en Fase 1a, reutilizada también para autorizar Storage.

Límite de 4 imágenes por producto, validado server-side en la Server
Action de subida (cuenta filas existentes en `product_images` antes de
insertar). Reordenamiento con dos botones por imagen (▲/▼) que
intercambian el campo `position` con la imagen adyacente — sin
drag-and-drop, que agregaría una librería solo para esto. La imagen
marcada `is_primary` es la que se usa como thumbnail en la lista y como
imagen principal en la futura ficha pública (Fase 3).

En alta de producto, la sección de imágenes está deshabilitada con el
texto "Guardá el producto para poder agregar fotos" hasta el primer
guardado exitoso (necesita un `product_id` real para asociar el
archivo) — luego de guardar, redirige a
`/admin/productos/[id]?created=1` donde la sección ya está habilitada.

### 4.6 Permisos: `requirePermission` como primera línea, wrapper para no repetir

Recomendación pendiente de la revisión final de Fase 1b, aplicada
ahora: toda Server Action que muta catálogo llama
`requirePermission("productos", <accion>)` **antes** de tocar
Supabase, para que el rechazo de autorización sea explícito en el
código del servidor y no dependa únicamente de que la RLS lo bloquee
silenciosamente. Se agrega a `lib/auth/permissions.ts`:

```typescript
export async function withPermission<T>(
  module: PermissionModule,
  action: PermissionAction,
  fn: (admin: AdminProfile) => Promise<T>,
): Promise<T> {
  const admin = await requirePermission(module, action);
  return fn(admin);
}
```

Cada Server Action queda como:

```typescript
export async function createProduct(input: ProductInput) {
  return withPermission("productos", "crear", async () => {
    // ... lógica real
  });
}
```

`ForbiddenError` (ya existe desde Fase 1b) se deja propagar; esta fase
decide cómo se muestra en UI: como un `toast.error` genérico ("No
tenés permiso para esta acción") capturado en el cliente al recibir el
resultado de la Server Action — nunca un error técnico crudo (spec
maestra §47).

### 4.7 Mensajes y confirmaciones

Toda confirmación de guardado usa `sonner` (ya instalado) con el
lenguaje de negocio exacto que pide spec maestra §99: "Producto
guardado.", "Categoría guardada.", "Producto destacado.", etc. — nunca
"Entity updated" ni equivalentes técnicos.

## 5. Estructura de archivos

```text
app/
  admin/
    (protected)/
      layout.tsx                       # se extiende: agrega sidebar visual sobre el gate existente
      productos/
        page.tsx                       # lista + filtros + búsqueda
        nuevo/
          page.tsx                     # alta (usa product-form.tsx)
        [id]/
          page.tsx                     # edición (usa product-form.tsx) + sección de imágenes
        actions.ts                     # createProduct, updateProduct, toggleProductAvailability,
                                        # toggleProductPublished, toggleProductFeatured,
                                        # uploadProductImage, deleteProductImage, reorderProductImage
      categorias/
        page.tsx                       # lista + diálogo alta/edición
        actions.ts                     # createCategory, updateCategory, toggleCategoryActive

components/
  admin/
    sidebar.tsx                        # nav de escritorio + Sheet de mobile
    sidebar.test.tsx
    product-form.tsx                   # Client Component, mode create|edit
    product-form.test.tsx
    product-image-manager.tsx          # Client Component: sube, reordena, borra imágenes
    category-dialog.tsx                # Dialog de alta/edición de categoría
    category-dialog.test.tsx
    price-warning-dialog.tsx           # AlertDialog de precio < costo

lib/
  validations/
    product.ts                        # productSchema
    product.test.ts
    category.ts                       # categorySchema
    category.test.ts
  auth/
    permissions.ts                    # + withPermission (se agrega a lo existente)
    permissions.test.ts               # + casos de withPermission
  utils.ts                            # + slugify (se agrega a lo existente)
  utils.test.ts                       # + casos de slugify

supabase/
  migrations/
    <timestamp>_product_images_bucket.sql   # crea bucket + políticas de storage.objects
```

No se crea `components/admin/product-table.tsx` separado de
`app/admin/(protected)/productos/page.tsx` — la tabla es
suficientemente simple (una sola pantalla la usa) para vivir inline en
el Server Component de la página; se extrae si una segunda pantalla
necesita reusarla.

## 6. Flujo de datos

### Alta de producto con imágenes

```text
Usuaria completa el formulario (sin imágenes todavía)
  → productSchema valida en cliente
  → si price < cost: AlertDialog de confirmación
  → Server Action createProduct
  → withPermission("productos", "crear")
  → productSchema revalida en servidor
  → insert en products
  → redirect a /admin/productos/[id]?created=1
  → sección de imágenes habilitada
  → por cada imagen: sube a Storage (bucket product-images)
    → Server Action uploadProductImage inserta fila en product_images
    → chequea que existan menos de 4 imágenes antes de insertar
```

### Toggle rápido desde la lista

```text
Click en "Disponible" (switch inline)
  → Server Action toggleProductAvailability(id)
  → withPermission("productos", "editar")
  → update products set available = not available
  → revalidatePath("/admin/productos")
  → toast.success("Disponibilidad actualizada.")
```

### Desactivar categoría

```text
Click en "Desactivar" en la lista de categorías
  → Server Action toggleCategoryActive(id)
  → withPermission("productos", "editar")
  → update categories set is_active = false
  → revalidatePath("/admin/categorias")
  → el selector de categoría en el form de producto deja de ofrecerla
```

## 7. Seguridad

- Todas las Server Actions de mutación llaman `withPermission` como
  primera operación (§4.6) — la autorización de servidor nunca depende
  solo de que la query a Supabase falle por RLS.
- El bucket `product-images` es público en lectura (imágenes de
  catálogo, sin dato sensible) pero la escritura requiere
  `has_permission(auth.uid(), 'productos', 'editar')` vía política de
  `storage.objects` — mismo motor de permisos que el resto del
  sistema, nunca una regla nueva y paralela.
- El límite de 4 imágenes se valida server-side (Server Action), no
  solo deshabilitando el botón en el cliente.
- Ningún campo de costo/ganancia/margen se expone nunca a través de
  `public_products` (ya garantizado por la vista de Fase 1a — esta
  fase no la modifica).
- Los mensajes de error de Server Actions hacia el cliente son siempre
  genéricos en negocio ("No pudimos guardar el producto.", "No tenés
  permiso para esta acción.") — nunca el mensaje crudo de Postgres o
  Supabase.

## 8. Testing

- `slugify`: unitario — casos con acentos, espacios múltiples,
  mayúsculas, caracteres especiales.
- `productSchema` / `categorySchema`: unitarios — casos válidos e
  inválidos (nombre vacío, precio negativo, categoría faltante).
- `withPermission`: unitario, mockeando `requirePermission` — caso
  permiso concedido (ejecuta `fn`) y caso denegado (propaga
  `ForbiddenError` sin ejecutar `fn`).
- Cálculo de ganancia/margen en el cliente: unitario sobre la función
  pura de cálculo (extraída de `product-form.tsx` a una función
  testeable, ej. `calculateMargin(cost, price)`).
- Verificación manual con Playwright contra el stack local: crear
  categoría, crear producto completo con una imagen, editar precio y
  confirmar que aparece el diálogo de advertencia cuando
  `price < cost`, publicar/despublicar desde la lista, destacar un
  producto, desactivar una categoría y confirmar que desaparece del
  selector, responsive en 360px/768px/1440px (spec maestra §101).

## 9. Criterio de aceptación de la Fase 2

- [ ] El layout de `/admin/*` muestra un sidebar con Productos y
      Categorías, y el usuario logueado puede cerrar sesión desde ahí.
- [ ] `/admin/categorias` permite crear, editar y desactivar
      categorías; una categoría desactivada no aparece como opción al
      crear/editar un producto.
- [ ] `/admin/productos` lista productos con filtros (Todos,
      Publicados, No disponibles, Destacados) y búsqueda por nombre.
- [ ] Desde la lista se puede cambiar disponibilidad, publicación y
      destacado sin abrir el formulario completo.
- [ ] `/admin/productos/nuevo` permite cargar un producto completo
      (todos los campos de spec maestra §13) y ver el cálculo de
      ganancia/margen en vivo.
- [ ] Si el precio de venta es menor al costo, se muestra la
      confirmación de spec maestra §100 antes de guardar.
- [ ] Un producto recién creado permite subir hasta 4 imágenes,
      marcar una como principal y reordenarlas.
- [ ] Ningún mensaje de error crudo de Supabase/Postgres llega a la
      UI en ningún flujo de esta fase.
- [ ] Todas las Server Actions de mutación de catálogo verifican
      permiso server-side antes de ejecutar la operación.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pasan sin errores.
- [ ] Verificación manual en producción: login real, crear una
      categoría y un producto real, confirmar que aparecen
      correctamente.

## 10. Decisiones que quedan para fases futuras

- Hard-delete de productos/categorías con chequeo de "sin ventas" —
  Fase de Pedidos.
- Historial de precios — fase de analítica/reportes, si se necesita.
- Subcategorías anidadas en la UI — si una fase futura lo pide
  explícitamente.
- Reordenamiento de imágenes por drag-and-drop — mejora de UX, no
  bloqueante para el MVP.
- Sidebar con más módulos — cada fase agrega su propio ítem al
  construir su pantalla.
- **Guardia de "salir con cambios sin guardar" (`beforeunload`) en
  `ProductForm`** — spec maestra §100 y §4.3 de este diseño la pedían;
  la revisión final de esta fase detectó que el plan de implementación
  la omitió sin registrar la decisión. Se difiere explícitamente a una
  pasada de Fase 6 ("Pulido") en vez de improvisar un dirty-check bajo
  presión de tiempo en el fix wave final de esta fase.
