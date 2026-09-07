# Fase 9 — Rediseño visual de la Home y componentes compartidos — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por
> tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Dar al portal público (Home y componentes compartidos:
`Hero`, `Header`, `InfoBar`, `CategoryPill`, `ProductCard`, `Footer`)
una estética más pulida y cercana a la referencia que compartió el
usuario, usando los datos reales del negocio que ya existen en
`settings` (`logo_url`, `hero_image_url`, `address`, `phone`,
`business_hours`) y 2 campos nuevos (`facebook_url`, `instagram_url`),
sin modificar ninguna funcionalidad existente de catálogo, carrito,
checkout o pedidos.

**Arquitectura:** Cada componente recibe los datos que necesita como
props desde donde ya se llama (`app/(shop)/layout.tsx` para `Header` y
`Footer`, `app/(shop)/page.tsx` para `Hero`) — mismo patrón ya usado en
Fase 8 para `address`/`businessHours` en checkout. Ningún componente
hace su propio fetch. Todo dato ausente (`null`) cae a un fallback ya
definido (texto en vez de imagen, sección oculta), nunca rompe el
render.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind
v4 + shadcn/ui, `lucide-react` (ya es dependencia del proyecto),
Supabase (Postgres + Storage), Zod, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-fase9-rediseno-visual-home-design.md`

## Global Constraints

- Ningún cambio de funcionalidad: catálogo, carrito, checkout,
  pedidos, admin (salvo el formulario de Configuración) quedan
  exactamente igual.
- Todo dato nuevo que se renderiza (`logo_url`, `hero_image_url`,
  `facebook_url`, `instagram_url`) es `nullable` y tiene un fallback
  explícito cuando es `null` — nunca un componente roto por falta de
  contenido.
- El grid de productos a 2 columnas en mobile (fijado en Fase 8) no se
  toca.
- No se agrega badge de "Oferta" ni precio tachado (fuera de alcance,
  requeriría modelo de datos de descuentos).
- `CategoryPill` sigue alimentándose 100% de la tabla `categories`
  real — el ícono es genérico para todas las categorías, no hay campo
  de ícono por categoría en el esquema y no se agrega uno.
- Toda migración nueva sigue el flujo ya usado en Fase 6:
  `supabase migration new <nombre>`, contenido SQL, `supabase db
  reset` en local si Docker está disponible, aplicar a producción
  (`supabase db push`) recién en la última tarea, con confirmación
  explícita del usuario antes de tocar producción.
- Los campos nuevos de `settings` siguen exactamente el patrón ya
  usado por todos los campos existentes: `optionalText` en
  `lib/validations/settings.ts`, mapeo camelCase↔snake_case en
  `parseSettingsForm`/`toRow` de `app/admin/(protected)/configuracion/actions.ts`.
- Los íconos usan `lucide-react` (ya instalado, usado por los
  componentes `shadcn/ui` del proyecto) — no se agrega ninguna
  dependencia nueva.
- Toda interpolación de `$` en JSX usa un template literal real, nunca
  `${valor}` como texto JSX plano (mismo criterio que Fase 6/8).

---

### Task 1: Migración — columnas de redes sociales en `settings`

**Files:**
- Create: migración vía `supabase migration new settings_redes_sociales`
- Modify: `types/supabase.ts` (agrega `facebook_url`/`instagram_url` a `Row`/`Insert`/`Update` de `settings`, en orden alfabético junto al resto de las columnas)

- [ ] **Step 1: Crear la migración**

Run: `supabase migration new settings_redes_sociales`

- [ ] **Step 2: Escribir el contenido de la migración**

```sql
alter table public.settings
  add column facebook_url text,
  add column instagram_url text;
```

- [ ] **Step 3: Aplicar en local (si Docker está disponible) y verificar**

Run: `supabase db reset`
Expected: corre sin error junto con todas las migraciones anteriores.

Si Docker no está disponible en el entorno, documentarlo y aplicar
directamente contra producción recién en la Tarea 9, con confirmación
explícita del usuario antes de pushear (mismo criterio ya usado en
Fase 6 y Fase 8).

- [ ] **Step 4: Actualizar `types/supabase.ts`**

En la definición de la tabla `settings` (bloque `Row`, `Insert` y
`Update`), agregar `facebook_url` e `instagram_url` respetando el
orden alfabético ya usado por el resto de las columnas:

En `Row` (después de `email`, antes de `hero_cta_link`, y después de
`id`, antes de `legal_name`):

```ts
          email: string | null
          facebook_url: string | null
          hero_cta_link: string | null
          hero_cta_text: string | null
          hero_image_url: string | null
          hero_text: string | null
          hero_title: string | null
          id: number
          instagram_url: string | null
          legal_name: string | null
