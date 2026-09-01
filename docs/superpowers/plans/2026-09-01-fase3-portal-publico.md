# Fase 3 — Portal Público — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por
> tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Construir la vidriera pública: Home comercial, catálogo
con búsqueda/filtros/orden, página de categoría y ficha de producto,
con WhatsApp como canal de consulta. Sin carrito, sin checkout, sin
cuenta de cliente.

**Arquitectura:** Route group `app/(shop)/` con su propio layout
(header/barra/footer), separado del layout raíz y de `/admin`. Todo
Server Components para lectura — ninguna Server Action nueva de
mutación en el portal público. Toda lectura pasa por las políticas RLS
públicas ya vigentes desde Fase 1a (`public_products`, `categories`,
`settings`, `product_images`).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind
v4 + shadcn/ui, Supabase (Postgres, solo lectura pública), Vitest +
Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-fase3-portal-publico-design.md`

## Global Constraints

- Ninguna card ni ficha de producto muestra SKU, costo, margen o stock
  numérico — todo el portal lee de `public_products`, nunca de
  `products` directo (esa tabla es admin-only vía RLS de todos modos).
- Sin botón "Agregar al carrito" en ningún componente de esta fase — el
  CTA principal es "Consultar por WhatsApp".
- Sin registro de `product_events` (ni vistas ni búsquedas) en esta
  fase — se difiere a una fase de analítica.
- Toda interpolación de `$` en JSX usa un template literal real
  (`` {`$${valor}`} ``) — nunca `${valor}` como texto JSX plano (bug ya
  encontrado y corregido dos veces en Fase 2; no debe repetirse).
- Los componentes nuevos de esta fase viven en `components/shop/` —
  nunca se reutiliza `components/admin/` ni se mezcla lógica de
  autenticación en estos componentes (el portal no tiene sesión).
- Esta fase modifica dos archivos de Fase 2 ya en producción
  (`app/admin/(protected)/productos/actions.ts` para generar `slug`, y
  `app/admin/(protected)/categorias/actions.ts` para usar el helper de
  slug compartido) — son los únicos archivos fuera de `(shop)`/`shop/`
  que este plan toca, y ambos cambios están descritos explícitamente en
  la Tarea 1.

---

### Task 1: Slug de producto — migración + helper compartido + Server Actions

**Files:**
- Create: migración vía `supabase migration new products_slug`
- Create: `lib/slug.ts`
- Create: `lib/slug.test.ts`
- Modify: `app/admin/(protected)/categorias/actions.ts` (usa el helper compartido en vez de su copia local)
- Modify: `app/admin/(protected)/productos/actions.ts` (genera `slug` en create/update)
- Modify: `app/admin/(protected)/productos/actions.test.ts` (agrega casos de slug)

**Interfaces:**
- Produce: `uniqueSlug(supabase, table: "categories" | "products", base: string, excludeId?: string): Promise<string>` en `lib/slug.ts` — reemplaza las dos copias locales que existían en `categorias/actions.ts` (Fase 2) y evita duplicar la misma en `productos/actions.ts`.
- Consumido por: Tareas 5, 6, 7 (leen `products.slug`/`categories.slug` desde el portal público, ya expuestos por `public_products`/`categories`).

- [ ] **Step 1: Crear la migración**

Run: `supabase migration new products_slug`

- [ ] **Step 2: Escribir el contenido de la migración**

```sql
alter table public.products add column slug text unique;

create or replace view public.public_products
with (security_barrier = true)
as
select
  id, internal_code, sku, barcode, isbn, name, slug, short_description, full_description,
  brand, publisher, author, category_id, tags, price, sale_price,
  available, is_published, is_featured, featured_order, is_new, created_at
from public.products
where is_published = true and available = true;

-- CREATE OR REPLACE VIEW conserva el owner/ACL existente, pero se
-- reafirman los grants explícitamente (defensa en profundidad, mismo
-- criterio que Fase 1a/1b): esta vista nunca debe aceptar escritura.
revoke all on public.public_products from anon, authenticated, service_role, public;
grant select on public.public_products to anon, authenticated;
```

- [ ] **Step 3: Aplicar en local y verificar**

Run: `supabase db reset`
Expected: corre sin error junto con todas las migraciones anteriores.

Run: `supabase db execute --sql "select column_name from information_schema.columns where table_name = 'public_products' and column_name = 'slug';"` (o el subcomando equivalente de tu versión del CLI, ver Tarea 8 para el comando exacto ya usado en este proyecto)
Expected: una fila, confirma que `slug` quedó expuesto en la vista.

- [ ] **Step 4: Regenerar tipos**

Run: `supabase gen types typescript --local > types/supabase.ts`

- [ ] **Step 5: Escribir el test de `uniqueSlug`**

```typescript
// lib/slug.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

import { uniqueSlug } from "./slug";

