# Fase 8: Pulido de UI del Portal Público (mobile-first) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir 7 gaps de UI/UX del portal público encontrados en una auditoría contra la spec maestra, con prioridad mobile-first: buscador colapsado en mobile, badges cortados en las cards, dirección/horario ausentes en checkout y confirmación, mensaje de retiro/"continuar comprando"/subtotal faltantes en el carrito, mensaje de WhatsApp de envío sin itemizar productos, y sin opción de WhatsApp post-compra.

**Architecture:** Cambios acotados a `components/shop/`, `app/(shop)/` y `lib/shop/whatsapp.ts`. Sin cambios de esquema de base de datos ni de Server Actions — todos los datos nuevos a mostrar (`address`, `business_hours`, `whatsapp_general_message`) ya existen en la tabla `settings` desde Fase 6 y ya se leen hoy en otras páginas del portal (`app/(shop)/layout.tsx`).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-fase8-ui-portal-publico-design.md`

## Global Constraints

- No se toca el Admin en esta fase — solo `app/(shop)/` y `components/shop/`.
- No hay migraciones nuevas: `settings.address`, `settings.business_hours` y `settings.whatsapp_general_message` ya existen y ya se usan en otras páginas.
- Renderizado condicional para todo dato de `settings` que pueda no estar cargado (`{campo && <p>{campo}</p>}`) — nunca asumir que un campo de configuración tiene valor.
- La imagen en negro de "Cuaderno Rivadavia A4" (confirmado: PNG de 1×1 píxel de prueba, `product-images/fase3-verificacion/...`) **no se toca en este plan** — es una acción pendiente del negocio, no un bug de código.
- Mensajes en español, mismo tono ya usado en el resto del portal (corto, claro, humano — spec §103).
- Cambios de layout puramente CSS (Tailwind) no requieren test nuevo dedicado; cambios de comportamiento/contenido sí.

---

### Task 1: Buscador del header — mobile + accesibilidad

**Files:**
- Modify: `components/shop/search-input.tsx`
- Modify: `components/shop/search-input.test.tsx`

**Interfaces:** ninguna nueva — mismo componente `<SearchInput />` sin props.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `components/shop/search-input.test.tsx` (dentro del `describe("SearchInput")` existente):

```ts
it("tiene un aria-label accesible además del placeholder", () => {
  render(<SearchInput />);
  expect(screen.getByRole("searchbox", { name: "Buscar productos" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/shop/search-input.test.tsx`
Expected: FAIL — todavía no hay `aria-label` en el input.

- [ ] **Step 3: Implementar**

Reemplazar el contenido completo de `components/shop/search-input.tsx`:

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
    <form
      onSubmit={handleSubmit}
      className="order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1"
    >
      <Input
        name="q"
        type="search"
        placeholder="Buscar cuadernos, lápices, carpetas..."
        aria-label="Buscar productos"
        defaultValue={searchParams.get("q") ?? ""}
      />
    </form>
  );
}
```

**Por qué funciona sin tocar `header.tsx`:** el header (`components/shop/header.tsx`) es un único `flex flex-wrap` con Logo, `SearchInput`, `WhatsAppButton`, `CartLink` en ese orden de DOM. En mobile (`<sm`), `order-last` mueve visualmente el buscador al final (Logo + WhatsApp + CartLink quedan juntos en la fila 1) y `w-full` fuerza que no entre en esa fila, cayendo solo a la fila 2 a ancho completo — sin duplicar ningún elemento. Desde `sm:` hacia arriba, `sm:order-none` vuelve al orden natural del DOM (igual al layout actual) y `sm:w-auto sm:min-w-0 sm:flex-1` restaura el comportamiento de ancho flexible que ya tenía.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/shop/search-input.test.tsx`
Expected: PASS (2/2 — el test existente de navegación sigue pasando sin cambios porque `getByPlaceholderText` no se vio afectado).

- [ ] **Step 5: Commit**

```bash
git add components/shop/search-input.tsx components/shop/search-input.test.tsx
git commit -m "fix: buscador del header a ancho completo en mobile y con aria-label"
```

---

### Task 2: Badges cortados en las cards de producto

**Files:**
- Modify: `components/shop/product-card.tsx`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Implementar**

En `components/shop/product-card.tsx`, cambiar la línea del contenedor de badges:

```tsx
          <div className="absolute top-2 left-2 flex gap-1">
```

por:

```tsx
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
```

Es el único cambio de este archivo — un solo className, sin tocar nada más.

- [ ] **Step 2: Correr los tests existentes y verificar que siguen en verde**

Run: `pnpm vitest run components/shop/product-card.test.tsx`
Expected: PASS (5/5, sin cambios — los tests existentes verifican presencia/ausencia de badges, no su layout).

- [ ] **Step 3: Commit**

```bash
git add components/shop/product-card.tsx
git commit -m "fix: badges de producto con flex-wrap para no cortarse en cards angostas"
```

---

### Task 3: `buildShippingInquiryMessage` en `lib/shop/whatsapp.ts`

**Files:**
- Modify: `lib/shop/whatsapp.ts`
- Modify: `lib/shop/whatsapp.test.ts`

**Interfaces:**
- Produces: `buildShippingInquiryMessage(template: string, items: {name: string; quantity: number}[]): string` — usado por las Tareas 4 y 6.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `lib/shop/whatsapp.test.ts`:

```ts
describe("buildShippingInquiryMessage", () => {
  it("agrega el detalle de un producto al final de la plantilla", () => {
    const message = buildShippingInquiryMessage("¿Podés hacer envío?", [
      { name: "Cuaderno A4", quantity: 2 },
    ]);
    expect(message).toBe("¿Podés hacer envío?\n\n- Cuaderno A4 x 2");
  });

  it("agrega el detalle de varios productos, uno por línea", () => {
    const message = buildShippingInquiryMessage("¿Podés hacer envío?", [
      { name: "Cuaderno A4", quantity: 2 },
      { name: "Lapicera azul", quantity: 1 },
    ]);
    expect(message).toBe("¿Podés hacer envío?\n\n- Cuaderno A4 x 2\n- Lapicera azul x 1");
  });
});
```

Y actualizar el import del inicio del archivo para incluir el símbolo nuevo:

```ts
import { buildWhatsAppUrl, buildProductInquiryMessage, buildReceiptMessage, buildShippingInquiryMessage } from "./whatsapp";
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/shop/whatsapp.test.ts`
Expected: FAIL — `buildShippingInquiryMessage` no existe todavía.

- [ ] **Step 3: Implementar**

Agregar al final de `lib/shop/whatsapp.ts`:

```ts
export interface ShippingInquiryItem {
  name: string;
  quantity: number;
}

export function buildShippingInquiryMessage(template: string, items: ShippingInquiryItem[]): string {
  const itemLines = items.map((item) => `- ${item.name} x ${item.quantity}`).join("\n");
  return `${template}\n\n${itemLines}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/shop/whatsapp.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/shop/whatsapp.ts lib/shop/whatsapp.test.ts
git commit -m "feat: buildShippingInquiryMessage itemiza los productos del mensaje de consulta de envio"
```

---

### Task 4: Checkout — dirección/horario + WhatsApp itemizado

**Files:**
- Modify: `app/(shop)/checkout/page.tsx`
- Modify: `components/shop/checkout-form.tsx`
- Modify: `components/shop/checkout-form.test.tsx`
- Modify: `components/shop/checkout-form.hydration.test.tsx`

**Interfaces:**
- Consumes: `buildShippingInquiryMessage` (Task 3).
- `CheckoutForm` pasa a requerir 2 props nuevas: `address: string | null`, `businessHours: string | null` (además de las 2 existentes).

- [ ] **Step 1: Escribir los tests que fallan**

En `components/shop/checkout-form.test.tsx`, actualizar TODOS los `render(<CheckoutForm .../>)` existentes (4 ocurrencias) para incluir las 2 props nuevas:

```tsx
render(<CheckoutForm whatsappNumber={null} shippingMessage={null} address={null} businessHours={null} />);
```

(reemplazá cada `render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />)` por la versión con las 4 props, en las 4 apariciones del archivo).

Agregar además estos dos tests nuevos dentro del mismo `describe("CheckoutForm")`:

```ts
it("muestra la dirección y el horario cuando están configurados", async () => {
  mockGetCartProducts.mockResolvedValue([cuaderno]);
  render(
    <CheckoutForm
      whatsappNumber={null}
      shippingMessage={null}
      address="Av. Siempre Viva 742"
      businessHours="Lunes a viernes de 9 a 18"
    />,
  );
  expect(await screen.findByText("Av. Siempre Viva 742")).toBeInTheDocument();
  expect(screen.getByText("Lunes a viernes de 9 a 18")).toBeInTheDocument();
});

it("arma el link de WhatsApp de envío con el detalle de los productos del carrito", async () => {
  mockGetCartProducts.mockResolvedValue([cuaderno]);
  render(
    <CheckoutForm
      whatsappNumber="5491112345678"
      shippingMessage="¿Podés hacer envío?"
      address={null}
      businessHours={null}
    />,
  );
  await screen.findByText(/Cuaderno A4/);
  const link = screen.getByRole("link", { name: "Consultar por WhatsApp" });
  expect(link).toHaveAttribute(
    "href",
    expect.stringContaining(encodeURIComponent("- Cuaderno A4 x 1")),
  );
});
```

En `components/shop/checkout-form.hydration.test.tsx`, actualizar el único `render` (línea con `<CheckoutForm whatsappNumber={null} shippingMessage={null} />`) para incluir las 2 props nuevas igual que arriba.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm vitest run components/shop/checkout-form.test.tsx components/shop/checkout-form.hydration.test.tsx`
Expected: FAIL — TypeScript se queja de props faltantes / los tests nuevos no encuentran el contenido todavía.

- [ ] **Step 3: Implementar**

Reemplazar `app/(shop)/checkout/page.tsx`:

```tsx
import { CheckoutForm } from "@/components/shop/checkout-form";
import { getSettings } from "@/lib/shop/settings";

export default async function CheckoutPage() {
  const settings = await getSettings();

  return (
    <CheckoutForm
      whatsappNumber={settings?.whatsapp_number ?? null}
      shippingMessage={settings?.whatsapp_shipping_inquiry_template ?? null}
      address={settings?.address ?? null}
      businessHours={settings?.business_hours ?? null}
    />
  );
}
```

Reemplazar el contenido completo de `components/shop/checkout-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-provider";
import { getCartProducts } from "@/lib/shop/cart-products";
import { createOrder, type CheckoutActionState } from "@/app/(shop)/checkout/actions";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl, buildShippingInquiryMessage } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShopProduct } from "@/lib/shop/products";

interface CheckoutFormProps {
  whatsappNumber: string | null;
  shippingMessage: string | null;
  address: string | null;
  businessHours: string | null;
}

const initialState: CheckoutActionState = { error: null, orderNumber: null };

export function CheckoutForm({
  whatsappNumber,
  shippingMessage,
  address,
  businessHours,
}: CheckoutFormProps) {
  const router = useRouter();
  const { items, clear, hydrated } = useCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) {
      return;
    }
    if (!hydrated) {
      return;
    }
    if (items.length === 0) {
      router.replace("/carrito");
      return;
    }
    let cancelled = false;
    getCartProducts(items.map((item) => item.productId)).then((result) => {
      if (!cancelled) {
        setProducts(result);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items, router, hydrated]);

  useEffect(() => {
    if (state.orderNumber && !redirectedRef.current) {
      redirectedRef.current = true;
      clear();
      router.push(`/compra-exitosa/${state.orderNumber}`);
    }
  }, [state, clear, router]);

  if (!hydrated || items.length === 0 || !loaded) {
    return <p className="p-8 text-muted-foreground">Cargando...</p>;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return product?.price ? sum + product.price * item.quantity : sum;
  }, 0);

  const shippingInquiryMessage = shippingMessage
    ? buildShippingInquiryMessage(
        shippingMessage,
        items
          .map((item) => {
            const product = productById.get(item.productId);
            return product ? { name: product.name ?? "", quantity: item.quantity } : null;
          })
          .filter((item): item is { name: string; quantity: number } => item !== null),
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const product = productById.get(item.productId);
            return (
              <li key={item.productId} className="flex justify-between text-sm">
                <span>
                  {product ? `${product.name} x${item.quantity}` : "Producto no disponible"}
                </span>
                {product?.price && <span>{formatPrice(product.price * item.quantity)}</span>}
              </li>
            );
          })}
        </ul>
        <p className="text-lg font-semibold">Total: {formatPrice(total)}</p>
      </section>

      <section className="flex flex-col gap-1 text-sm text-muted-foreground">
        {address && <p>{address}</p>}
        {businessHours && <p>{businessHours}</p>}
        <p>
          Retiro en el local. ¿Necesitás envío? Consultanos por WhatsApp.{" "}
          {whatsappNumber && shippingInquiryMessage && (
            <a
              href={buildWhatsAppUrl(whatsappNumber, shippingInquiryMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Consultar por WhatsApp
            </a>
          )}
        </p>
      </section>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" name="lastName" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" name="phone" type="tel" />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Confirmando..." : "Confirmar pedido"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm vitest run components/shop/checkout-form.test.tsx components/shop/checkout-form.hydration.test.tsx`
Expected: PASS (6/6 en `checkout-form.test.tsx`, 1/1 en el archivo de hidratación).

- [ ] **Step 5: Commit**

```bash
git add "app/(shop)/checkout/page.tsx" components/shop/checkout-form.tsx components/shop/checkout-form.test.tsx components/shop/checkout-form.hydration.test.tsx
git commit -m "feat: checkout muestra direccion/horario del local y whatsapp de envio itemizado"
```

---

### Task 5: Confirmación de compra — dirección/horario + WhatsApp post-compra

**Files:**
- Modify: `app/(shop)/compra-exitosa/[orderNumber]/page.tsx`
- Modify: `components/shop/order-confirmation.tsx`
- Modify: `components/shop/order-confirmation.test.tsx`

**Interfaces:**
- `OrderConfirmationSettings` gana 3 campos: `generalMessage: string | null`, `address: string | null`, `businessHours: string | null`.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar el `baseProps.settings` de `components/shop/order-confirmation.test.tsx` (agregar los 3 campos nuevos):

```ts
const baseProps = {
  orderNumber: "LB-1000",
  total: 2000,
  items: [
    { id: "oi-1", productNameSnapshot: "Cuaderno A4", quantity: 2, unitPrice: 1000, subtotal: 2000 },
  ],
  settings: {
    whatsappNumber: null,
    receiptMessage: null,
    generalMessage: null,
    transferAlias: null,
    transferCbuCvu: null,
    transferBankOrWallet: null,
    transferAccountHolder: null,
    transferInstructions: null,
    address: null,
    businessHours: null,
  },
};
```

En el test existente `"muestra el botón de WhatsApp con el link armado cuando hay número y mensaje"`, cambiar la query de `screen.getByRole("link", { name: /WhatsApp/i })` a `screen.getByRole("link", { name: "Enviar comprobante por WhatsApp" })` — con el fix de este task va a haber DOS links de WhatsApp posibles en pantalla (comprobante + consulta general), así que la query genérica por regex dejaría de ser única.

Agregar estos dos tests nuevos dentro del mismo `describe("OrderConfirmation")`:

```ts
it("muestra la dirección y el horario cuando están configurados", () => {
  render(
    <OrderConfirmation
      {...baseProps}
      settings={{
        ...baseProps.settings,
        address: "Av. Siempre Viva 742",
        businessHours: "Lunes a viernes de 9 a 18",
      }}
    />,
  );
  expect(screen.getByText("Av. Siempre Viva 742")).toBeInTheDocument();
  expect(screen.getByText("Lunes a viernes de 9 a 18")).toBeInTheDocument();
});

it("muestra el botón de consulta general por WhatsApp cuando hay número configurado", () => {
  render(
    <OrderConfirmation
      {...baseProps}
      settings={{ ...baseProps.settings, whatsappNumber: "5491112345678" }}
    />,
  );
  expect(screen.getByRole("link", { name: "Consultar por WhatsApp" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/shop/order-confirmation.test.tsx`
Expected: FAIL — `generalMessage`/`address`/`businessHours` no existen en el tipo todavía, y el botón de consulta general no existe.

- [ ] **Step 3: Implementar**

Reemplazar `app/(shop)/compra-exitosa/[orderNumber]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { getSettings } from "@/lib/shop/settings";
import { buildReceiptMessage } from "@/lib/shop/whatsapp";
import { OrderConfirmation } from "@/components/shop/order-confirmation";

interface OrderConfirmationPageProps {
  params: Promise<{ orderNumber: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: "Pedido confirmado — Librería Blanco",
    robots: { index: false },
  };
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  const serviceClient = createServiceClient();

  const { data: order } = await serviceClient
    .from("orders")
    .select("id, order_number, total")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const { data: items } = await serviceClient
    .from("order_items")
    .select("id, product_name_snapshot, quantity, unit_price, subtotal")
    .eq("order_id", order.id);

  const settings = await getSettings();
  const receiptMessage = settings?.whatsapp_receipt_template
    ? buildReceiptMessage(settings.whatsapp_receipt_template, order.order_number)
    : null;

  return (
    <OrderConfirmation
      orderNumber={order.order_number}
      total={order.total}
      items={(items ?? []).map((item) => ({
        id: item.id,
        productNameSnapshot: item.product_name_snapshot,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
      }))}
      settings={{
        whatsappNumber: settings?.whatsapp_number ?? null,
        receiptMessage,
        generalMessage: settings?.whatsapp_general_message ?? null,
        transferAlias: settings?.transfer_alias ?? null,
        transferCbuCvu: settings?.transfer_cbu_cvu ?? null,
        transferBankOrWallet: settings?.transfer_bank_or_wallet ?? null,
        transferAccountHolder: settings?.transfer_account_holder ?? null,
        transferInstructions: settings?.transfer_instructions ?? null,
        address: settings?.address ?? null,
        businessHours: settings?.business_hours ?? null,
      }}
    />
  );
}
```

Reemplazar el contenido completo de `components/shop/order-confirmation.tsx`:

```tsx
import Link from "next/link";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "./whatsapp-button";

export interface OrderConfirmationItem {
  id: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderConfirmationSettings {
  whatsappNumber: string | null;
  receiptMessage: string | null;
  generalMessage: string | null;
  transferAlias: string | null;
  transferCbuCvu: string | null;
  transferBankOrWallet: string | null;
  transferAccountHolder: string | null;
  transferInstructions: string | null;
  address: string | null;
  businessHours: string | null;
}

interface OrderConfirmationProps {
  orderNumber: string;
  items: OrderConfirmationItem[];
  total: number;
  settings: OrderConfirmationSettings;
}

export function OrderConfirmation({ orderNumber, items, total, settings }: OrderConfirmationProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">¡Gracias por tu compra!</h1>
      <p className="text-lg">
        Pedido <span className="font-semibold">{orderNumber}</span>
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>{`${item.productNameSnapshot} x${item.quantity}`}</span>
              <span>{formatPrice(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <p className="text-lg font-semibold">Total: {formatPrice(total)}</p>
      </section>

      <section className="flex flex-col gap-2 rounded border p-4">
        <h2 className="text-lg font-semibold">Datos para transferir</h2>
        {settings.transferBankOrWallet && <p>{settings.transferBankOrWallet}</p>}
        {settings.transferAlias && <p>Alias: {settings.transferAlias}</p>}
        {settings.transferCbuCvu && <p>CBU/CVU: {settings.transferCbuCvu}</p>}
        {settings.transferAccountHolder && <p>Titular: {settings.transferAccountHolder}</p>}
        {settings.transferInstructions && (
          <p className="text-sm text-muted-foreground">{settings.transferInstructions}</p>
        )}
      </section>

      {(settings.address || settings.businessHours) && (
        <section className="flex flex-col gap-1 text-sm text-muted-foreground">
          {settings.address && <p>{settings.address}</p>}
          {settings.businessHours && <p>{settings.businessHours}</p>}
        </section>
      )}

      {settings.whatsappNumber && settings.receiptMessage && (
        <Button asChild>
          <a
            href={buildWhatsAppUrl(settings.whatsappNumber, settings.receiptMessage)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviar comprobante por WhatsApp
          </a>
        </Button>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          No existe seguimiento público de pedidos. Cualquier consulta, escribinos por WhatsApp.
        </p>
        <WhatsAppButton
          phoneNumber={settings.whatsappNumber}
          message={settings.generalMessage ?? "Hola! Quería hacer una consulta."}
          label="Consultar por WhatsApp"
        />
      </div>

      <Link href="/" className="text-sm underline">
        Volver a la tienda
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/shop/order-confirmation.test.tsx`
Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add "app/(shop)/compra-exitosa/[orderNumber]/page.tsx" components/shop/order-confirmation.tsx components/shop/order-confirmation.test.tsx
git commit -m "feat: confirmacion de compra muestra direccion/horario y opcion de whatsapp post-compra"
```

---

### Task 6: Carrito — mensaje de retiro, "Continuar comprando", subtotal, copy del CTA

**Files:**
- Modify: `app/(shop)/carrito/page.tsx`
- Modify: `components/shop/cart-view.tsx`
- Modify: `components/shop/cart-view.test.tsx`

**Interfaces:**
- Consumes: `buildShippingInquiryMessage` (Task 3).
- `CartView` pasa de no tener props a requerir `whatsappNumber: string | null`, `shippingMessage: string | null` — mismo patrón que `CheckoutForm`.

- [ ] **Step 1: Escribir los tests que fallan**

En `components/shop/cart-view.test.tsx`, actualizar TODAS las invocaciones JSX de `<CartView />` existentes a `<CartView whatsappNumber={null} shippingMessage={null} />` — son 9 llamadas a `render(<CartView />)` **más una llamada adicional a `rerender(<CartView />)`** dentro del test "aumentar la cantidad no reemplaza la lista por el mensaje de carga" (esa también necesita las props, TypeScript la va a marcar como error si se la salta).

Actualizar las queries que buscan el botón/link "Continuar a checkout" (3 ocurrencias: una habilitada como link, dos deshabilitadas como button) para que busquen `"Continuar con la compra"` en su lugar — mismo texto, nuevo copy.

Agregar estos tests nuevos dentro del mismo `describe("CartView")`:

```ts
it("muestra el subtotal por línea", async () => {
  mockItems = [{ productId: "p1", quantity: 2 }];
  mockGetCartProducts.mockResolvedValue([cuaderno]);
  render(<CartView whatsappNumber={null} shippingMessage={null} />);
  await screen.findByText("Cuaderno A4");
  expect(screen.getByText(/Subtotal:/)).toHaveTextContent("2.000");
});

it("muestra el link 'Continuar comprando' hacia /productos", async () => {
  mockItems = [{ productId: "p1", quantity: 1 }];
  mockGetCartProducts.mockResolvedValue([cuaderno]);
  render(<CartView whatsappNumber={null} shippingMessage={null} />);
  await screen.findByText("Cuaderno A4");
  expect(screen.getByRole("link", { name: "Continuar comprando" })).toHaveAttribute(
    "href",
    "/productos",
  );
});

it("muestra el mensaje de retiro sin cargo en el local", async () => {
  mockItems = [{ productId: "p1", quantity: 1 }];
  mockGetCartProducts.mockResolvedValue([cuaderno]);
  render(<CartView whatsappNumber={null} shippingMessage={null} />);
  await screen.findByText("Cuaderno A4");
  expect(screen.getByText(/Retiro sin cargo en el local/)).toBeInTheDocument();
});

it("arma el link de WhatsApp de envío con el detalle de los productos del carrito", async () => {
  mockItems = [{ productId: "p1", quantity: 2 }];
  mockGetCartProducts.mockResolvedValue([cuaderno]);
  render(<CartView whatsappNumber="5491112345678" shippingMessage="¿Podés hacer envío?" />);
  await screen.findByText("Cuaderno A4");
  const link = screen.getByRole("link", { name: "Consultar por WhatsApp" });
  expect(link).toHaveAttribute(
    "href",
    expect.stringContaining(encodeURIComponent("- Cuaderno A4 x 2")),
  );
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/shop/cart-view.test.tsx`
Expected: FAIL — TypeScript se queja de props faltantes / los tests nuevos no encuentran el contenido todavía.

- [ ] **Step 3: Implementar**

Reemplazar `app/(shop)/carrito/page.tsx`:

```tsx
import { CartView } from "@/components/shop/cart-view";
import { getSettings } from "@/lib/shop/settings";

export default async function CartPage() {
  const settings = await getSettings();

  return (
    <CartView
      whatsappNumber={settings?.whatsapp_number ?? null}
      shippingMessage={settings?.whatsapp_shipping_inquiry_template ?? null}
    />
  );
}
```

Reemplazar el contenido completo de `components/shop/cart-view.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./cart-provider";
import { getCartProducts } from "@/lib/shop/cart-products";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl, buildShippingInquiryMessage } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShopProduct } from "@/lib/shop/products";

interface CartViewProps {
  whatsappNumber: string | null;
  shippingMessage: string | null;
}

export function CartView({ whatsappNumber, shippingMessage }: CartViewProps) {
  const { items, setQuantity, removeItem, hydrated } = useCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // El carrito arranca vacío hasta que CartProvider lee localStorage;
    // esperar a `hydrated` evita un fetch con items=[] seguido de otro con
    // el carrito real (el flash "cargando" → "vacío" → contenido real).
    if (!hydrated) {
      return;
    }
    // No reiniciamos `loaded` a false acá: una vez que ya se hizo la
    // primera carga, un re-fetch disparado por un cambio de cantidad no
    // debe ocultar la lista completa (eso desmontaría el <Input> de
    // cantidad y le haría perder el foco mientras se tipea).
    let cancelled = false;
    getCartProducts(items.map((item) => item.productId)).then((result) => {
      if (!cancelled) {
        setProducts(result);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items, hydrated]);

  if (!loaded) {
    return <p className="p-8 text-muted-foreground">Cargando carrito...</p>;
  }

  if (items.length === 0) {
    return <p className="p-8 text-muted-foreground">Tu carrito está vacío.</p>;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const hasUnavailableItems = items.some((item) => !productById.has(item.productId));

  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return product?.price ? sum + product.price * item.quantity : sum;
  }, 0);

  const shippingInquiryMessage = shippingMessage
    ? buildShippingInquiryMessage(
        shippingMessage,
        items
          .map((item) => {
            const product = productById.get(item.productId);
            return product ? { name: product.name ?? "", quantity: item.quantity } : null;
          })
          .filter((item): item is { name: string; quantity: number } => item !== null),
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Tu carrito</h1>

      {hasUnavailableItems && (
        <p className="rounded border border-destructive p-3 text-sm text-destructive">
          Algunos productos de tu carrito ya no están disponibles. Quitalos del carrito para
          poder continuar a checkout.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const product = productById.get(item.productId);
          if (!product) {
            return (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-4 border-b pb-4"
              >
                <p className="text-sm text-muted-foreground">Producto ya no disponible</p>
                <Button type="button" variant="ghost" onClick={() => removeItem(item.productId)}>
                  Quitar
                </Button>
              </li>
            );
          }
          const subtotal = product.price ? product.price * item.quantity : 0;
          return (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-4 border-b pb-4"
            >
              <div className="flex flex-col gap-1">
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(product.price)}</p>
                <p className="text-sm text-muted-foreground">Subtotal: {formatPrice(subtotal)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => {
                    // Un campo vaciado (para retipear) da Number("") === 0, y un
                    // pegado no numérico da NaN — ninguno de los dos debe borrar
                    // el item (eso queda reservado al botón "Quitar").
                    const raw = Number(event.target.value);
                    const next = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
                    setQuantity(item.productId, next);
                  }}
                  className="w-16"
                />
                <Button type="button" variant="ghost" onClick={() => removeItem(item.productId)}>
                  Quitar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xl font-semibold">Total: {formatPrice(total)}</p>

      <p className="text-sm text-muted-foreground">
        Retiro sin cargo en el local. ¿Necesitás envío? Consultanos por WhatsApp.{" "}
        {whatsappNumber && shippingInquiryMessage && (
          <a
            href={buildWhatsAppUrl(whatsappNumber, shippingInquiryMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Consultar por WhatsApp
          </a>
        )}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {!hasUnavailableItems ? (
          <Button asChild>
            <Link href="/checkout">Continuar con la compra</Link>
          </Button>
        ) : (
          <Button type="button" disabled>
            Continuar con la compra
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/productos">Continuar comprando</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/shop/cart-view.test.tsx`
Expected: PASS (13/13).

- [ ] **Step 5: Commit**

```bash
git add "app/(shop)/carrito/page.tsx" components/shop/cart-view.tsx components/shop/cart-view.test.tsx
git commit -m "feat: carrito con mensaje de retiro, continuar comprando, subtotal por linea y nuevo copy del CTA"
```

---

### Task 7: Verificación local y sincronización a producción

**Files:** ninguno (tarea de verificación, no de código).

- [ ] **Step 1: Verificación local completa**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: los cuatro comandos terminan sin errores.

- [ ] **Step 2: Confirmar con el usuario antes de tocar producción**

No hay migraciones que pushear. Preguntar explícitamente antes de pushear a producción.

```bash
git push origin nueva-ui
git push origin nueva-ui:main
```

- [ ] **Step 3: Verificar el deploy**

Confirmar que el deployment de producción quedó en estado `READY` (vía Vercel MCP) apuntando al commit del último push a `main`.

- [ ] **Step 4: Verificación interactiva (mobile-first)**

El controller debe verificar manualmente contra producción, con foco especial en 375px de ancho (Playwright, resize a 375x812):
- El buscador del header ocupa una fila propia a ancho completo y muestra el placeholder.
- Los badges "Nuevo"/"Destacado" ya no se cortan en `/productos`.
- El checkout y la confirmación de compra muestran dirección/horario si están configurados en `/admin/configuracion` (si no lo están, no rompen nada — verificar ambos casos).
- El carrito muestra el mensaje de retiro, el link "Continuar comprando", el subtotal por línea, y el botón dice "Continuar con la compra".
- El link de WhatsApp de envío (desde carrito y desde checkout) abre con el detalle de productos itemizado en el mensaje.
- La confirmación de compra tiene un botón de WhatsApp para consultas post-compra, además del de enviar comprobante.