```

Aplicar el mismo agregado (con `?:` en vez de `:`) en los bloques
`Insert` y `Update` de la misma tabla.

- [ ] **Step 5: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations types/supabase.ts
git commit -m "feat: columnas facebook_url e instagram_url en settings"
```

---

### Task 2: Campos de redes sociales en `/admin/configuracion`

**Files:**
- Modify: `lib/validations/settings.ts`
- Modify: `lib/validations/settings.test.ts`
- Modify: `components/admin/settings-form.tsx`
- Modify: `app/admin/(protected)/configuracion/actions.ts`
- Modify: `app/admin/(protected)/configuracion/actions.test.ts`

**Interfaces:**
- Consume: columnas `facebook_url`/`instagram_url` de `settings` (Task 1).
- Produce: `settingsSchema` con `facebookUrl`/`instagramUrl` (`optionalText`), que `Footer` (Task 8) recibirá vía `getSettings()`.

- [ ] **Step 1: Agregar los campos al schema de Zod**

En `lib/validations/settings.ts`, agregar dos campos al objeto
`settingsSchema`, después de `email`:

```ts
export const settingsSchema = z.object({
  businessName: optionalText,
  address: optionalText,
  businessHours: optionalText,
  phone: optionalText,
  email: optionalText,
  facebookUrl: optionalText,
  instagramUrl: optionalText,
  whatsappNumber: optionalText,
  whatsappGeneralMessage: optionalText,
  whatsappReceiptTemplate: optionalText,
  whatsappShippingInquiryTemplate: optionalText,
  transferAlias: optionalText,
  transferAccountHolder: optionalText,
  transferCbuCvu: optionalText,
  transferBankOrWallet: optionalText,
  transferInstructions: optionalText,
  storeEnabled: z.boolean(),
  heroTitle: optionalText,
  heroText: optionalText,
  heroCtaText: optionalText,
  heroCtaLink: optionalText,
  pickupInstructionsText: optionalText,
});
```

- [ ] **Step 2: Agregar el caso de test para los campos nuevos**

En `lib/validations/settings.test.ts`, agregar `facebookUrl` e
`instagramUrl` a `validInput`:

```ts
const validInput = {
  businessName: "Librería Blanco",
  address: "Av. Siempre Viva 123",
  businessHours: "Lun a Vie 9 a 18",
  phone: "1122334455",
  email: "hola@libreriablanco.com",
  facebookUrl: "https://facebook.com/libreriablanco",
  instagramUrl: "https://instagram.com/libreriablanco",
  whatsappNumber: "5491122334455",
  whatsappGeneralMessage: "Hola! Quería hacer una consulta.",
  whatsappReceiptTemplate: "Hola! Te paso el comprobante.",
  whatsappShippingInquiryTemplate: "Hola! Necesito que me envíen el pedido.",
  transferAlias: "libreria.blanco",
  transferAccountHolder: "Librería Blanco SRL",
  transferCbuCvu: "0000003100012345678901",
  transferBankOrWallet: "Banco Nación",
  transferInstructions: "Enviar el comprobante por WhatsApp.",
  storeEnabled: true,
  heroTitle: "Todo para volver al cole",
  heroText: "Encontrá útiles, cuadernos y mucho más.",
  heroCtaText: "Ver productos",
  heroCtaLink: "/productos",
  pickupInstructionsText: "Retirá tu pedido de lunes a sábado.",
};
```

Y agregar un nuevo `it` al final del `describe("settingsSchema", ...)`:

```ts
  it("acepta y convierte a null los campos de redes sociales", () => {
    const result = settingsSchema.safeParse({ ...validInput, facebookUrl: "", instagramUrl: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.facebookUrl).toBeNull();
      expect(result.data.instagramUrl).toBeNull();
    }
  });
```