describe("uniqueSlug", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("devuelve el slug base si no choca con ninguno existente", async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    const result = await uniqueSlug({ from: mockFrom } as never, "products", "cuaderno-a4");

    expect(result).toBe("cuaderno-a4");
    expect(mockFrom).toHaveBeenCalledWith("products");
  });

  it("agrega un sufijo numérico si el slug base ya existe", async () => {
    let call = 0;
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => {
        call += 1;
        return call === 1 ? { data: { id: "existing" }, error: null } : { data: null, error: null };
      }),
    };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    const result = await uniqueSlug({ from: mockFrom } as never, "products", "cuaderno-a4");

    expect(result).toBe("cuaderno-a4-2");
  });

  it("excluye el propio registro cuando se pasa excludeId", async () => {
    const neq = vi.fn().mockReturnThis();
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      neq,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    await uniqueSlug({ from: mockFrom } as never, "products", "cuaderno-a4", "prod-1");

    expect(neq).toHaveBeenCalledWith("id", "prod-1");
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/slug.test.ts`
Expected: FAIL — `./slug` no existe.

- [ ] **Step 7: Implementar `lib/slug.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function uniqueSlug(
  supabase: SupabaseClient,
  table: "categories" | "products",
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (;;) {
    let query = supabase.from(table).select("id").eq("slug", candidate);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data } = await query.maybeSingle();
    if (!data) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/slug.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Actualizar `categorias/actions.ts` para usar el helper compartido**

Reemplazar la función local `uniqueSlug` (y su import de `createClient`
si ya no se usa directo para eso) por un import desde `@/lib/slug`, y
actualizar las dos llamadas (`createCategory`, `updateCategory`) para
pasar `"categories"` como segundo argumento:

```typescript
import { uniqueSlug } from "@/lib/slug";
// ... eliminar la definición local de uniqueSlug ...

// en createCategory:
const slug = await uniqueSlug(supabase, "categories", slugify(parsed.data.name));

// en updateCategory:
const slug = await uniqueSlug(supabase, "categories", slugify(parsed.data.name), id);
```

El comportamiento no cambia — es la misma lógica, ahora compartida.
`categorias/actions.test.ts` no necesita cambios (no testea
`uniqueSlug` de forma aislada, la ejercita a través de
`createCategory`/`updateCategory`).

- [ ] **Step 10: Escribir los casos nuevos de slug en `productos/actions.test.ts`**

Agregar al `describe("createProduct", ...)` existente (mismo archivo,
mismo patrón de mocks ya establecido en Fase 2):

```typescript
it("genera un slug a partir del nombre", async () => {
  mockAdminAllowed();

  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const single = vi.fn().mockResolvedValue({ data: { id: "prod-1" }, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  mockFrom.mockImplementation((table: string) =>
    table === "products" ? { select: vi.fn().mockReturnValue(selectChain), insert } : { select: vi.fn().mockReturnValue(selectChain) },
  );

  await createProduct({ error: null, productId: null }, formData(validFields));

  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ slug: "cuaderno-rivadavia-a4" }),
  );
});
```

- [ ] **Step 11: Correr el test y verificar que falla**

Run: `pnpm vitest run "app/admin/(protected)/productos/actions.test.ts"`
Expected: FAIL — `insert` no recibe `slug` todavía.

- [ ] **Step 12: Generar el slug en `createProduct`/`updateProduct`**

```typescript
import { slugify } from "@/lib/utils";
import { uniqueSlug } from "@/lib/slug";

// dentro de createProduct, después de validar:
const slug = await uniqueSlug(supabase, "products", slugify(parsed.data.name));
const { data, error } = await supabase
  .from("products")
  .insert({ ...toRow(parsed.data), slug, updated_by: admin.id })
  .select("id")
  .single();

// dentro de updateProduct, después de validar:
const slug = await uniqueSlug(supabase, "products", slugify(parsed.data.name), id);
const { error } = await supabase
  .from("products")
  .update({ ...toRow(parsed.data), slug, updated_by: admin.id })
  .eq("id", id);
```

Notar que `supabase` debe crearse (`await createClient()`) ANTES de
llamar `uniqueSlug`, no después — reordenar si hace falta.

- [ ] **Step 13: Correr los tests y verificar que pasan**

Run: `pnpm vitest run "app/admin/(protected)/productos/actions.test.ts" "app/admin/(protected)/categorias/actions.test.ts" lib/slug.test.ts`
Expected: PASS (todos los casos)

- [ ] **Step 14: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 15: Commit**

```bash
git add supabase/migrations/*_products_slug.sql types/supabase.ts lib/slug.ts lib/slug.test.ts "app/admin/(protected)/categorias/actions.ts" "app/admin/(protected)/productos/actions.ts" "app/admin/(protected)/productos/actions.test.ts"
git commit -m "feat: slug de producto + helper compartido de slugs"
```

---

### Task 2: Helpers del portal (settings, WhatsApp, imágenes, orden)

**Files:**
- Create: `lib/shop/settings.ts`
- Create: `lib/shop/settings.test.ts`
- Create: `lib/shop/whatsapp.ts`
- Create: `lib/shop/whatsapp.test.ts`
- Create: `lib/shop/products.ts`
- Create: `lib/shop/products.test.ts`
- Create: `lib/shop/sort.ts`
- Create: `lib/shop/sort.test.ts`

**Interfaces:**
- Produce: `getSettings(): Promise<Settings | null>`, `buildWhatsAppUrl(phoneNumber: string, message: string): string`, `buildProductInquiryMessage(productName: string, productUrl: string): string`, `attachPrimaryImages(supabase, products: PublicProduct[]): Promise<ShopProduct[]>`, `resolveSortOption(value: string | undefined): SortOption`.
- Consumido por: Tareas 3, 4, 5, 6, 7.

- [ ] **Step 1: Escribir el test de `resolveSortOption`**

```typescript
// lib/shop/sort.test.ts
import { describe, it, expect } from "vitest";
import { resolveSortOption } from "./sort";

describe("resolveSortOption", () => {
  it("devuelve precio_asc cuando el valor es válido", () => {
    expect(resolveSortOption("precio_asc")).toBe("precio_asc");
  });

  it("devuelve precio_desc cuando el valor es válido", () => {
    expect(resolveSortOption("precio_desc")).toBe("precio_desc");
  });

  it("devuelve relevancia para undefined", () => {
    expect(resolveSortOption(undefined)).toBe("relevancia");
  });

  it("devuelve relevancia para un valor desconocido (no confía en el query param)", () => {
    expect(resolveSortOption("cualquiercosa")).toBe("relevancia");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm vitest run lib/shop/sort.test.ts`
Expected: FAIL — `./sort` no existe.

- [ ] **Step 3: Implementar `lib/shop/sort.ts`**

```typescript
export type SortOption = "relevancia" | "precio_asc" | "precio_desc";

export function resolveSortOption(value: string | undefined): SortOption {
  if (value === "precio_asc" || value === "precio_desc") {
    return value;
  }
  return "relevancia";
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm vitest run lib/shop/sort.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir el test de `buildWhatsAppUrl`/`buildProductInquiryMessage`**

```typescript
// lib/shop/whatsapp.test.ts
import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl, buildProductInquiryMessage } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("arma la URL de wa.me quitando caracteres no numéricos del teléfono", () => {
    const url = buildWhatsAppUrl("+54 9 11 5555-5555", "Hola");
    expect(url).toBe("https://wa.me/5491155555555?text=Hola");
  });

  it("codifica el mensaje correctamente", () => {
    const url = buildWhatsAppUrl("5491155555555", "Hola! ¿Cómo va?");
    expect(url).toContain(encodeURIComponent("Hola! ¿Cómo va?"));
  });
});

