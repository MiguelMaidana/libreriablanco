# Fase 3 — Portal Público — Diseño

> **Proyecto:** Librería Blanco (plataforma e-commerce + backoffice)
> **Fase:** 3 de 8
> **Fuente de verdad funcional:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`
> **Depende de:** Fase 1a (modelo de datos), Fase 2 (Admin: Catálogo) — ambas completas
> **Estado:** Aprobado por el IA Maker el 2026-09-01

## 1. Contexto

Hasta ahora el proyecto solo tiene backoffice: una administradora puede
cargar categorías y productos, pero no existe ningún lugar público
donde un cliente real pueda verlos. Esta fase construye la vidriera:
Home comercial, catálogo navegable, ficha de producto y la integración
de WhatsApp como canal de venta — todo de solo lectura, sin cuenta de
cliente ni carrito visible (eso es Fase 4, "Compra invitado").

El criterio de éxito de esta fase es: **una visitante entra al sitio,
encuentra un producto por búsqueda o categoría, ve su ficha completa, y
puede iniciar una consulta por WhatsApp** — sin poder comprar todavía.

## 2. Objetivo de la fase

- Home comercial (spec maestra §76-83): barra informativa, header,
  hero administrable, categorías destacadas, destacados manuales,
  novedades.
- Catálogo público (`/productos`) con búsqueda, filtro por categoría y
  orden.
- Página de categoría (`/categoria/[slug]`).
- Ficha de producto (`/productos/[slug]`) con galería de imágenes,
  descripción, disponibilidad, consulta por WhatsApp y relacionados.
- URLs limpias para productos — requiere agregar `slug` a `products`
  (no existía; solo `categories` lo tenía desde Fase 1a).
- Toda lectura pública pasa por las políticas RLS ya existentes desde
  Fase 1a (`public_products`, `categories`, `settings`) — esta fase no
  debilita ni reinterpreta esas políticas.

## 3. Fuera de alcance de esta fase

- Carrito y checkout (`/carrito`, `/checkout`, `/compra-exitosa`) —
  Fase 4. Ningún botón "Agregar al carrito" aparece en esta fase; el
  CTA principal de cards y ficha es "Consultar por WhatsApp".
- Rankings automáticos ("Más buscados/vistos/vendidos", spec maestra
  §82) — la spec misma prioriza la curación manual (`is_featured`,
  `is_new`, ya soportadas) por sobre estos rankings para el MVP. Se
  difieren a una fase de analítica dedicada. Tampoco se registra
  `product_events` en esta fase (ni vistas ni búsquedas) — no hay nada
  todavía que consuma esos datos.
- Pantalla de administración de `settings` (spec maestra §97,
  "Configuración del negocio") — esta fase solo *lee* `settings`; si
  hace falta cambiar el hero o el número de WhatsApp antes de que
  exista esa pantalla, se hace por SQL directo, igual que el bootstrap
  del SUPER_ADMIN en Fase 1b.
- `sitemap.xml` / SEO avanzado — se agrega `generateMetadata` básico
  por página; sitemap queda para una pasada de SEO dedicada.
- Wishlist de cliente — explícitamente fuera del MVP (spec maestra
  §81).

## 4. Decisiones de diseño

### 4.1 Slug de producto: se agrega ahora, mismo patrón que categorías

`products` no tenía columna `slug` (solo `categories` la tenía desde
Fase 1a) pero la spec maestra §51 pide `/productos/[slug]`. Hay 0
productos reales en producción hoy, así que agregar la columna no
requiere backfill. Se agrega:

```sql
alter table public.products add column slug text unique;
```

y se actualiza `createProduct`/`updateProduct` (Fase 2,
`app/admin/(protected)/productos/actions.ts`) para generarlo con el
mismo `slugify()` + verificación de unicidad que ya usa
`categorias/actions.ts` — no se reimplementa la lógica, se extrae a un
helper compartido si hace falta. La vista `public_products` (Fase 1a)
se actualiza para exponer `slug`.

### 4.2 Sin carrito visible en esta fase

Confirmado con el IA Maker: las cards y la ficha de producto muestran
"Consultar por WhatsApp" como CTA principal, no "Agregar al carrito".
Evita construir un botón que no hace nada — el carrito aparece en Fase
4 cuando sea funcional de punta a punta. `settings.whatsapp_number` y
las plantillas de mensaje (`whatsapp_general_message`, ya sembradas en
Fase 1a) alimentan el link `https://wa.me/<numero>?text=<mensaje>`.