- [ ] **Step 3: Correr el test de validación**

Run: `pnpm vitest run lib/validations/settings.test.ts`
Expected: PASS (5/5).

- [ ] **Step 4: Agregar los campos al formulario**

En `components/admin/settings-form.tsx`, dentro de la sección
`<h2 className="text-lg font-medium">Librería</h2>`, agregar 2 campos
nuevos después del bloque de `email` (línea 61 actual, antes del
cierre `</section>`):

```tsx
        <div className="flex flex-col gap-2">
          <Label htmlFor="facebookUrl">Facebook</Label>
          <Input id="facebookUrl" name="facebookUrl" defaultValue={settings?.facebook_url ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="instagramUrl">Instagram</Label>
          <Input id="instagramUrl" name="instagramUrl" defaultValue={settings?.instagram_url ?? ""} />
        </div>
```

- [ ] **Step 5: Agregar el mapeo en las Server Actions**

En `app/admin/(protected)/configuracion/actions.ts`, en
`parseSettingsForm`, agregar después de `email: getValue("email"),`:

```ts
    facebookUrl: getValue("facebookUrl"),
    instagramUrl: getValue("instagramUrl"),
```

Y en `toRow`, agregar después de `email: input.email,`:

```ts
    facebook_url: input.facebookUrl,
    instagram_url: input.instagramUrl,
```

- [ ] **Step 6: Agregar el caso de test para las Server Actions**

En `app/admin/(protected)/configuracion/actions.test.ts`, agregar un
nuevo `it` dentro de `describe("updateSettings", ...)`, después del
test "actualiza la fila de settings con los campos mapeados a
snake_case":

```ts
  it("mapea facebookUrl/instagramUrl a facebook_url/instagram_url", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    await updateSettings(
      { error: null },
      formData({
        facebookUrl: "https://facebook.com/libreriablanco",
        instagramUrl: "https://instagram.com/libreriablanco",
        storeEnabled: "on",
      }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        facebook_url: "https://facebook.com/libreriablanco",
        instagram_url: "https://instagram.com/libreriablanco",
      }),
    );
  });
```

- [ ] **Step 7: Correr los tests y verificar**

Run: `pnpm vitest run lib/validations/settings.test.ts "app/admin/(protected)/configuracion/actions.test.ts"`
Expected: PASS (5/5 y 5/5).