describe("buildProductInquiryMessage", () => {
  it("arma un mensaje con el nombre y la URL del producto", () => {
    const message = buildProductInquiryMessage(
      "Cuaderno Rivadavia A4",
      "https://libreriablanco.vercel.app/productos/cuaderno-rivadavia-a4",
    );
    expect(message).toContain("Cuaderno Rivadavia A4");
    expect(message).toContain("https://libreriablanco.vercel.app/productos/cuaderno-rivadavia-a4");
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `pnpm vitest run lib/shop/whatsapp.test.ts`
Expected: FAIL — `./whatsapp` no existe.

- [ ] **Step 7: Implementar `lib/shop/whatsapp.ts`**

```typescript
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildProductInquiryMessage(productName: string, productUrl: string): string {
  return `Hola! Quería consultar sobre "${productName}": ${productUrl}`;
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `pnpm vitest run lib/shop/whatsapp.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Escribir el test de `getSettings`**

```typescript
// lib/shop/settings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { getSettings } from "./settings";

describe("getSettings", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("devuelve la fila de settings", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1, hero_title: "Hola" }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    });

    const result = await getSettings();

    expect(result).toEqual({ id: 1, hero_title: "Hola" });
  });

  it("devuelve null y loguea si hay un error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    });

    const result = await getSettings();

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 10: Correr y verificar que falla**

Run: `pnpm vitest run lib/shop/settings.test.ts`
Expected: FAIL — `./settings` no existe.

- [ ] **Step 11: Implementar `lib/shop/settings.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type Settings = Database["public"]["Tables"]["settings"]["Row"];

export async function getSettings(): Promise<Settings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();

  if (error) {
    console.error("getSettings: error fetching settings", error);
    return null;
  }

  return data;
}
```

- [ ] **Step 12: Correr y verificar que pasa**

Run: `pnpm vitest run lib/shop/settings.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 13: Escribir el test de `attachPrimaryImages`**

```typescript
// lib/shop/products.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

import { attachPrimaryImages } from "./products";

describe("attachPrimaryImages", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("agrega imageUrl a cada producto según su imagen principal", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ product_id: "p1", url: "https://example.com/a.jpg" }],
      error: null,
    });
    const inFn = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ in: inFn }) });

    const result = await attachPrimaryImages(
      { from: mockFrom } as never,
      [{ id: "p1", name: "Producto 1" } as never, { id: "p2", name: "Producto 2" } as never],
    );

    expect(result[0]).toMatchObject({ id: "p1", imageUrl: "https://example.com/a.jpg" });
    expect(result[1]).toMatchObject({ id: "p2", imageUrl: null });
  });

  it("devuelve la lista con imageUrl null sin consultar la base si no hay productos", async () => {
    const result = await attachPrimaryImages({ from: mockFrom } as never, []);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 14: Correr y verificar que falla**

Run: `pnpm vitest run lib/shop/products.test.ts`
Expected: FAIL — `./products` no existe.

- [ ] **Step 15: Implementar `lib/shop/products.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type PublicProduct = Database["public"]["Views"]["public_products"]["Row"];

export interface ShopProduct extends PublicProduct {
  imageUrl: string | null;
}

export async function attachPrimaryImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  products: PublicProduct[],
): Promise<ShopProduct[]> {
  const ids = products.map((p) => p.id).filter((id): id is string => id !== null);

  if (ids.length === 0) {
    return products.map((p) => ({ ...p, imageUrl: null }));
  }

  const { data: images, error } = await supabase
    .from("product_images")
    .select("product_id, url")
    .in("product_id", ids)
    .eq("is_primary", true);

  if (error) {
    console.error("attachPrimaryImages: error fetching images", error);
  }

  const imageByProduct = new Map((images ?? []).map((img) => [img.product_id, img.url]));

  return products.map((p) => ({
    ...p,
    imageUrl: p.id ? (imageByProduct.get(p.id) ?? null) : null,
  }));
}
```

- [ ] **Step 16: Correr y verificar que pasa**

Run: `pnpm vitest run lib/shop/products.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 17: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 18: Commit**

```bash
git add lib/shop/settings.ts lib/shop/settings.test.ts lib/shop/whatsapp.ts lib/shop/whatsapp.test.ts lib/shop/products.ts lib/shop/products.test.ts lib/shop/sort.ts lib/shop/sort.test.ts
git commit -m "feat: helpers del portal público (settings, WhatsApp, imágenes, orden)"
```

---

### Task 3: Layout del portal (header, barra informativa, footer)

**Files:**
- Create: `components/shop/info-bar.tsx`
- Create: `components/shop/info-bar.test.tsx`
- Create: `components/shop/whatsapp-button.tsx`
- Create: `components/shop/whatsapp-button.test.tsx`
- Create: `components/shop/search-input.tsx`
- Create: `components/shop/search-input.test.tsx`
- Create: `components/shop/header.tsx`
- Create: `components/shop/footer.tsx`
- Create: `app/(shop)/layout.tsx`

**Interfaces:**
- Consumes: `getSettings`, `buildWhatsAppUrl` (Task 2).
- Produces: layout que envuelve todas las páginas de Tareas 4-7.

- [ ] **Step 1: Escribir el test de `InfoBar`**

```tsx
// components/shop/info-bar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoBar } from "./info-bar";

describe("InfoBar", () => {
  it("muestra el mensaje de retiro y WhatsApp cuando la tienda está habilitada", () => {
    render(<InfoBar storeEnabled={true} />);
    expect(screen.getByText(/Retirá gratis/i)).toBeInTheDocument();
  });

  it("muestra un aviso de mantenimiento cuando la tienda está deshabilitada", () => {
    render(<InfoBar storeEnabled={false} />);
    expect(screen.getByText(/mantenimiento/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm vitest run components/shop/info-bar.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `components/shop/info-bar.tsx`**

```tsx
interface InfoBarProps {
  storeEnabled: boolean;
}

export function InfoBar({ storeEnabled }: InfoBarProps) {
  if (!storeEnabled) {
    return (
      <div className="bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
        La tienda está en mantenimiento. Volvé a visitarnos pronto.
      </div>
    );
  }

  return (
    <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
      Retirá gratis por nuestro local · ¿Necesitás envío? Consultanos por WhatsApp
    </div>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm vitest run components/shop/info-bar.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Escribir el test de `WhatsAppButton`**

```tsx
// components/shop/whatsapp-button.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppButton } from "./whatsapp-button";

describe("WhatsAppButton", () => {
  it("no renderiza nada si no hay número de teléfono", () => {
    const { container } = render(<WhatsAppButton phoneNumber={null} message="Hola" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza un link a wa.me con el mensaje codificado", () => {
    render(<WhatsAppButton phoneNumber="5491155555555" message="Hola" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://wa.me/5491155555555?text=Hola");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `pnpm vitest run components/shop/whatsapp-button.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 7: Implementar `components/shop/whatsapp-button.tsx`**

```tsx
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";

interface WhatsAppButtonProps {
  phoneNumber: string | null;
  message: string;
  label?: string;
}

export function WhatsAppButton({ phoneNumber, message, label = "WhatsApp" }: WhatsAppButtonProps) {
  if (!phoneNumber) {
    return null;
  }

  return (
    <Button asChild variant="outline">
      <a href={buildWhatsAppUrl(phoneNumber, message)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-4" />
        {label}
      </a>
    </Button>
  );
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `pnpm vitest run components/shop/whatsapp-button.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Escribir el test de `SearchInput`**

```tsx
// components/shop/search-input.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

import { SearchInput } from "./search-input";

describe("SearchInput", () => {
  it("navega a /productos?q=<término> al enviar el formulario", async () => {
    const user = userEvent.setup();
    render(<SearchInput />);

    await user.type(screen.getByPlaceholderText(/Buscar/i), "cuaderno");
    await user.keyboard("{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/productos?q=cuaderno");
  });
});
```

- [ ] **Step 10: Correr y verificar que falla**

Run: `pnpm vitest run components/shop/search-input.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 11: Implementar `components/shop/search-input.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const q = formData.get("q");
    const params = new URLSearchParams(searchParams);
    if (typeof q === "string" && q.trim().length > 0) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    const query = params.toString();
    router.push(query ? `/productos?${query}` : "/productos");
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 flex-1">
      <Input
        name="q"
        type="search"
        placeholder="Buscar cuadernos, lápices, carpetas..."
        defaultValue={searchParams.get("q") ?? ""}
      />
    </form>
  );
}
```

- [ ] **Step 12: Correr y verificar que pasa**

Run: `pnpm vitest run components/shop/search-input.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 13: Implementar `components/shop/header.tsx` y `footer.tsx` (sin test propio — composición directa de piezas ya testeadas)**

```tsx
// components/shop/header.tsx
import Link from "next/link";
import { SearchInput } from "./search-input";
import { WhatsAppButton } from "./whatsapp-button";

interface HeaderProps {
  whatsappNumber: string | null;
  whatsappMessage: string | null;
}

export function Header({ whatsappNumber, whatsappMessage }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b p-4">
      <Link href="/" className="text-xl font-bold text-primary">
        Librería Blanco
      </Link>
      <SearchInput />
      <WhatsAppButton
        phoneNumber={whatsappNumber}
        message={whatsappMessage ?? "Hola! Quería hacer una consulta."}
      />
    </header>
  );
}
```

```tsx
// components/shop/footer.tsx
export function Footer() {
  return (
    <footer className="border-t p-6 text-center text-sm text-muted-foreground">
      <p>Retiro sin cargo en el local · Pago por transferencia · Mercado Pago próximamente</p>
      <p className="mt-2">{`© ${new Date().getFullYear()} Librería Blanco`}</p>
    </footer>
  );
}
```

- [ ] **Step 14: Implementar `app/(shop)/layout.tsx`**

```tsx
import { InfoBar } from "@/components/shop/info-bar";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { getSettings } from "@/lib/shop/settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <InfoBar storeEnabled={settings?.store_enabled ?? true} />
      <Header
        whatsappNumber={settings?.whatsapp_number ?? null}
        whatsappMessage={settings?.whatsapp_general_message ?? null}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

Nota: `app/page.tsx` (el placeholder de Fase 0) todavía NO se toca en
esta tarea — Next.js no tiene conflicto entre `app/page.tsx` y
`app/(shop)/layout.tsx` porque este último no define ninguna ruta por
sí solo. El placeholder se elimina recién en la Tarea 4, en el mismo
commit que crea `app/(shop)/page.tsx` como su reemplazo real — así
`/` nunca queda rota entre tareas.

- [ ] **Step 15: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 16: Commit**

```bash
git add components/shop/info-bar.tsx components/shop/info-bar.test.tsx components/shop/whatsapp-button.tsx components/shop/whatsapp-button.test.tsx components/shop/search-input.tsx components/shop/search-input.test.tsx components/shop/header.tsx components/shop/footer.tsx "app/(shop)/layout.tsx"
git commit -m "feat: layout del portal público (header, barra informativa, footer)"
```

---

### Task 4: Home (`app/(shop)/page.tsx`)

**Files:**
- Create: `components/shop/hero.tsx`
- Create: `components/shop/hero.test.tsx`
- Create: `components/shop/category-pill.tsx`
- Create: `components/shop/product-card.tsx`
- Create: `components/shop/product-card.test.tsx`
- Create: `app/(shop)/page.tsx`

**Interfaces:**
- Consumes: `getSettings`, `attachPrimaryImages` (Task 2).
- Produces: `ProductCard` (Client-free, reusado por Tareas 5, 6, 7).

- [ ] **Step 1: Escribir el test de `Hero`**

```tsx
// components/shop/hero.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("muestra el título y texto por defecto cuando settings no tiene datos", () => {
    render(<Hero title={null} text={null} ctaText={null} ctaLink={null} />);
    expect(screen.getByText("Todo para volver al cole")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/productos");
  });

  it("muestra el contenido de settings cuando existe", () => {
    render(<Hero title="Nuevos ingresos" text="Mirá lo último" ctaText="Ver novedades" ctaLink="/productos?orden=novedades" />);
    expect(screen.getByText("Nuevos ingresos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver novedades" })).toHaveAttribute("href", "/productos?orden=novedades");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm vitest run components/shop/hero.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `components/shop/hero.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeroProps {
  title: string | null;
  text: string | null;
  ctaText: string | null;
  ctaLink: string | null;
}

const DEFAULT_TITLE = "Todo para volver al cole";
const DEFAULT_TEXT = "Encontrá útiles, cuadernos y mucho más.";

export function Hero({ title, text, ctaText, ctaLink }: HeroProps) {
  return (
    <section className="flex flex-col items-center gap-4 bg-muted px-4 py-10 text-center">
      <h1 className="text-3xl font-bold">{title ?? DEFAULT_TITLE}</h1>
      <p className="text-muted-foreground">{text ?? DEFAULT_TEXT}</p>
      <Button asChild>
        <Link href={ctaLink ?? "/productos"}>{ctaText ?? "Ver productos"}</Link>
      </Button>
    </section>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm vitest run components/shop/hero.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Escribir el test de `ProductCard`**

```tsx
// components/shop/product-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "./product-card";
import type { ShopProduct } from "@/lib/shop/products";

const baseProduct: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1500,
  is_new: false,
  is_featured: false,
  imageUrl: null,
} as ShopProduct;

describe("ProductCard", () => {
  it("muestra el nombre y el precio real (no texto literal '${...}')", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("Cuaderno A4")).toBeInTheDocument();
    expect(screen.getByText("$1500")).toBeInTheDocument();
  });

  it("enlaza a /productos/[slug]", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/productos/cuaderno-a4");
  });

  it("muestra el badge Nuevo solo cuando is_new es true", () => {
    render(<ProductCard product={{ ...baseProduct, is_new: true }} />);
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("no muestra ningún badge cuando is_new e is_featured son false", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
    expect(screen.queryByText("Destacado")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `pnpm vitest run components/shop/product-card.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 7: Implementar `components/shop/product-card.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ShopProduct } from "@/lib/shop/products";

interface ProductCardProps {
  product: ShopProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/productos/${product.slug}`}
      className="flex flex-col gap-2 rounded-lg border p-3 transition hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden rounded bg-muted">
        {product.imageUrl && (
          <Image src={product.imageUrl} alt={product.name ?? ""} fill className="object-cover" />
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {product.is_new && <Badge>Nuevo</Badge>}
          {product.is_featured && <Badge variant="secondary">Destacado</Badge>}
        </div>
      </div>
      <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
      <p className="text-lg font-semibold text-primary">{`$${product.price}`}</p>
    </Link>
  );
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `pnpm vitest run components/shop/product-card.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 9: Implementar `components/shop/category-pill.tsx` (sin test propio — es un `<Link>` de una línea)**

```tsx
import Link from "next/link";

interface CategoryPillProps {
  name: string;
  slug: string;
}

export function CategoryPill({ name, slug }: CategoryPillProps) {
  return (
    <Link href={`/categoria/${slug}`} className="rounded-full border px-4 py-2 text-sm hover:bg-accent">
      {name}
    </Link>
  );
}
```

- [ ] **Step 10: Eliminar el placeholder de Fase 0 y crear `app/(shop)/page.tsx`**

Primero eliminar el placeholder (`app/page.tsx` competiría con
`app/(shop)/page.tsx` por la ruta `/` si ambos existen) y su test —
`app/page.test.tsx` (de Fase 0) importa `./page` y quedaría roto si
solo se borra uno de los dos:

```bash
git rm app/page.tsx app/page.test.tsx
```

Luego crear `app/(shop)/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/shop/settings";
import { attachPrimaryImages } from "@/lib/shop/products";
import { Hero } from "@/components/shop/hero";
import { CategoryPill } from "@/components/shop/category-pill";
import { ProductCard } from "@/components/shop/product-card";

export default async function HomePage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: categories }, { data: featured }, { data: news }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("display_order", { ascending: true })
      .limit(6),
    supabase
      .from("public_products")
      .select("*")
      .eq("is_featured", true)
      .order("featured_order", { ascending: true })
      .limit(8),
    supabase
      .from("public_products")
      .select("*")
      .eq("is_new", true)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const [featuredWithImages, newsWithImages] = await Promise.all([
    attachPrimaryImages(supabase, featured ?? []),
    attachPrimaryImages(supabase, news ?? []),
  ]);

  return (
    <div className="flex flex-col gap-10 pb-10">
      <Hero
        title={settings?.hero_title ?? null}
        text={settings?.hero_text ?? null}
        ctaText={settings?.hero_cta_text ?? null}
        ctaLink={settings?.hero_cta_link ?? null}
      />

      {categories && categories.length > 0 && (
        <section className="mx-auto flex w-full max-w-6xl flex-wrap justify-center gap-3 px-4">
          {categories.map((category) => (
            <CategoryPill key={category.id} name={category.name} slug={category.slug} />
          ))}
        </section>
      )}

      {featuredWithImages.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-semibold">Destacados</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featuredWithImages.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {newsWithImages.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-semibold">Novedades</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {newsWithImages.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Verificación manual en local**

Con `pnpm dev`, confirmar que `/` carga sin error (aunque no haya
categorías/productos destacados/novedades cargados todavía, cada
sección debe omitirse limpiamente, nunca mostrar un título sin
contenido).

- [ ] **Step 12: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 13: Commit**

```bash
git add components/shop/hero.tsx components/shop/hero.test.tsx components/shop/category-pill.tsx components/shop/product-card.tsx components/shop/product-card.test.tsx "app/(shop)/page.tsx"
git commit -m "feat: Home del portal público"
```

---

### Task 5: Catálogo (`/productos`)

**Files:**
- Create: `components/shop/product-filters.tsx`
- Create: `components/shop/product-filters.test.tsx`
- Create: `app/(shop)/productos/page.tsx`

**Interfaces:**
- Consumes: `attachPrimaryImages`, `resolveSortOption` (Task 2), `ProductCard` (Task 4).

- [ ] **Step 1: Escribir el test de `ProductFilters`**

```tsx
// components/shop/product-filters.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/productos",
  useSearchParams: () => mockSearchParams,
}));

import { ProductFilters } from "./product-filters";

describe("ProductFilters", () => {
  it("muestra las categorías recibidas como opciones", async () => {
    const user = userEvent.setup();
    render(<ProductFilters categories={[{ slug: "escolar", name: "Escolar" }]} />);

    await user.click(screen.getByRole("combobox", { name: /categoría/i }));

    expect(await screen.findByText("Escolar")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm vitest run components/shop/product-filters.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `components/shop/product-filters.tsx`**

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryOption {
  slug: string;
  name: string;
}

interface ProductFiltersProps {
  categories: CategoryOption[];
}

export function ProductFilters({ categories }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams);
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <Select
        value={searchParams.get("categoria") ?? "todas"}
        onValueChange={(value) => updateParam("categoria", value, "todas")}
      >
        <SelectTrigger className="w-48" aria-label="Categoría">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las categorías</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.slug} value={category.slug}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("orden") ?? "relevancia"}
        onValueChange={(value) => updateParam("orden", value, "relevancia")}
      >
        <SelectTrigger className="w-48" aria-label="Ordenar por">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="relevancia">Más recientes</SelectItem>
          <SelectItem value="precio_asc">Precio: menor a mayor</SelectItem>
          <SelectItem value="precio_desc">Precio: mayor a menor</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm vitest run components/shop/product-filters.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Implementar `app/(shop)/productos/page.tsx`**

```tsx
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages } from "@/lib/shop/products";
import { resolveSortOption } from "@/lib/shop/sort";
import { ProductCard } from "@/components/shop/product-card";
import { ProductFilters } from "@/components/shop/product-filters";

interface ProductsPageProps {
  searchParams: Promise<{ q?: string; categoria?: string; orden?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { q, categoria, orden } = await searchParams;
  const sort = resolveSortOption(orden);

  const supabase = await createClient();

  const { data: allCategories } = await supabase
    .from("categories")
    .select("slug, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  let categoryId: string | null = null;
  if (categoria) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categoria)
      .eq("is_active", true)
      .maybeSingle();
    categoryId = category?.id ?? null;
  }

  let query = supabase.from("public_products").select("*");

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }
  if (sort === "precio_asc") {
    query = query.order("price", { ascending: true });
  } else if (sort === "precio_desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: products, error } = await query;

  if (error) {
    console.error("ProductsPage: error fetching products", error);
  }

  const productsWithImages = await attachPrimaryImages(supabase, products ?? []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Productos</h1>
      <Suspense>
        <ProductFilters categories={allCategories ?? []} />
      </Suspense>
      {productsWithImages.length === 0 ? (
        <p className="text-muted-foreground">No encontramos productos con esa búsqueda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {productsWithImages.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verificación manual en local**

Con `pnpm dev` y al menos un producto publicado cargado desde el admin
(ver Tarea 8 para el flujo completo si no hay ninguno todavía):
confirmar `/productos`, buscar por nombre, filtrar por categoría,
ordenar por precio.

- [ ] **Step 7: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add components/shop/product-filters.tsx components/shop/product-filters.test.tsx "app/(shop)/productos/page.tsx"
git commit -m "feat: catálogo público con búsqueda, filtro por categoría y orden"
```

---

### Task 6: Página de categoría (`/categoria/[slug]`)

**Files:**
- Create: `app/(shop)/categoria/[slug]/page.tsx`

**Interfaces:**
- Consumes: `attachPrimaryImages` (Task 2), `ProductCard` (Task 4).

- [ ] **Step 1: Implementar `app/(shop)/categoria/[slug]/page.tsx`**

Sin test unitario propio — es una composición de piezas ya testeadas
(`ProductCard`, `attachPrimaryImages`) con una sola pieza de lógica
propia (la resolución de categoría + 404), cubierta por la
verificación manual del Step 2.

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages } from "@/lib/shop/products";
import { ProductCard } from "@/components/shop/product-card";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

// cache() deduplica la consulta dentro del mismo request: generateMetadata
// y el componente de página llaman a getCategory con el mismo slug, y sin
// esto correrían la misma query dos veces.
const getCategory = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id, name")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return category;
});

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  return {
    title: category ? `${category.name} — Librería Blanco` : "Categoría no encontrada — Librería Blanco",
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    notFound();
  }

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("public_products")
    .select("*")
    .eq("category_id", category.id)
    .order("created_at", { ascending: false });

  const productsWithImages = await attachPrimaryImages(supabase, products ?? []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{category.name}</h1>
      {productsWithImages.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay productos en esta categoría.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {productsWithImages.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificación manual en local**

Con `pnpm dev`: navegar a `/categoria/<slug-real>` y confirmar la
lista; navegar a `/categoria/no-existe` y confirmar la página 404 de
Next.js (no un error crudo).

- [ ] **Step 3: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "app/(shop)/categoria/[slug]/page.tsx"
git commit -m "feat: página pública de categoría"
```

---

### Task 7: Ficha de producto (`/productos/[slug]`)

**Files:**
- Create: `components/shop/product-gallery.tsx`
- Create: `components/shop/product-gallery.test.tsx`
- Create: `app/(shop)/productos/[slug]/page.tsx`

**Interfaces:**
- Consumes: `attachPrimaryImages`, `buildWhatsAppUrl`, `buildProductInquiryMessage`, `getSettings` (Task 2), `ProductCard` (Task 4).

- [ ] **Step 1: Escribir el test de `ProductGallery`**

```tsx
// components/shop/product-gallery.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductGallery } from "./product-gallery";

describe("ProductGallery", () => {
  it("muestra un placeholder si no hay imágenes", () => {
    const { container } = render(<ProductGallery images={[]} alt="Producto" />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("muestra la primera imagen como principal y permite cambiarla con las miniaturas", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        images={["https://example.com/a.jpg", "https://example.com/b.jpg"]}
        alt="Producto"
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("src", expect.stringContaining("example.com"));

    const thumbnails = screen.getAllByRole("button");
    await user.click(thumbnails[1]!);

    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", expect.stringContaining("example.com"));
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm vitest run components/shop/product-gallery.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `components/shop/product-gallery.tsx`**

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-square rounded bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded bg-muted">
        <Image src={images[selected]!} alt={alt} fill className="object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setSelected(index)}
              className={`relative size-16 overflow-hidden rounded border ${
                index === selected ? "border-primary" : "border-transparent"
              }`}
            >
              <Image src={url} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm vitest run components/shop/product-gallery.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Implementar `app/(shop)/productos/[slug]/page.tsx`**

```tsx
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages } from "@/lib/shop/products";
import { buildWhatsAppUrl, buildProductInquiryMessage } from "@/lib/shop/whatsapp";
import { getSettings } from "@/lib/shop/settings";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

// cache() deduplica la consulta dentro del mismo request — ver la nota
// equivalente en la página de categoría (Tarea 6).
const getProduct = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("public_products").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Producto no encontrado — Librería Blanco" };
  }

  return {
    title: `${product.name} — Librería Blanco`,
    description: product.short_description ?? undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product || !product.id) {
    notFound();
  }

  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: images }, { data: related }] = await Promise.all([
    supabase
      .from("product_images")
      .select("url")
      .eq("product_id", product.id)
      .order("position", { ascending: true }),
    product.category_id
      ? supabase
          .from("public_products")
          .select("*")
          .eq("category_id", product.category_id)
          .neq("id", product.id)
          .limit(4)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const relatedWithImages = await attachPrimaryImages(supabase, related ?? []);

  const productUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/productos/${slug}`;
  const whatsappMessage = buildProductInquiryMessage(product.name ?? "este producto", productUrl);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={(images ?? []).map((img) => img.url)} alt={product.name ?? ""} />
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-2xl font-bold text-primary">{`$${product.price}`}</p>
          <p className={product.available ? "text-green-600" : "text-destructive"}>
            {product.available ? "Disponible" : "No disponible"}
          </p>
          {product.full_description && (
            <p className="text-muted-foreground">{product.full_description}</p>
          )}
          {settings?.whatsapp_number && (
            <Button asChild>
              <a
                href={buildWhatsAppUrl(settings.whatsapp_number, whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Consultar por WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>

      {relatedWithImages.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">También te puede interesar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedWithImages.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

Notar que `public_products` (Fase 1a) ya filtra
`is_published = true and available = true` en su propia definición —
un producto despublicado o no disponible simplemente no aparece en la
consulta por `slug`, y `!product` dispara `notFound()` automáticamente.
No hace falta un chequeo adicional de visibilidad en esta página.

- [ ] **Step 6: Verificación manual en local**

Con `pnpm dev`: entrar a la ficha de un producto real (cargado desde
el admin, con al menos una imagen), confirmar galería, disponibilidad,
descripción, y que el botón de WhatsApp abre con el mensaje esperado
(nombre del producto + URL). Entrar a `/productos/no-existe` y
confirmar 404. Despublicar el producto desde el admin y confirmar que
su ficha pasa a dar 404 también.

- [ ] **Step 7: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add components/shop/product-gallery.tsx components/shop/product-gallery.test.tsx "app/(shop)/productos/[slug]/page.tsx"
git commit -m "feat: ficha de producto pública con galería, WhatsApp y relacionados"
```

---

### Task 8: Sync a producción y verificación manual end-to-end

**Files:** ninguno nuevo — tarea de despliegue y verificación.

- [ ] **Step 1: Correr la suite completa localmente**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm exec next build`
Expected: todo verde, build sin errores.

- [ ] **Step 2: Push de la migración de slug al proyecto real**

Run: `supabase db push`
Expected: aplica la migración de Task 1 (columna `slug` + vista
actualizada) contra el proyecto de producción.

- [ ] **Step 3: Regenerar tipos contra producción**

Run: `supabase gen types typescript --linked > types/supabase.ts`

Expected: el único cambio real debería ser la columna `slug` en
`products` y `public_products`; si aparece ruido de formato/metadata
del CLI sin relación (ya visto en Fase 2 — un BOM o un bloque
`__InternalSupabase`), descartar esa parte del diff y dejar el resto.

- [ ] **Step 4: Cargar datos de prueba reales desde el admin**

Con sesión de administradora real contra producción: crear al menos
una categoría destacada y 2-3 productos (marcando alguno como
destacado, alguno como novedad, con al menos una imagen cada uno) —
sin esto, la verificación del Step 6 no tiene nada real que mostrar.

- [ ] **Step 5: Deploy a Vercel**

Verificar que el push a `nueva-ui`/`main` dispara el deploy (mismo
flujo que fases anteriores). Confirmar con las herramientas de Vercel
que el deployment queda en estado `READY`.

- [ ] **Step 6: Verificación manual end-to-end en producción**

Contra `https://libreriablanco.vercel.app` (sin sesión — el portal es
público):

1. `/` muestra el hero, la categoría destacada y los productos
   cargados en el Step 4.
2. Buscar uno de los productos por nombre desde el header.
3. Entrar a su ficha, confirmar imagen, precio, descripción.
4. Click en "Consultar por WhatsApp" abre `wa.me` con el mensaje
   correcto (nombre del producto + URL).
5. Navegar a la categoría destacada y confirmar que lista el producto.
6. Confirmar que ningún paso muestra SKU, costo, margen o un error
   crudo de Supabase/Postgres.
7. Responsive en 360px/768px/1440px (spec maestra §101).

Si no hay acceso a un navegador real (Playwright u otro) en el momento
de cerrar esta fase, documentar explícitamente qué quedó verificado
por HTTP/código y qué queda pendiente de una verificación visual
manual — mismo criterio ya usado al cerrar la Fase 2.

- [ ] **Step 7: Limpiar cualquier archivo temporal de la verificación**

Confirmar `git status` limpio (sin contar archivos preexistentes no
relacionados con esta fase) antes de cerrar.