### 4.3 Solo curación manual, sin rankings automáticos

Home usa exclusivamente columnas que ya existen:
`categories.is_featured`/`display_order` para categorías destacadas,
`products.is_featured`/`featured_order` para destacados,
`products.is_new` para novedades. Ningún código nuevo escribe en
`product_events` en esta fase.

### 4.4 Route group `(shop)` separado del layout raíz y de `/admin`

```text
app/(shop)/
  layout.tsx
  page.tsx
  productos/
    page.tsx
    [slug]/page.tsx
  categoria/
    [slug]/page.tsx
```

El layout raíz (`app/layout.tsx`) sigue siendo mínimo (html, fuentes,
metadata global) — el header/barra/footer del portal viven en
`app/(shop)/layout.tsx`, sin afectar `app/admin/(protected)/layout.tsx`
(que tiene su propio sidebar). El route group `(shop)` no aparece en la
URL.

### 4.5 Búsqueda: `ilike` simple, mismo patrón que el admin

Sin full-text search todavía — `ilike` sobre `name` (y `tags` si hace
falta), igual que el buscador de productos del admin (Fase 2). Se
migra a `tsvector`/GIN si el catálogo crece lo suficiente para
justificarlo.

### 4.6 Estructura del Home

Orden fijo (spec maestra §76.1), cada bloque se omite limpiamente si no
hay datos (nunca una sección vacía con título):

1. Barra informativa (retiro + WhatsApp; se oculta si
   `settings.store_enabled = false`, mostrando un aviso de
   mantenimiento en su lugar).
2. Header (logo, buscador, WhatsApp).
3. Hero (`settings.hero_*`; si `hero_title` es `null`, se muestra un
   hero por defecto fijo en el código, nunca una sección rota).
4. Categorías destacadas.
5. Destacados.
6. Novedades.
7. Bloque de confianza (texto fijo: retiro en local, consultas por
   WhatsApp, "Mercado Pago próximamente" — no se anuncia un medio de
   pago que todavía no existe).
8. Footer.

### 4.7 Cards y ficha de producto: nunca datos administrativos

Spec maestra §84 es explícita: nunca SKU, costo, margen ni stock
numérico en una card pública. Esto ya está garantizado a nivel de base
por `public_products` (Fase 1a nunca expone esas columnas), pero el
diseño de los componentes tampoco las recibe como prop — ni siquiera
por accidente si alguien reusa un tipo más amplio.

## 5. Estructura de archivos

```text
supabase/
  migrations/
    <timestamp>_products_slug.sql       # alter table + actualiza public_products

app/
  (shop)/
    layout.tsx                          # header + barra + footer
    page.tsx                            # Home
    productos/
      page.tsx                          # catálogo: grilla + búsqueda + filtro + orden
      [slug]/
        page.tsx                        # ficha de producto
    categoria/
      [slug]/
        page.tsx                        # productos de una categoría

components/
  shop/
    header.tsx
    footer.tsx
    info-bar.tsx
    hero.tsx
    category-pill.tsx
    product-card.tsx
    product-gallery.tsx
    whatsapp-button.tsx
    search-input.tsx
    product-filters.tsx                 # categoría + orden (query params)

lib/
  shop/
    whatsapp.ts                         # arma el link wa.me con mensaje pre-cargado
    whatsapp.test.ts
  validations/
    (sin cambios — esta fase no agrega formularios administrables)

app/admin/(protected)/productos/
  actions.ts                            # se modifica: genera slug en create/update
  actions.test.ts                       # se agregan casos de generación de slug
```