- [ ] **Step 8: Verificar tipos y build**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add lib/validations/settings.ts lib/validations/settings.test.ts components/admin/settings-form.tsx "app/admin/(protected)/configuracion/actions.ts" "app/admin/(protected)/configuracion/actions.test.ts"
git commit -m "feat: campos de Facebook e Instagram en Configuracion del negocio"
```

---

### Task 3: `Hero` — fondo real con `hero_image_url`

**Files:**
- Modify: `components/shop/hero.tsx`
- Modify: `components/shop/hero.test.tsx`
- Modify: `app/(shop)/page.tsx`

**Interfaces:**
- Produce: `HeroProps` gana `imageUrl: string | null`.
- Consume (en `page.tsx`): `settings?.hero_image_url ?? null`.

- [ ] **Step 1: Escribir los tests nuevos/actualizados**

Reemplazar el contenido completo de `components/shop/hero.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("muestra el título y texto por defecto cuando settings no tiene datos", () => {
    render(<Hero title={null} text={null} ctaText={null} ctaLink={null} imageUrl={null} />);
    expect(screen.getByText("Todo para volver al cole")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/productos");
  });

  it("muestra el contenido de settings cuando existe", () => {
    render(
      <Hero
        title="Nuevos ingresos"
        text="Mirá lo último"
        ctaText="Ver novedades"
        ctaLink="/productos?orden=novedades"
        imageUrl={null}
      />,
    );
    expect(screen.getByText("Nuevos ingresos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver novedades" })).toHaveAttribute("href", "/productos?orden=novedades");
  });

  it("no renderiza ninguna imagen de fondo cuando hero_image_url es null", () => {
    const { container } = render(<Hero title={null} text={null} ctaText={null} ctaLink={null} imageUrl={null} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("usa hero_image_url como fondo con overlay cuando está configurada", () => {
    const { container } = render(
      <Hero title={null} text={null} ctaText={null} ctaLink={null} imageUrl="https://example.com/hero-banner.png" />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("hero-banner.png"));
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm vitest run components/shop/hero.test.tsx`
Expected: FAIL — `Hero` todavía no acepta la prop `imageUrl`.

- [ ] **Step 3: Implementar el fondo con overlay**

Reemplazar el contenido completo de `components/shop/hero.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeroProps {
  title: string | null;
  text: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  imageUrl: string | null;
}

const DEFAULT_TITLE = "Todo para volver al cole";
const DEFAULT_TEXT = "Encontrá útiles, cuadernos y mucho más.";

export function Hero({ title, text, ctaText, ctaLink, imageUrl }: HeroProps) {
  return (
    <section className="relative flex flex-col items-center gap-4 overflow-hidden bg-muted px-4 py-16 text-center">
      {imageUrl && (
        <>
          <Image src={imageUrl} alt="" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <h1 className={`relative text-3xl font-bold ${imageUrl ? "text-white" : ""}`}>{title ?? DEFAULT_TITLE}</h1>
      <p className={`relative ${imageUrl ? "text-white/90" : "text-muted-foreground"}`}>{text ?? DEFAULT_TEXT}</p>
      <Button asChild className="relative">
        <Link href={ctaLink ?? "/productos"}>{ctaText ?? "Ver productos"}</Link>
      </Button>
    </section>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm vitest run components/shop/hero.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 5: Pasar `hero_image_url` desde la Home**

En `app/(shop)/page.tsx`, modificar el uso de `<Hero>`:

```tsx
      <Hero
        title={settings?.hero_title ?? null}
        text={settings?.hero_text ?? null}
        ctaText={settings?.hero_cta_text ?? null}
        ctaLink={settings?.hero_cta_link ?? null}
        imageUrl={settings?.hero_image_url ?? null}
      />
```

- [ ] **Step 6: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/shop/hero.tsx components/shop/hero.test.tsx "app/(shop)/page.tsx"
git commit -m "feat: Hero usa hero_image_url como fondo con overlay"
```

---

### Task 4: `Header` — logo real con fallback a texto

**Files:**
- Modify: `components/shop/header.tsx`
- Create: `components/shop/header.test.tsx`
- Modify: `app/(shop)/layout.tsx`

**Interfaces:**
- Produce: `HeaderProps` gana `logoUrl: string | null`.
- Consume (en `layout.tsx`): `settings?.logo_url ?? null`.

- [ ] **Step 1: Escribir el test nuevo**

Crear `components/shop/header.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: [],
    count: 0,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }),
}));

import { Header } from "./header";

describe("Header", () => {
  it("muestra el texto 'Librería Blanco' cuando no hay logo cargado", () => {
    render(<Header whatsappNumber={null} whatsappMessage={null} logoUrl={null} />);
    expect(screen.getByRole("link", { name: "Librería Blanco" })).toBeInTheDocument();
  });

  it("muestra la imagen del logo cuando settings.logo_url está cargado", () => {
    render(<Header whatsappNumber={null} whatsappMessage={null} logoUrl="https://example.com/logo.png" />);
    expect(screen.getByRole("img", { name: "Librería Blanco" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/shop/header.test.tsx`
Expected: FAIL — `Header` todavía no acepta la prop `logoUrl`.

- [ ] **Step 3: Implementar el logo con fallback**

Reemplazar el contenido completo de `components/shop/header.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { SearchInput } from "./search-input";
import { WhatsAppButton } from "./whatsapp-button";
import { CartLink } from "./cart-link";

interface HeaderProps {
  whatsappNumber: string | null;
  whatsappMessage: string | null;
  logoUrl: string | null;
}

export function Header({ whatsappNumber, whatsappMessage, logoUrl }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b p-4">
      <Link href="/" className="flex items-center text-xl font-bold text-primary">
        {logoUrl ? (
          <Image src={logoUrl} alt="Librería Blanco" width={40} height={40} className="h-10 w-auto" />
        ) : (
          "Librería Blanco"
        )}
      </Link>
      <SearchInput />
      <WhatsAppButton
        phoneNumber={whatsappNumber}
        message={whatsappMessage ?? "Hola! Quería hacer una consulta."}
      />
      <CartLink />
    </header>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/shop/header.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Pasar `logo_url` desde el layout del shop**

En `app/(shop)/layout.tsx`, modificar el uso de `<Header>`:

```tsx
        <Header
          whatsappNumber={settings?.whatsapp_number ?? null}
          whatsappMessage={settings?.whatsapp_general_message ?? null}
          logoUrl={settings?.logo_url ?? null}
        />
```

- [ ] **Step 6: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/shop/header.tsx components/shop/header.test.tsx "app/(shop)/layout.tsx"
git commit -m "feat: Header muestra el logo real (logo_url) con fallback a texto"
```

---

### Task 5: `InfoBar` — 3 columnas con ícono

**Files:**
- Modify: `components/shop/info-bar.tsx`
- Modify: `components/shop/info-bar.test.tsx`

- [ ] **Step 1: Actualizar el test**

Reemplazar el contenido completo de `components/shop/info-bar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoBar } from "./info-bar";

describe("InfoBar", () => {
  it("muestra las 3 columnas de información cuando la tienda está habilitada", () => {
    render(<InfoBar storeEnabled={true} />);
    expect(screen.getByText(/Retirá gratis/i)).toBeInTheDocument();
    expect(screen.getByText(/Pago por transferencia/i)).toBeInTheDocument();
    expect(screen.getByText(/Consultanos por WhatsApp/i)).toBeInTheDocument();
  });

  it("muestra un aviso de mantenimiento cuando la tienda está deshabilitada", () => {
    render(<InfoBar storeEnabled={false} />);
    expect(screen.getByText(/mantenimiento/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/shop/info-bar.test.tsx`
Expected: FAIL — todavía no existen las 3 columnas separadas.

- [ ] **Step 3: Implementar las 3 columnas**

Reemplazar el contenido completo de `components/shop/info-bar.tsx`:

```tsx
import { Banknote, MessageCircle, Truck } from "lucide-react";

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
    <div className="grid grid-cols-1 gap-2 bg-primary px-4 py-3 text-center text-sm text-primary-foreground sm:grid-cols-3">
      <div className="flex items-center justify-center gap-2">
        <Truck className="h-4 w-4" aria-hidden="true" />
        <span>Retirá gratis por nuestro local</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Banknote className="h-4 w-4" aria-hidden="true" />
        <span>Pago por transferencia</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span>¿Necesitás envío? Consultanos por WhatsApp</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/shop/info-bar.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add components/shop/info-bar.tsx components/shop/info-bar.test.tsx
git commit -m "feat: InfoBar en 3 columnas con icono (envio, transferencia, whatsapp)"
```

---

### Task 6: `CategoryPill` — card con ícono

**Files:**
- Modify: `components/shop/category-pill.tsx`
- Create: `components/shop/category-pill.test.tsx`

- [ ] **Step 1: Escribir el test nuevo**

Crear `components/shop/category-pill.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryPill } from "./category-pill";

describe("CategoryPill", () => {
  it("enlaza a /categoria/[slug] y muestra el nombre de la categoría", () => {
    render(<CategoryPill name="Cuadernos" slug="cuadernos" />);
    const link = screen.getByRole("link", { name: /Cuadernos/i });
    expect(link).toHaveAttribute("href", "/categoria/cuadernos");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/shop/category-pill.test.tsx`
Expected: FAIL — el archivo `category-pill.tsx` sin cambios ya cumple el link, así que este paso puede pasar directo a PASS; si pasa ya en este punto, continuar igual con el Step 3 (el objetivo del task es el ícono, no el link).

- [ ] **Step 3: Implementar la card con ícono**

Reemplazar el contenido completo de `components/shop/category-pill.tsx`:

```tsx
import Link from "next/link";
import { Package } from "lucide-react";

interface CategoryPillProps {
  name: string;
  slug: string;
}

export function CategoryPill({ name, slug }: CategoryPillProps) {
  return (
    <Link
      href={`/categoria/${slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition hover:bg-accent hover:shadow-md"
    >
      <Package className="h-6 w-6 text-primary" aria-hidden="true" />
      {name}
    </Link>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/shop/category-pill.test.tsx`
Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add components/shop/category-pill.tsx components/shop/category-pill.test.tsx
git commit -m "feat: CategoryPill como card con icono"
```

---

### Task 7: `ProductCard` — pulido visual

**Files:**
- Modify: `components/shop/product-card.tsx`

No requiere cambios de test: es un cambio de solo clases Tailwind, sin
lógica nueva; `components/shop/product-card.test.tsx` ya cubre nombre,
precio, link, badges y disponibilidad por contenido/rol, no por clase
CSS, así que sigue pasando sin modificaciones.

- [ ] **Step 1: Aplicar el pulido visual**

En `components/shop/product-card.tsx`, dos cambios de clases:

```tsx
    <div className="flex flex-col gap-2 rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md">
```

(reemplaza `className="flex flex-col gap-2 rounded-lg border p-3 transition hover:shadow-md"`)

```tsx
        <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
```

(reemplaza `className="text-lg font-semibold text-primary"`)

- [ ] **Step 2: Correr el test y verificar que sigue pasando**

Run: `pnpm vitest run components/shop/product-card.test.tsx`
Expected: PASS (6/6), sin cambios respecto a antes de este task.

- [ ] **Step 3: Commit**

```bash
git add components/shop/product-card.tsx
git commit -m "feat: pulido visual de ProductCard (sombra y precio en negrita)"
```

---

### Task 8: `Footer` — footer completo con contacto y redes sociales

**Files:**
- Modify: `components/shop/footer.tsx`
- Create: `components/shop/footer.test.tsx`
- Modify: `app/(shop)/layout.tsx`

**Interfaces:**
- Consume: columnas `facebook_url`/`instagram_url` de `settings` (Task 1).
- Produce: `FooterProps { settings: { businessName, address, phone, businessHours, facebookUrl, instagramUrl } }` (todos `string | null`).

- [ ] **Step 1: Escribir el test nuevo**

Crear `components/shop/footer.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./footer";

const baseSettings = {
  businessName: null,
  address: null,
  phone: null,
  businessHours: null,
  facebookUrl: null,
  instagramUrl: null,
};

describe("Footer", () => {
  it("muestra 'Librería Blanco' por defecto cuando no hay nombre configurado", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.getByText("Librería Blanco")).toBeInTheDocument();
  });

  it("muestra el nombre del negocio cuando está configurado", () => {
    render(<Footer settings={{ ...baseSettings, businessName: "Librería Blanco S.R.L." }} />);
    expect(screen.getByText("Librería Blanco S.R.L.")).toBeInTheDocument();
  });

  it("no muestra dirección/horario/teléfono cuando no están cargados", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.queryByText("Murguiondo 123")).not.toBeInTheDocument();
  });

  it("muestra dirección, horario y teléfono cuando están cargados", () => {
    render(
      <Footer
        settings={{
          ...baseSettings,
          address: "Murguiondo 123",
          businessHours: "Lun a Vie 9 a 18hs",
          phone: "1122334455",
        }}
      />,
    );
    expect(screen.getByText("Murguiondo 123")).toBeInTheDocument();
    expect(screen.getByText("Lun a Vie 9 a 18hs")).toBeInTheDocument();
    expect(screen.getByText("1122334455")).toBeInTheDocument();
  });

  it("no muestra iconos de redes sociales cuando no están cargados", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.queryByLabelText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Instagram")).not.toBeInTheDocument();
  });

  it("muestra iconos de redes sociales cuando están cargados", () => {
    render(
      <Footer
        settings={{
          ...baseSettings,
          facebookUrl: "https://facebook.com/libreriablanco",
          instagramUrl: "https://instagram.com/libreriablanco",
        }}
      />,
    );
    expect(screen.getByLabelText("Facebook")).toHaveAttribute("href", "https://facebook.com/libreriablanco");
    expect(screen.getByLabelText("Instagram")).toHaveAttribute("href", "https://instagram.com/libreriablanco");
  });

  it("muestra el copyright y la navegación a productos/carrito", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Librería Blanco`))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute("href", "/productos");
    expect(screen.getByRole("link", { name: "Carrito" })).toHaveAttribute("href", "/carrito");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/shop/footer.test.tsx`
Expected: FAIL — `Footer` todavía no acepta props.

- [ ] **Step 3: Implementar el footer completo**

Reemplazar el contenido completo de `components/shop/footer.tsx`:

```tsx
import Link from "next/link";
import { Facebook, Instagram } from "lucide-react";

interface FooterSettings {
  businessName: string | null;
  address: string | null;
  phone: string | null;
  businessHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}

interface FooterProps {
  settings: FooterSettings;
}

export function Footer({ settings }: FooterProps) {
  const { businessName, address, phone, businessHours, facebookUrl, instagramUrl } = settings;
  const hasSocialLinks = Boolean(facebookUrl || instagramUrl);

  return (
    <footer className="border-t p-6 text-sm text-muted-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 text-center md:grid-cols-3 md:text-left">
        <div>
          <p className="font-semibold text-foreground">{businessName ?? "Librería Blanco"}</p>
          <p className="mt-2">Retiro sin cargo en el local · Pago por transferencia · Mercado Pago próximamente</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-foreground">Navegación</p>
          <Link href="/productos" className="hover:underline">
            Productos
          </Link>
          <Link href="/carrito" className="hover:underline">
            Carrito
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-foreground">Contacto</p>
          {address && <p>{address}</p>}
          {businessHours && <p>{businessHours}</p>}
          {phone && <p>{phone}</p>}
          {hasSocialLinks && (
            <div className="mt-1 flex justify-center gap-3 md:justify-start">
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mt-6 text-center">{`© ${new Date().getFullYear()} Librería Blanco`}</p>
    </footer>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/shop/footer.test.tsx`
Expected: PASS (7/7).

- [ ] **Step 5: Pasar `settings` desde el layout del shop**

En `app/(shop)/layout.tsx`, modificar el uso de `<Footer>`:

```tsx
        <Footer
          settings={{
            businessName: settings?.business_name ?? null,
            address: settings?.address ?? null,
            phone: settings?.phone ?? null,
            businessHours: settings?.business_hours ?? null,
            facebookUrl: settings?.facebook_url ?? null,
            instagramUrl: settings?.instagram_url ?? null,
          }}
        />
```

- [ ] **Step 6: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/shop/footer.tsx components/shop/footer.test.tsx "app/(shop)/layout.tsx"
git commit -m "feat: Footer completo con navegacion, contacto y redes sociales"
```

---

### Task 9: Verificación local, sincronización a producción y carga de contenido real

**Files:** ninguno (tarea de verificación y de contenido, no de código).

- [ ] **Step 1: Verificación local completa**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: los cuatro comandos terminan sin errores.

- [ ] **Step 2: Confirmar con el usuario antes de tocar producción**

Esta fase sí tiene una migración nueva (Task 1). Antes de pushear:

```bash
supabase db push
```

Preguntar explícitamente antes de correr `supabase db push` contra la
base de producción, y de nuevo antes de los pushes de código:

```bash
git push origin nueva-ui
git push origin nueva-ui:main
```

- [ ] **Step 3: Verificar el deploy**

Confirmar que el deployment de producción quedó en estado `READY` (vía
Vercel MCP) apuntando al commit del último push a `main`.

- [ ] **Step 4: Cargar el logo y el banner reales**

Con el código ya en producción, ir a `/admin/configuracion` y subir:
- El logo circular real (`brand-assets/logo.png`) en el campo de logo.
- El banner hero real (`brand-assets/hero-banner.png`) en el campo de
  imagen del hero.

Esto usa el flujo de carga de imágenes ya existente desde Fase 6
(`uploadLogo`/`uploadHeroImage` en `image-actions.ts`) — no requiere
código nuevo.

- [ ] **Step 5: Verificación interactiva**

Verificar manualmente contra producción (Playwright, desktop y 375px
de ancho):
- El logo real aparece en el header en vez del texto.
- El banner hero real aparece de fondo en la Home, con el título/texto/CTA
  legibles sobre el overlay oscuro.
- La barra informativa muestra las 3 columnas con ícono.
- Las categorías de la Home se ven como cards con ícono.
- El footer muestra navegación, contacto (si está cargado en
  Configuración) y, si se cargaron Facebook/Instagram, sus íconos con
  el link correcto.
- Ninguna pantalla de checkout, carrito, confirmación de compra o admin
  (fuera de Configuración) cambió de comportamiento.