`components/shop/` es nueva (primera vez que el portal público tiene
componentes propios, separados de `components/ui/` y
`components/admin/`).

## 6. Flujo de datos

### Home

```text
GET /
  → lee settings (hero, store_enabled)
  → lee categories where is_active and is_featured order by display_order
  → lee public_products where is_featured order by featured_order limit N
  → lee public_products where is_new order by created_at desc limit N
  → renderiza secciones, omitiendo las que no tienen datos
```

### Catálogo

```text
GET /productos?q=cuaderno&categoria=escolar&orden=precio_asc
  → construye query sobre public_products:
      ilike name '%q%' (si hay q)
      category_id = <resuelto de categoria> (si hay categoria)
      order by price asc/desc | created_at desc (según orden)
  → grilla de ProductCard, estado vacío si no hay resultados
```

### Ficha de producto

```text
GET /productos/[slug]
  → busca en public_products por slug
  → si no existe → notFound()
  → lee product_images del producto
  → lee 4 productos de la misma categoría (excluyendo el actual) para
    "También te puede interesar"
  → arma el link de WhatsApp con lib/shop/whatsapp.ts
```

## 7. Seguridad

- Todo acceso de lectura pasa por RLS ya vigente desde Fase 1a
  (`public_products`, lectura pública de `categories` activas,
  lectura pública de `settings`, lectura pública de `product_images`
  de productos visibles) — esta fase no crea ninguna política nueva de
  lectura ni modifica las existentes.
- El único cambio de esquema (columna `slug`) no expone ningún dato
  nuevo — es un campo de identificación, igual que `categories.slug`
  ya público.
- La generación de slug en `createProduct`/`updateProduct` sigue
  protegida por `withPermissionAction("productos", "crear"/"editar", ...)`
  ya establecido en Fase 2 — no se agrega ninguna superficie de mutación
  nueva.

## 8. Testing

- `lib/shop/whatsapp.ts`: unitario — arma correctamente la URL
  `https://wa.me/<numero>?text=<mensaje codificado>` a partir de un
  producto y la plantilla de `settings`.
- Generación de slug de producto: unitario en
  `app/admin/(protected)/productos/actions.test.ts` (casos de slug
  único y de colisión, mismo patrón que categorías).
- Verificación manual con Playwright contra el stack local: Home carga
  con datos reales cargados vía el admin, buscar un producto por
  nombre, entrar a su ficha, click en "Consultar por WhatsApp" abre
  `wa.me` con el mensaje esperado, navegar por una categoría, responsive
  en 360px/768px/1440px (spec maestra §101).

## 9. Criterio de aceptación de la Fase 3

- [ ] `/` muestra Home comercial con las secciones de §4.6, cada una
      presente solo si hay datos.
- [ ] `/productos` lista productos publicados y disponibles, con
      búsqueda por nombre, filtro por categoría y orden por precio.
- [ ] `/categoria/[slug]` muestra los productos de esa categoría, 404
      si el slug no existe o está inactiva.
- [ ] `/productos/[slug]` muestra la ficha completa (imágenes, nombre,
      precio, disponibilidad, descripción, WhatsApp, relacionados), 404
      si el producto no existe o no está visible.
- [ ] Ninguna card ni ficha muestra SKU, costo, margen o stock
      numérico.
- [ ] El botón de WhatsApp arma el link correcto con el mensaje
      esperado.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pasan sin errores.
- [ ] Verificación manual en producción: cargar un producto real desde
      el admin, confirmar que aparece correctamente en el portal
      público.

## 10. Decisiones que quedan para fases futuras

- Rankings automáticos ("Más buscados/vistos/vendidos") — fase de
  analítica, cuando se decida registrar `product_events` desde el
  portal.
- Pantalla de administración de `settings` — spec maestra §97, fase no
  asignada todavía.
- `sitemap.xml` y SEO avanzado (structured data, OpenGraph completo).
- Carrito y checkout — Fase 4.
- Full-text search si el catálogo crece más allá de lo que `ilike`
  puede manejar cómodamente.
