# Fase 4 — Compra Invitado — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por
> tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Construir el checkout sin cuenta de cliente: carrito
persistido en el navegador, `/carrito`, `/checkout` y
`/compra-exitosa`, con creación de pedido server-side y pago por
transferencia bancaria + comprobante manual por WhatsApp (Mercado Pago
queda fuera del MVP).

**Arquitectura:** Estado del carrito 100% en `localStorage` vía un
Context de React (`CartProvider`) montado en `app/(shop)/layout.tsx`.
La creación del pedido pasa por una Server Action que revalida precio
y disponibilidad contra la base (nunca confía en el navegador) y
delega la escritura atómica a una función `SECURITY DEFINER` de
Postgres invocada con la `service_role key` — la única vía posible, ya
que `customers`/`orders`/`order_items` no tienen policy de INSERT
pública.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind
v4 + shadcn/ui, Supabase (Postgres + función RPC con `service_role`),
Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-fase4-compra-invitado-design.md`

## Global Constraints

- Mercado Pago está fuera de alcance (spec maestra §24-26/§55) — no se
  agrega ninguna integración de pago; `orders.payment_method` sigue
  restringido a `'BANK_TRANSFER'` y `orders.status` sigue restringido
  a `'NEW'`/`'COMPLETED'`/`'CANCELLED'` — ningún task de este plan
  modifica esos CHECK constraints.
- Precio y disponibilidad de cada producto se recalculan siempre
  server-side dentro de `createOrder` (Task 6) contra `public_products`
  — el carrito del navegador solo manda `{productId, quantity}`, nunca
  un precio.
- El cliente `service_role` (`lib/supabase/service.ts`, Task 6) se
  instancia únicamente ahí, y se importa únicamente desde
  `app/(shop)/checkout/actions.ts` (Task 6) y
  `app/(shop)/compra-exitosa/[orderNumber]/page.tsx` (Task 8) — nunca
  desde un Client Component ni desde ningún otro archivo.
- `app/(shop)/compra-exitosa/[orderNumber]/page.tsx` no muestra
  nombre, email ni teléfono del cliente, y declara
  `robots: { index: false }` en su `generateMetadata` — los
  `order_number` son secuenciales y la URL no tiene autenticación.
- `total = subtotal` en esta fase — no hay costo de envío ni
  descuentos en el checkout (retiro en el local).
- Sin registro de `product_events` (`add_to_cart`/`sale`) en esta fase
  — mismo criterio que Fase 3.
- Toda interpolación de `$` en JSX usa un template literal real
  (`` {`$${valor}`} ``) — nunca `${valor}` como texto JSX plano (bug ya
  encontrado y corregido varias veces en fases anteriores).
- Componentes nuevos viven en `components/shop/`; helpers nuevos en
  `lib/shop/` salvo `lib/supabase/service.ts` (junto al resto de
  `lib/supabase/`) y `lib/validations/checkout.ts` (junto a
  `lib/validations/product.ts`).
- `settings.whatsapp_receipt_template` y
  `settings.whatsapp_shipping_inquiry_template` todavía no tienen
  pantalla de edición en el admin (esa es una fase de Configuración no
  construida) — si están `NULL` en producción, el CTA de WhatsApp
  correspondiente simplemente no se renderiza, mismo criterio ya usado
  en Fase 3 para `whatsapp_number`.

---

### Task 1: Migración — número de pedido y función de creación atómica

**Files:**
- Create: migración vía `supabase migration new guest_order_creation`

**Interfaces:**
- Produce: función SQL `public.next_order_number(): text` (uso interno).
- Produce: función SQL `public.create_guest_order(p_first_name text, p_last_name text, p_email text, p_phone text, p_items jsonb) returns table (order_number text)` — ejecutable solo por `service_role`. `p_items` es un array de objetos `{product_id, product_name, sku, unit_cost, unit_price, quantity}`.
- Consumida por: Task 6 (`createOrder`, vía `.rpc("create_guest_order", ...)`).

- [ ] **Step 1: Crear la migración**

Run: `supabase migration new guest_order_creation`

- [ ] **Step 2: Escribir el contenido de la migración**

```sql
create sequence public.order_number_seq start 1000;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'LB-' || nextval('public.order_number_seq')::text;
$$;

-- Por defecto Postgres otorga EXECUTE a PUBLIC en funciones nuevas; se
-- revoca explícitamente para que anon/authenticated no puedan invocarla
-- directo vía RPC y quemar números de secuencia. create_guest_order (más
-- abajo) la sigue pudiendo llamar porque corre como su dueño (security
-- definer), no como el rol que hizo la request.
revoke all on function public.next_order_number from public, anon, authenticated;

create or replace function public.create_guest_order(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_items jsonb -- [{product_id, product_name, sku, unit_cost, unit_price, quantity}]
)
returns table (order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2);
  v_item jsonb;
begin
  insert into customers (first_name, last_name, email, phone)
  values (p_first_name, p_last_name, p_email, p_phone)
  on conflict (email) do update
    set first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone, updated_at = now()
  returning id into v_customer_id;

  select coalesce(sum((item->>'unit_price')::numeric * (item->>'quantity')::int), 0)
  into v_subtotal
  from jsonb_array_elements(p_items) as item;

  v_order_number := public.next_order_number();

  insert into orders (order_number, customer_id, subtotal, total, payment_method)
  values (v_order_number, v_customer_id, v_subtotal, v_subtotal, 'BANK_TRANSFER')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, product_id, product_name_snapshot, sku_snapshot, unit_cost_snapshot, unit_price, quantity, subtotal)
    values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'sku',
      (v_item->>'unit_cost')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric * (v_item->>'quantity')::int
    );
  end loop;

  return query select v_order_number;
end;
$$;

revoke all on function public.create_guest_order from public, anon, authenticated;
grant execute on function public.create_guest_order to service_role;
```

- [ ] **Step 3: Aplicar en local y verificar**

Run: `supabase db reset`
Expected: corre sin error junto con todas las migraciones anteriores.

Run: `supabase db query --linked "select proname, prosecdef from pg_proc where proname in ('next_order_number','create_guest_order');"` (si el proyecto local no está linkeado, usar el subcomando equivalente contra la base local — ver Task 9 para el comando exacto ya usado en este proyecto contra producción)
Expected: dos filas, `create_guest_order` con `prosecdef = true`.

- [ ] **Step 4: Regenerar tipos**

Run: `supabase gen types typescript --local > types/supabase.ts`
Expected: `types/supabase.ts` gana las entradas `next_order_number` y `create_guest_order` dentro de `Functions`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations types/supabase.ts
git commit -m "feat: función de creación atómica de pedido de invitado"
```

---

### Task 2: Estado de carrito (localStorage + Context de React)

**Files:**
- Create: `lib/shop/cart.ts`
- Create: `lib/shop/cart.test.ts`
- Create: `components/shop/cart-provider.tsx`
- Create: `components/shop/cart-provider.test.tsx`
- Modify: `app/(shop)/layout.tsx` (envuelve el contenido en `<CartProvider>`)

**Interfaces:**
- Produce: `lib/shop/cart.ts` — `interface CartItem { productId: string; quantity: number }`, `readCart(): CartItem[]`, `writeCart(items: CartItem[]): void`, `addToCart(items: CartItem[], productId: string, quantity: number): CartItem[]`, `setItemQuantity(items: CartItem[], productId: string, quantity: number): CartItem[]`, `removeFromCart(items: CartItem[], productId: string): CartItem[]`.
- Produce: `components/shop/cart-provider.tsx` — `CartProvider({ children })`, `useCart(): { items: CartItem[]; count: number; addItem(productId: string, quantity: number): void; setQuantity(productId: string, quantity: number): void; removeItem(productId: string): void; clear(): void }`.
- Consumido por: Task 4 (`AddToCartButton`, `CartLink`), Task 5 (`CartView`), Task 7 (`CheckoutForm`).

- [ ] **Step 1: Escribir el test de `lib/shop/cart.ts`**

```typescript
// lib/shop/cart.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { readCart, writeCart, addToCart, setItemQuantity, removeFromCart } from "./cart";

describe("cart", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readCart devuelve [] cuando no hay nada guardado", () => {
    expect(readCart()).toEqual([]);
  });

  it("readCart devuelve [] si el JSON guardado está corrupto", () => {
    window.localStorage.setItem("lb_cart", "{esto no es json");
    expect(readCart()).toEqual([]);
  });

  it("readCart ignora entradas con forma inválida", () => {
    window.localStorage.setItem(
      "lb_cart",
      JSON.stringify([{ productId: "p1", quantity: 2 }, { productId: "p2" }, "basura"]),
    );
    expect(readCart()).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("writeCart + readCart hacen roundtrip", () => {
    writeCart([{ productId: "p1", quantity: 3 }]);
    expect(readCart()).toEqual([{ productId: "p1", quantity: 3 }]);
  });

  it("addToCart agrega un producto nuevo", () => {
    const result = addToCart([], "p1", 2);
    expect(result).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("addToCart suma cantidad si el producto ya está", () => {
    const result = addToCart([{ productId: "p1", quantity: 2 }], "p1", 3);
    expect(result).toEqual([{ productId: "p1", quantity: 5 }]);
  });

  it("setItemQuantity cambia la cantidad de un item existente", () => {
    const result = setItemQuantity([{ productId: "p1", quantity: 2 }], "p1", 5);
    expect(result).toEqual([{ productId: "p1", quantity: 5 }]);
  });

  it("setItemQuantity con cantidad <= 0 elimina el item", () => {
    const result = setItemQuantity([{ productId: "p1", quantity: 2 }], "p1", 0);
    expect(result).toEqual([]);
  });

  it("removeFromCart quita el item por id", () => {
    const result = removeFromCart(
      [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      "p1",
    );
    expect(result).toEqual([{ productId: "p2", quantity: 1 }]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test lib/shop/cart.test.ts`
Expected: FAIL — `Cannot find module './cart'`.

- [ ] **Step 3: Implementar `lib/shop/cart.ts`**

```typescript
export interface CartItem {
  productId: string;
  quantity: number;
}

const STORAGE_KEY = "lb_cart";

function isCartItem(value: unknown): value is CartItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CartItem).productId === "string" &&
    typeof (value as CartItem).quantity === "number" &&
    (value as CartItem).quantity > 0
  );
}

export function readCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(items: CartItem[], productId: string, quantity: number): CartItem[] {
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    return items.map((item) =>
      item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item,
    );
  }
  return [...items, { productId, quantity }];
}

export function setItemQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] {
  if (quantity <= 0) {
    return removeFromCart(items, productId);
  }
  return items.map((item) => (item.productId === productId ? { ...item, quantity } : item));
}

export function removeFromCart(items: CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.productId !== productId);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test lib/shop/cart.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Escribir el test de `CartProvider`**

```tsx
// components/shop/cart-provider.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "./cart-provider";

function Probe() {
  const { items, count, addItem, setQuantity, removeItem, clear } = useCart();
  return (
    <div>
      <p data-testid="count">{count}</p>
      <ul>
        {items.map((item) => (
          <li key={item.productId}>{`${item.productId}:${item.quantity}`}</li>
        ))}
      </ul>
      <button onClick={() => addItem("p1", 2)}>add</button>
      <button onClick={() => setQuantity("p1", 5)}>set</button>
      <button onClick={() => removeItem("p1")}>remove</button>
      <button onClick={() => clear()}>clear</button>
    </div>
  );
}

describe("CartProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("arranca con el carrito guardado en localStorage", async () => {
    window.localStorage.setItem("lb_cart", JSON.stringify([{ productId: "p9", quantity: 1 }]));
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    expect(await screen.findByText("p9:1")).toBeInTheDocument();
  });

  it("addItem agrega un producto y persiste en localStorage", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await user.click(screen.getByText("add"));
    expect(await screen.findByText("p1:2")).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("2");
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("lb_cart") ?? "[]")).toEqual([
        { productId: "p1", quantity: 2 },
      ]);
    });
  });

  it("setQuantity y removeItem actualizan el estado", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await user.click(screen.getByText("add"));
    await screen.findByText("p1:2");
    await user.click(screen.getByText("set"));
    expect(await screen.findByText("p1:5")).toBeInTheDocument();
    await user.click(screen.getByText("remove"));
    await waitFor(() => expect(screen.queryByText(/p1:/)).not.toBeInTheDocument());
  });

  it("clear vacía el carrito", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await user.click(screen.getByText("add"));
    await screen.findByText("p1:2");
    await user.click(screen.getByText("clear"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  it("useCart fuera de CartProvider tira un error claro", () => {
    function BadProbe() {
      useCart();
      return null;
    }
    expect(() => render(<BadProbe />)).toThrow("useCart debe usarse dentro de CartProvider");
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `pnpm test components/shop/cart-provider.test.tsx`
Expected: FAIL — `Cannot find module './cart-provider'`.

- [ ] **Step 7: Implementar `CartProvider`**

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  readCart,
  writeCart,
  addToCart,
  setItemQuantity,
  removeFromCart,
  type CartItem,
} from "@/lib/shop/cart";

interface CartContextValue {
  items: CartItem[];
  count: number;
  addItem: (productId: string, quantity: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // El carrito solo existe en el navegador — se lee después del montaje
  // para que el primer render del servidor y del cliente coincidan
  // (ambos arrancan vacíos) y no haya warning de hidratación.
  useEffect(() => {
    setItems(readCart());
  }, []);

  function addItem(productId: string, quantity: number) {
    setItems((current) => {
      const next = addToCart(current, productId, quantity);
      writeCart(next);
      return next;
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setItems((current) => {
      const next = setItemQuantity(current, productId, quantity);
      writeCart(next);
      return next;
    });
  }

  function removeItem(productId: string) {
    setItems((current) => {
      const next = removeFromCart(current, productId);
      writeCart(next);
      return next;
    });
  }

  function clear() {
    setItems([]);
    writeCart([]);
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, addItem, setQuantity, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }
  return context;
}
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `pnpm test components/shop/cart-provider.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 9: Montar `CartProvider` en el layout del shop**

Modificar `app/(shop)/layout.tsx`:

```tsx
import { InfoBar } from "@/components/shop/info-bar";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartProvider } from "@/components/shop/cart-provider";
import { getSettings } from "@/lib/shop/settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <InfoBar storeEnabled={settings?.store_enabled ?? true} />
        <Header
          whatsappNumber={settings?.whatsapp_number ?? null}
          whatsappMessage={settings?.whatsapp_general_message ?? null}
        />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  );
}
```

- [ ] **Step 10: Correr toda la suite y confirmar que nada se rompió**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/shop/cart.ts lib/shop/cart.test.ts components/shop/cart-provider.tsx components/shop/cart-provider.test.tsx "app/(shop)/layout.tsx"
git commit -m "feat: estado de carrito en localStorage con Context de React"
```

---

### Task 3: `getCartProducts` — resolución de productos del carrito contra la base

**Files:**
- Create: `lib/shop/cart-products.ts`
- Create: `lib/shop/cart-products.test.ts`

**Interfaces:**
- Consume: `attachPrimaryImages`, `ShopProduct`, `PublicProduct` de `lib/shop/products.ts` (Fase 3).
- Produce: `getCartProducts(productIds: string[]): Promise<ShopProduct[]>` (Server Action de solo lectura, `"use server"`) — cualquier id pedido que no aparezca en el resultado significa que el producto ya no está publicado/disponible.
- Consumido por: Task 5 (`CartView`), Task 7 (`CheckoutForm`).

- [ ] **Step 1: Escribir el test**

```typescript
// lib/shop/cart-products.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIn = vi.fn();
const mockSelect = vi.fn(() => ({ in: mockIn }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { getCartProducts } from "./cart-products";

describe("getCartProducts", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockIn.mockReset();
  });

  it("devuelve [] sin consultar la base si no hay ids", async () => {
    const result = await getCartProducts([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("consulta public_products filtrando por los ids recibidos", async () => {
    mockIn.mockResolvedValue({ data: [{ id: "p1", name: "Cuaderno", price: 1000 }], error: null });
    const result = await getCartProducts(["p1", "p2"]);
    expect(mockFrom).toHaveBeenCalledWith("public_products");
    expect(mockIn).toHaveBeenCalledWith("id", ["p1", "p2"]);
    expect(result[0]).toMatchObject({ id: "p1", name: "Cuaderno", price: 1000, imageUrl: null });
  });

  it("un id que ya no está publicado/disponible no aparece en el resultado", async () => {
    mockIn.mockResolvedValue({ data: [{ id: "p1", name: "Cuaderno", price: 1000 }], error: null });
    const result = await getCartProducts(["p1", "p-eliminado"]);
    expect(result.map((p) => p.id)).toEqual(["p1"]);
  });

  it("devuelve [] si Supabase devuelve error", async () => {
    mockIn.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await getCartProducts(["p1"]);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test lib/shop/cart-products.test.ts`
Expected: FAIL — `Cannot find module './cart-products'`.

- [ ] **Step 3: Implementar `lib/shop/cart-products.ts`**

`attachPrimaryImages` hace su propia consulta a `product_images` con el
mismo cliente (ver `lib/shop/products.ts` de Fase 3) — no hace falta
mockearla por separado en el test de arriba porque no se le pasan
`ids`, así que su `select` interno también pasa por `mockFrom`, que no
tiene una implementación fake para `"product_images"`; para este test
alcanza con verificar la forma del resultado (`toMatchObject`), sin
asumir el valor exacto de `imageUrl`.

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages, type ShopProduct } from "@/lib/shop/products";

export async function getCartProducts(productIds: string[]): Promise<ShopProduct[]> {
  if (productIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("public_products").select("*").in("id", productIds);

  if (error) {
    console.error("getCartProducts: error fetching products", error);
    return [];
  }

  return attachPrimaryImages(supabase, data ?? []);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test lib/shop/cart-products.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/shop/cart-products.ts lib/shop/cart-products.test.ts
git commit -m "feat: resolver productos del carrito contra la base (server action de lectura)"
```

---

### Task 4: UI de "Agregar al carrito" (card, ficha de producto, header)

**Files:**
- Create: `components/shop/add-to-cart-button.tsx`
- Create: `components/shop/add-to-cart-button.test.tsx`
- Create: `components/shop/cart-link.tsx`
- Create: `components/shop/cart-link.test.tsx`
- Modify: `components/shop/product-card.tsx`
- Modify: `components/shop/product-card.test.tsx`
- Modify: `app/(shop)/productos/[slug]/page.tsx`
- Modify: `components/shop/header.tsx`

**Interfaces:**
- Consume: `useCart` de `components/shop/cart-provider.tsx` (Task 2).
- Produce: `AddToCartButton({ productId: string; available: boolean })`, `CartLink()`.

- [ ] **Step 1: Escribir el test de `AddToCartButton`**

```tsx
// components/shop/add-to-cart-button.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockAddItem = vi.fn();

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: [],
    count: 0,
    addItem: mockAddItem,
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }),
}));

import { AddToCartButton } from "./add-to-cart-button";

describe("AddToCartButton", () => {
  beforeEach(() => {
    mockAddItem.mockReset();
  });

  it("agrega el producto al carrito al hacer click", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" available />);
    await user.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(mockAddItem).toHaveBeenCalledWith("p1", 1);
  });

  it("muestra 'Agregado' después del click", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" available />);
    await user.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(await screen.findByRole("button", { name: "Agregado" })).toBeInTheDocument();
  });

  it("se deshabilita y no permite agregar si available es false", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" available={false} />);
    const button = screen.getByRole("button", { name: "No disponible" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(mockAddItem).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test components/shop/add-to-cart-button.test.tsx`
Expected: FAIL — `Cannot find module './add-to-cart-button'`.

- [ ] **Step 3: Implementar `AddToCartButton`**

```tsx
"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-provider";

interface AddToCartButtonProps {
  productId: string;
  available: boolean;
}

export function AddToCartButton({ productId, available }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (!available) {
    return (
      <Button type="button" variant="outline" disabled>
        No disponible
      </Button>
    );
  }

  function handleClick() {
    addItem(productId, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick}>
      <ShoppingCart className="size-4" />
      {added ? "Agregado" : "Agregar al carrito"}
    </Button>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test components/shop/add-to-cart-button.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Escribir el test de `CartLink`**

```tsx
// components/shop/cart-link.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let mockCount = 0;

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: [],
    count: mockCount,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }),
}));

import { CartLink } from "./cart-link";

describe("CartLink", () => {
  it("enlaza a /carrito", () => {
    mockCount = 0;
    render(<CartLink />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/carrito");
  });

  it("no muestra contador cuando el carrito está vacío", () => {
    mockCount = 0;
    render(<CartLink />);
    expect(screen.queryByTestId("cart-count")).not.toBeInTheDocument();
  });

  it("muestra la cantidad de items cuando hay productos en el carrito", () => {
    mockCount = 3;
    render(<CartLink />);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("3");
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `pnpm test components/shop/cart-link.test.tsx`
Expected: FAIL — `Cannot find module './cart-link'`.

- [ ] **Step 7: Implementar `CartLink`**

```tsx
"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-provider";

export function CartLink() {
  const { count } = useCart();

  return (
    <Link href="/carrito" className="relative flex items-center gap-1 p-2" aria-label="Ver carrito">
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span
          data-testid="cart-count"
          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `pnpm test components/shop/cart-link.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 9: Reestructurar `ProductCard` para agregar el botón sin anidar interactivos**

El `<Link>` no puede envolver un `<button>` (contenido interactivo
anidado es HTML inválido) — se pasa a un `<div>` contenedor con el
`Link` cubriendo imagen/nombre/precio y el botón como hermano.

```tsx
// components/shop/product-card.tsx
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ShopProduct } from "@/lib/shop/products";
import { formatPrice } from "@/lib/shop/format";
import { AddToCartButton } from "./add-to-cart-button";

interface ProductCardProps {
  product: ShopProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 transition hover:shadow-md">
      <Link href={`/productos/${product.slug}`} className="flex flex-col gap-2">
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
        <p className="text-lg font-semibold text-primary">{formatPrice(product.price)}</p>
      </Link>
      <AddToCartButton productId={product.id ?? ""} available={product.available ?? false} />
    </div>
  );
}
```

- [ ] **Step 10: Actualizar `product-card.test.tsx` para envolver en `CartProvider`**

`AddToCartButton` ahora requiere `useCart()`, así que todo render de
`ProductCard` necesita estar dentro de un `CartProvider`.

```tsx
// components/shop/product-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "./product-card";
import { CartProvider } from "./cart-provider";
import type { ShopProduct } from "@/lib/shop/products";

const baseProduct: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1500,
  is_new: false,
  is_featured: false,
  available: true,
  imageUrl: null,
} as ShopProduct;

function renderCard(product: ShopProduct) {
  return render(
    <CartProvider>
      <ProductCard product={product} />
    </CartProvider>,
  );
}

describe("ProductCard", () => {
  it("muestra el nombre y el precio formateado (no texto literal '${...}')", () => {
    renderCard(baseProduct);
    expect(screen.getByText("Cuaderno A4")).toBeInTheDocument();
    expect(screen.getByText(/\$\s*1\.500/)).toBeInTheDocument();
  });

  it("enlaza a /productos/[slug]", () => {
    renderCard(baseProduct);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/productos/cuaderno-a4");
  });

  it("muestra el badge Nuevo solo cuando is_new es true", () => {
    renderCard({ ...baseProduct, is_new: true });
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("no muestra ningún badge cuando is_new e is_featured son false", () => {
    renderCard(baseProduct);
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
    expect(screen.queryByText("Destacado")).not.toBeInTheDocument();
  });

  it("muestra el botón 'Agregar al carrito' cuando el producto está disponible", () => {
    renderCard(baseProduct);
    expect(screen.getByRole("button", { name: "Agregar al carrito" })).toBeInTheDocument();
  });

  it("muestra 'No disponible' cuando available es false", () => {
    renderCard({ ...baseProduct, available: false });
    expect(screen.getByRole("button", { name: "No disponible" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Correr los tests de `ProductCard` y verificar que pasan**

Run: `pnpm test components/shop/product-card.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 12: Agregar `AddToCartButton` a la ficha de producto**

Reemplazar el contenido completo de `app/(shop)/productos/[slug]/page.tsx` por este (el único cambio real es el import de `AddToCartButton` en la línea 12 y la línea nueva dentro del JSX, marcada más abajo):

```tsx
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages } from "@/lib/shop/products";
import { buildWhatsAppUrl, buildProductInquiryMessage } from "@/lib/shop/whatsapp";
import { getSettings } from "@/lib/shop/settings";
import { formatPrice } from "@/lib/shop/format";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductCard } from "@/components/shop/product-card";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
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

  // El origen se deriva de los headers del request (host + proto) en vez
  // de depender de una env var — evita que el link de WhatsApp quede roto
  // (ruta relativa) si esa variable nunca se configura en producción.
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "libreriablanco.vercel.app";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const productUrl = `${protocol}://${host}/productos/${slug}`;
  const whatsappMessage = buildProductInquiryMessage(product.name ?? "este producto", productUrl);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={(images ?? []).map((img) => img.url)} alt={product.name ?? ""} />
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-2xl font-bold text-primary">{formatPrice(product.price)}</p>
          <p className={product.available ? "text-green-600" : "text-destructive"}>
            {product.available ? "Disponible" : "No disponible"}
          </p>
          <AddToCartButton productId={product.id ?? ""} available={product.available ?? false} />
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

- [ ] **Step 13: Agregar `CartLink` al Header**

```tsx
// components/shop/header.tsx
import Link from "next/link";
import { SearchInput } from "./search-input";
import { WhatsAppButton } from "./whatsapp-button";
import { CartLink } from "./cart-link";

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
      <CartLink />
    </header>
  );
}
```

- [ ] **Step 14: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 15: Commit**

```bash
git add components/shop/add-to-cart-button.tsx components/shop/add-to-cart-button.test.tsx components/shop/cart-link.tsx components/shop/cart-link.test.tsx components/shop/product-card.tsx components/shop/product-card.test.tsx "app/(shop)/productos/[slug]/page.tsx" components/shop/header.tsx
git commit -m "feat: UI de agregar al carrito en card, ficha de producto y header"
```

---

### Task 5: Página `/carrito`

**Files:**
- Create: `components/shop/cart-view.tsx`
- Create: `components/shop/cart-view.test.tsx`
- Create: `app/(shop)/carrito/page.tsx`

**Interfaces:**
- Consume: `useCart` (Task 2), `getCartProducts` (Task 3).
- Produce: `CartView()`.

- [ ] **Step 1: Escribir el test de `CartView`**

```tsx
// components/shop/cart-view.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProduct } from "@/lib/shop/products";

const mockSetQuantity = vi.fn();
const mockRemoveItem = vi.fn();
let mockItems: { productId: string; quantity: number }[] = [];

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: mockItems,
    count: mockItems.reduce((sum, item) => sum + item.quantity, 0),
    addItem: vi.fn(),
    setQuantity: mockSetQuantity,
    removeItem: mockRemoveItem,
    clear: vi.fn(),
  }),
}));

const mockGetCartProducts = vi.fn();
vi.mock("@/lib/shop/cart-products", () => ({
  getCartProducts: (ids: string[]) => mockGetCartProducts(ids),
}));

import { CartView } from "./cart-view";

const cuaderno: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1000,
  imageUrl: null,
} as ShopProduct;

describe("CartView", () => {
  beforeEach(() => {
    mockSetQuantity.mockReset();
    mockRemoveItem.mockReset();
    mockGetCartProducts.mockReset();
    mockItems = [];
  });

  it("muestra el mensaje de carrito vacío cuando no hay items", async () => {
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView />);
    expect(await screen.findByText("Tu carrito está vacío.")).toBeInTheDocument();
  });

  it("muestra los productos del carrito con su precio y el total", async () => {
    mockItems = [{ productId: "p1", quantity: 2 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView />);
    expect(await screen.findByText("Cuaderno A4")).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent("2.000");
  });

  it("avisa cuando un producto del carrito ya no está disponible", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView />);
    expect(await screen.findByText(/ya no están disponibles/i)).toBeInTheDocument();
  });

  it("quita un item al hacer click en Quitar", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    const user = userEvent.setup();
    render(<CartView />);
    await screen.findByText("Cuaderno A4");
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect(mockRemoveItem).toHaveBeenCalledWith("p1");
  });

  it("deshabilita 'Continuar a checkout' si ningún producto está disponible", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView />);
    await screen.findByText(/ya no están disponibles/i);
    expect(screen.getByRole("button", { name: "Continuar a checkout" })).toBeDisabled();
  });

  it("habilita 'Continuar a checkout' como link cuando hay productos disponibles", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView />);
    await screen.findByText("Cuaderno A4");
    expect(screen.getByRole("link", { name: "Continuar a checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test components/shop/cart-view.test.tsx`
Expected: FAIL — `Cannot find module './cart-view'`.

- [ ] **Step 3: Implementar `CartView`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./cart-provider";
import { getCartProducts } from "@/lib/shop/cart-products";
import { formatPrice } from "@/lib/shop/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShopProduct } from "@/lib/shop/products";

export function CartView() {
  const { items, setQuantity, removeItem } = useCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    getCartProducts(items.map((item) => item.productId)).then((result) => {
      if (!cancelled) {
        setProducts(result);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (!loaded) {
    return <p className="p-8 text-muted-foreground">Cargando carrito...</p>;
  }

  if (items.length === 0) {
    return <p className="p-8 text-muted-foreground">Tu carrito está vacío.</p>;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const hasUnavailableItems = items.some((item) => !productById.has(item.productId));
  const hasAvailableItems = items.some((item) => productById.has(item.productId));

  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return product?.price ? sum + product.price * item.quantity : sum;
  }, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Tu carrito</h1>

      {hasUnavailableItems && (
        <p className="rounded border border-destructive p-3 text-sm text-destructive">
          Algunos productos de tu carrito ya no están disponibles y fueron excluidos del total.
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
          return (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-4 border-b pb-4"
            >
              <div className="flex flex-col gap-1">
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(product.price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => setQuantity(item.productId, Number(event.target.value))}
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

      {hasAvailableItems ? (
        <Button asChild>
          <Link href="/checkout">Continuar a checkout</Link>
        </Button>
      ) : (
        <Button type="button" disabled>
          Continuar a checkout
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test components/shop/cart-view.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Crear la página `/carrito`**

```tsx
// app/(shop)/carrito/page.tsx
import { CartView } from "@/components/shop/cart-view";

export default function CartPage() {
  return <CartView />;
}
```

- [ ] **Step 6: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/shop/cart-view.tsx components/shop/cart-view.test.tsx "app/(shop)/carrito/page.tsx"
git commit -m "feat: página /carrito"
```

---

### Task 6: Cliente `service_role` + Server Action `createOrder`

**Files:**
- Create: `lib/supabase/service.ts`
- Create: `lib/validations/checkout.ts`
- Create: `lib/validations/checkout.test.ts`
- Create: `app/(shop)/checkout/actions.ts`
- Create: `app/(shop)/checkout/actions.test.ts`

**Interfaces:**
- Consume: función RPC `create_guest_order` (Task 1); vista `public_products` (Fase 3); tabla `products` (columnas `id`, `name`, `sku`, `cost`, ya existentes desde Fase 1a).
- Produce: `lib/supabase/service.ts` — `createServiceClient()`, cliente Supabase tipado con `service_role`, sin sesión.
- Produce: `lib/validations/checkout.ts` — `checkoutSchema`, `type CheckoutInput = { firstName: string; lastName: string; email: string; phone: string | null; items: { productId: string; quantity: number }[] }`.
- Produce: `app/(shop)/checkout/actions.ts` — `interface CheckoutActionState { error: string | null; orderNumber: string | null }`, `createOrder(prevState: CheckoutActionState, formData: FormData): Promise<CheckoutActionState>`.
- Consumido por: Task 7 (`CheckoutForm`), Task 8 (`createServiceClient` reutilizado para leer el pedido en `/compra-exitosa`).

- [ ] **Step 1: Implementar `lib/supabase/service.ts`**

Este cliente nunca debe importarse desde un Client Component — solo
desde Server Actions o Server Components. No lleva test propio (es una
fábrica trivial de un cliente de terceros); su uso correcto se verifica
en los tests de `createOrder` (Step 5) mockeándolo.

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 2: Escribir el test de `checkoutSchema`**

```typescript
// lib/validations/checkout.test.ts
import { describe, it, expect } from "vitest";
import { checkoutSchema } from "./checkout";

const validItems = JSON.stringify([{ productId: "p1", quantity: 2 }]);

describe("checkoutSchema", () => {
  it("acepta datos válidos y parsea items a un array tipado", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "1122334455",
      items: validItems,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([{ productId: "p1", quantity: 2 }]);
      expect(result.data.phone).toBe("1122334455");
    }
  });

  it("phone vacío se convierte en null", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "",
      items: validItems,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
    }
  });

  it("rechaza un email inválido", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "no-es-un-email",
      items: validItems,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza items vacíos", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      items: JSON.stringify([]),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza items con JSON inválido", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      items: "esto no es json",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un item con quantity <= 0", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      items: JSON.stringify([{ productId: "p1", quantity: 0 }]),
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm test lib/validations/checkout.test.ts`
Expected: FAIL — `Cannot find module './checkout'`.

- [ ] **Step 4: Implementar `lib/validations/checkout.ts`**

```typescript
import { z } from "zod";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const checkoutSchema = z.object({
  firstName: z.string().min(1, "Ingresá tu nombre."),
  lastName: z.string().min(1, "Ingresá tu apellido."),
  email: z.string().email("Ingresá un email válido."),
  phone: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null)),
  items: z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "El carrito no es válido." });
        return z.NEVER;
      }
    })
    .pipe(z.array(cartItemSchema).min(1, "El carrito está vacío.")),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm test lib/validations/checkout.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Escribir el test de `createOrder`**

```typescript
// app/(shop)/checkout/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAnonIn = vi.fn();
const mockAnonSelect = vi.fn(() => ({ in: mockAnonIn }));
const mockAnonFrom = vi.fn(() => ({ select: mockAnonSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockAnonFrom })),
}));

const mockServiceIn = vi.fn();
const mockServiceSelect = vi.fn(() => ({ in: mockServiceIn }));
const mockServiceFrom = vi.fn(() => ({ select: mockServiceSelect }));
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom, rpc: mockRpc })),
}));

import { createOrder } from "./actions";

function buildFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("firstName", overrides.firstName ?? "Ana");
  formData.set("lastName", overrides.lastName ?? "Pérez");
  formData.set("email", overrides.email ?? "ana@example.com");
  formData.set("phone", overrides.phone ?? "");
  formData.set(
    "items",
    overrides.items ?? JSON.stringify([{ productId: "p1", quantity: 2 }]),
  );
  return formData;
}

describe("createOrder", () => {
  beforeEach(() => {
    mockAnonFrom.mockClear();
    mockAnonSelect.mockClear();
    mockAnonIn.mockReset();
    mockServiceFrom.mockClear();
    mockServiceSelect.mockClear();
    mockServiceIn.mockReset();
    mockRpc.mockReset();
  });

  it("devuelve error de validación si falta el email", async () => {
    const result = await createOrder(
      { error: null, orderNumber: null },
      buildFormData({ email: "no-valido" }),
    );
    expect(result.error).toBeTruthy();
    expect(result.orderNumber).toBeNull();
    expect(mockAnonFrom).not.toHaveBeenCalled();
  });

  it("falla si algún producto ya no está publicado/disponible", async () => {
    mockAnonIn.mockResolvedValue({ data: [], error: null });
    const result = await createOrder({ error: null, orderNumber: null }, buildFormData());
    expect(result.error).toMatch(/ya no están disponibles/i);
    expect(result.orderNumber).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("recalcula el precio desde la base, ignorando cualquier precio del cliente", async () => {
    mockAnonIn.mockResolvedValue({ data: [{ id: "p1", price: 999 }], error: null });
    mockServiceIn.mockResolvedValue({
      data: [{ id: "p1", name: "Cuaderno A4", sku: "CUA-001", cost: 500 }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ order_number: "LB-1000" }], error: null });

    await createOrder({ error: null, orderNumber: null }, buildFormData());

    expect(mockRpc).toHaveBeenCalledWith(
      "create_guest_order",
      expect.objectContaining({
        p_items: [
          expect.objectContaining({
            product_id: "p1",
            unit_price: 999,
            unit_cost: 500,
            quantity: 2,
          }),
        ],
      }),
    );
  });

  it("devuelve el orderNumber en éxito", async () => {
    mockAnonIn.mockResolvedValue({ data: [{ id: "p1", price: 999 }], error: null });
    mockServiceIn.mockResolvedValue({
      data: [{ id: "p1", name: "Cuaderno A4", sku: "CUA-001", cost: 500 }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ order_number: "LB-1000" }], error: null });

    const result = await createOrder({ error: null, orderNumber: null }, buildFormData());

    expect(result).toEqual({ error: null, orderNumber: "LB-1000" });
  });

  it("devuelve un error genérico si la función RPC falla", async () => {
    mockAnonIn.mockResolvedValue({ data: [{ id: "p1", price: 999 }], error: null });
    mockServiceIn.mockResolvedValue({
      data: [{ id: "p1", name: "Cuaderno A4", sku: "CUA-001", cost: 500 }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await createOrder({ error: null, orderNumber: null }, buildFormData());

    expect(result.error).toBeTruthy();
    expect(result.orderNumber).toBeNull();
  });
});
```

- [ ] **Step 7: Correr el test y verificar que falla**

Run: `pnpm test "app/(shop)/checkout/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 8: Implementar `app/(shop)/checkout/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkoutSchema } from "@/lib/validations/checkout";

export interface CheckoutActionState {
  error: string | null;
  orderNumber: string | null;
}

const UNAVAILABLE_ERROR =
  "Algunos productos de tu carrito ya no están disponibles. Volvé al carrito y revisalo.";
const GENERIC_ERROR = "No pudimos procesar tu pedido. Intentá de nuevo.";

export async function createOrder(
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse({
    firstName: formData.get("firstName") ?? undefined,
    lastName: formData.get("lastName") ?? undefined,
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    items: formData.get("items") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
      orderNumber: null,
    };
  }

  const { firstName, lastName, email, phone, items } = parsed.data;
  const productIds = items.map((item) => item.productId);

  // Precio y disponibilidad SIEMPRE se recalculan acá — nunca se confía
  // en un precio que pudiera venir del formulario/carrito del navegador.
  const supabase = await createClient();
  const { data: currentProducts, error: productsError } = await supabase
    .from("public_products")
    .select("id, price")
    .in("id", productIds);

  if (
    productsError ||
    !currentProducts ||
    currentProducts.length !== productIds.length ||
    currentProducts.some((product) => product.price === null)
  ) {
    return { error: UNAVAILABLE_ERROR, orderNumber: null };
  }

  const priceById = new Map(currentProducts.map((product) => [product.id, product.price as number]));

  const serviceClient = createServiceClient();
  // `cost` no está expuesto en public_products (es información interna)
  // así que hace falta la tabla completa, vía service_role, solo para
  // resolver el snapshot de costo del pedido.
  const { data: fullProducts, error: fullProductsError } = await serviceClient
    .from("products")
    .select("id, name, sku, cost")
    .in("id", productIds);

  if (fullProductsError || !fullProducts || fullProducts.length !== productIds.length) {
    console.error("createOrder: error fetching product cost data", fullProductsError);
    return { error: GENERIC_ERROR, orderNumber: null };
  }
  const fullProductById = new Map(fullProducts.map((product) => [product.id, product]));

  const orderItems = items.map((item) => {
    const fullProduct = fullProductById.get(item.productId)!;
    return {
      product_id: item.productId,
      product_name: fullProduct.name,
      sku: fullProduct.sku,
      unit_cost: fullProduct.cost,
      unit_price: priceById.get(item.productId)!,
      quantity: item.quantity,
    };
  });

  const { data: rpcResult, error: rpcError } = await serviceClient.rpc("create_guest_order", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_phone: phone,
    p_items: orderItems,
  });

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    console.error("createOrder: error creating order", rpcError);
    return { error: GENERIC_ERROR, orderNumber: null };
  }

  return { error: null, orderNumber: rpcResult[0]!.order_number };
}
```

- [ ] **Step 9: Correr el test y verificar que pasa**

Run: `pnpm test "app/(shop)/checkout/actions.test.ts"`
Expected: PASS, 5 tests.

- [ ] **Step 10: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/supabase/service.ts lib/validations/checkout.ts lib/validations/checkout.test.ts "app/(shop)/checkout/actions.ts" "app/(shop)/checkout/actions.test.ts"
git commit -m "feat: server action de creación de pedido con revalidación server-side"
```

---

### Task 7: Página `/checkout`

**Files:**
- Create: `components/shop/checkout-form.tsx`
- Create: `components/shop/checkout-form.test.tsx`
- Create: `app/(shop)/checkout/page.tsx`

**Interfaces:**
- Consume: `useCart` (Task 2), `getCartProducts` (Task 3), `createOrder`/`CheckoutActionState` (Task 6).
- Produce: `CheckoutForm({ whatsappNumber: string | null; shippingMessage: string | null })`.

- [ ] **Step 1: Escribir el test de `CheckoutForm`**

```tsx
// components/shop/checkout-form.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProduct } from "@/lib/shop/products";

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockClear = vi.fn();
let mockItems: { productId: string; quantity: number }[] = [{ productId: "p1", quantity: 1 }];
vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: mockItems,
    count: mockItems.length,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: mockClear,
  }),
}));

const mockGetCartProducts = vi.fn();
vi.mock("@/lib/shop/cart-products", () => ({
  getCartProducts: (ids: string[]) => mockGetCartProducts(ids),
}));

const mockCreateOrder = vi.fn();
vi.mock("@/app/(shop)/checkout/actions", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

import { CheckoutForm } from "./checkout-form";

const cuaderno: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1000,
  imageUrl: null,
} as ShopProduct;

describe("CheckoutForm", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockClear.mockReset();
    mockGetCartProducts.mockReset();
    mockCreateOrder.mockReset();
    mockItems = [{ productId: "p1", quantity: 1 }];
  });

  it("redirige a /carrito si el carrito está vacío", async () => {
    mockItems = [];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    expect(mockReplace).toHaveBeenCalledWith("/carrito");
  });

  it("muestra el resumen y el total", async () => {
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    expect(await screen.findByText(/Cuaderno A4/)).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent("1.000");
  });

  it("muestra el mensaje de error cuando la acción falla", async () => {
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    mockCreateOrder.mockResolvedValue({
      error: "Algunos productos de tu carrito ya no están disponibles. Volvé al carrito y revisalo.",
      orderNumber: null,
    });
    const user = userEvent.setup();
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText(/Cuaderno A4/);

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Confirmar pedido" }));

    expect(await screen.findByText(/ya no están disponibles/i)).toBeInTheDocument();
    expect(mockClear).not.toHaveBeenCalled();
  });

  it("limpia el carrito y redirige a /compra-exitosa en éxito", async () => {
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    mockCreateOrder.mockResolvedValue({ error: null, orderNumber: "LB-1000" });
    const user = userEvent.setup();
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText(/Cuaderno A4/);

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Confirmar pedido" }));

    await vi.waitFor(() => expect(mockClear).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith("/compra-exitosa/LB-1000");
    // El mock de useCart no es reactivo (no vuelve a renderizar cuando
    // clear() muta el estado real del carrito), así que esta aserción no
    // reproduce la condición de carrera del efecto de "carrito vacío";
    // esa protección (el chequeo de redirectedRef.current) se revisa por
    // lectura de código en el task review, no por este test.
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test components/shop/checkout-form.test.tsx`
Expected: FAIL — `Cannot find module './checkout-form'`.

- [ ] **Step 3: Implementar `CheckoutForm`**

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-provider";
import { getCartProducts } from "@/lib/shop/cart-products";
import { createOrder, type CheckoutActionState } from "@/app/(shop)/checkout/actions";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShopProduct } from "@/lib/shop/products";

interface CheckoutFormProps {
  whatsappNumber: string | null;
  shippingMessage: string | null;
}

const initialState: CheckoutActionState = { error: null, orderNumber: null };

export function CheckoutForm({ whatsappNumber, shippingMessage }: CheckoutFormProps) {
  const router = useRouter();
  const { items, clear } = useCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const redirectedRef = useRef(false);

  useEffect(() => {
    // `clear()` (más abajo) vacía el carrito al confirmar el pedido, lo
    // que dispararía este mismo efecto de nuevo con items.length === 0 —
    // sin este chequeo, redirigiría a /carrito pisando el router.push a
    // /compra-exitosa que se dispara en el otro efecto.
    if (redirectedRef.current) {
      return;
    }
    if (items.length === 0) {
      router.replace("/carrito");
      return;
    }
    getCartProducts(items.map((item) => item.productId)).then((result) => {
      setProducts(result);
      setLoaded(true);
    });
  }, [items, router]);

  useEffect(() => {
    if (state.orderNumber && !redirectedRef.current) {
      redirectedRef.current = true;
      clear();
      router.push(`/compra-exitosa/${state.orderNumber}`);
    }
  }, [state, clear, router]);

  if (items.length === 0 || !loaded) {
    return <p className="p-8 text-muted-foreground">Cargando...</p>;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return product?.price ? sum + product.price * item.quantity : sum;
  }, 0);

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

      <p className="text-sm text-muted-foreground">
        Retiro en el local. ¿Necesitás envío? Consultanos por WhatsApp.{" "}
        {whatsappNumber && shippingMessage && (
          <a
            href={buildWhatsAppUrl(whatsappNumber, shippingMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Consultar por WhatsApp
          </a>
        )}
      </p>

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

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test components/shop/checkout-form.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Crear la página `/checkout`**

```tsx
// app/(shop)/checkout/page.tsx
import { CheckoutForm } from "@/components/shop/checkout-form";
import { getSettings } from "@/lib/shop/settings";

export default async function CheckoutPage() {
  const settings = await getSettings();

  return (
    <CheckoutForm
      whatsappNumber={settings?.whatsapp_number ?? null}
      shippingMessage={settings?.whatsapp_shipping_inquiry_template ?? null}
    />
  );
}
```

- [ ] **Step 6: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/shop/checkout-form.tsx components/shop/checkout-form.test.tsx "app/(shop)/checkout/page.tsx"
git commit -m "feat: página /checkout"
```

---

### Task 8: Página `/compra-exitosa/[orderNumber]`

**Files:**
- Modify: `lib/shop/whatsapp.ts` (agrega `buildReceiptMessage`)
- Modify: `lib/shop/whatsapp.test.ts` (si no existe, crearlo con los casos ya cubiertos más el nuevo)
- Create: `components/shop/order-confirmation.tsx`
- Create: `components/shop/order-confirmation.test.tsx`
- Create: `app/(shop)/compra-exitosa/[orderNumber]/page.tsx`

**Interfaces:**
- Consume: `createServiceClient` (Task 6), `getSettings` (Fase 3).
- Produce: `buildReceiptMessage(template: string, orderNumber: string): string` en `lib/shop/whatsapp.ts`.
- Produce: `OrderConfirmation({ orderNumber, items, total, settings })` (componente presentacional puro).

- [ ] **Step 1: Revisar si existe `lib/shop/whatsapp.test.ts`**

Run: `test -f lib/shop/whatsapp.test.ts && cat lib/shop/whatsapp.test.ts || echo "no existe"`

Si no existe, se crea desde cero con los tests de las dos funciones ya
existentes (`buildWhatsAppUrl`, `buildProductInquiryMessage`) más el
caso nuevo de abajo. Si ya existe, solo se le agrega el bloque
`describe("buildReceiptMessage", ...)`.

- [ ] **Step 2: Escribir/completar el test**

```typescript
// lib/shop/whatsapp.test.ts
import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl, buildProductInquiryMessage, buildReceiptMessage } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("arma la URL de wa.me con el mensaje codificado", () => {
    const url = buildWhatsAppUrl("+54 9 11 1234-5678", "Hola!");
    expect(url).toBe("https://wa.me/5491112345678?text=Hola!");
  });
});

describe("buildProductInquiryMessage", () => {
  it("arma el mensaje con nombre y URL del producto", () => {
    const message = buildProductInquiryMessage("Cuaderno A4", "https://example.com/p/cuaderno-a4");
    expect(message).toBe('Hola! Quería consultar sobre "Cuaderno A4": https://example.com/p/cuaderno-a4');
  });
});

describe("buildReceiptMessage", () => {
  it("agrega el número de pedido al final del template", () => {
    const message = buildReceiptMessage("Hola! Te paso el comprobante de mi compra.", "LB-1000");
    expect(message).toBe("Hola! Te paso el comprobante de mi compra. Número de pedido: LB-1000.");
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm test lib/shop/whatsapp.test.ts`
Expected: FAIL en el bloque `buildReceiptMessage` — `buildReceiptMessage is not a function`.

- [ ] **Step 4: Agregar `buildReceiptMessage` a `lib/shop/whatsapp.ts`**

```typescript
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildProductInquiryMessage(productName: string, productUrl: string): string {
  return `Hola! Quería consultar sobre "${productName}": ${productUrl}`;
}

export function buildReceiptMessage(template: string, orderNumber: string): string {
  return `${template} Número de pedido: ${orderNumber}.`;
}
```

(si el archivo no tenía esas dos primeras funciones exactamente así,
no tocarlas — agregar únicamente `buildReceiptMessage` al final.)

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm test lib/shop/whatsapp.test.ts`
Expected: PASS.

- [ ] **Step 6: Escribir el test de `OrderConfirmation`**

```tsx
// components/shop/order-confirmation.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderConfirmation } from "./order-confirmation";

const baseProps = {
  orderNumber: "LB-1000",
  total: 2000,
  items: [
    { id: "oi-1", productNameSnapshot: "Cuaderno A4", quantity: 2, unitPrice: 1000, subtotal: 2000 },
  ],
  settings: {
    whatsappNumber: null,
    receiptMessage: null,
    transferAlias: null,
    transferCbuCvu: null,
    transferBankOrWallet: null,
    transferAccountHolder: null,
    transferInstructions: null,
  },
};

describe("OrderConfirmation", () => {
  it("muestra el número de pedido y el resumen de items", () => {
    render(<OrderConfirmation {...baseProps} />);
    expect(screen.getByText("LB-1000")).toBeInTheDocument();
    expect(screen.getByText(/Cuaderno A4 x2/)).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent("2.000");
  });

  it("no muestra nombre, email ni teléfono del cliente en ningún lado", () => {
    render(<OrderConfirmation {...baseProps} />);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("muestra los datos de transferencia cuando están configurados", () => {
    render(
      <OrderConfirmation
        {...baseProps}
        settings={{
          ...baseProps.settings,
          transferAlias: "libreria.blanco",
          transferCbuCvu: "0000003100012345678901",
        }}
      />,
    );
    expect(screen.getByText(/libreria\.blanco/)).toBeInTheDocument();
    expect(screen.getByText(/0000003100012345678901/)).toBeInTheDocument();
  });

  it("no muestra el botón de WhatsApp si falta el número o el mensaje", () => {
    render(<OrderConfirmation {...baseProps} />);
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
  });

  it("muestra el botón de WhatsApp con el link armado cuando hay número y mensaje", () => {
    render(
      <OrderConfirmation
        {...baseProps}
        settings={{
          ...baseProps.settings,
          whatsappNumber: "5491112345678",
          receiptMessage: "Hola! Te paso el comprobante. Número de pedido: LB-1000.",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: /WhatsApp/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me/5491112345678"));
  });
});
```

- [ ] **Step 7: Correr el test y verificar que falla**

Run: `pnpm test components/shop/order-confirmation.test.tsx`
Expected: FAIL — `Cannot find module './order-confirmation'`.

- [ ] **Step 8: Implementar `OrderConfirmation`**

```tsx
import Link from "next/link";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";

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
  transferAlias: string | null;
  transferCbuCvu: string | null;
  transferBankOrWallet: string | null;
  transferAccountHolder: string | null;
  transferInstructions: string | null;
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

      <p className="text-sm text-muted-foreground">
        No existe seguimiento público de pedidos. Cualquier consulta, escribinos por WhatsApp.
      </p>

      <Link href="/" className="text-sm underline">
        Volver a la tienda
      </Link>
    </div>
  );
}
```

- [ ] **Step 9: Correr el test y verificar que pasa**

Run: `pnpm test components/shop/order-confirmation.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 10: Implementar la página `/compra-exitosa/[orderNumber]`**

```tsx
// app/(shop)/compra-exitosa/[orderNumber]/page.tsx
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
        transferAlias: settings?.transfer_alias ?? null,
        transferCbuCvu: settings?.transfer_cbu_cvu ?? null,
        transferBankOrWallet: settings?.transfer_bank_or_wallet ?? null,
        transferAccountHolder: settings?.transfer_account_holder ?? null,
        transferInstructions: settings?.transfer_instructions ?? null,
      }}
    />
  );
}
```

- [ ] **Step 11: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add lib/shop/whatsapp.ts lib/shop/whatsapp.test.ts components/shop/order-confirmation.tsx components/shop/order-confirmation.test.tsx "app/(shop)/compra-exitosa"
git commit -m "feat: página /compra-exitosa con datos de transferencia y comprobante por WhatsApp"
```

---

### Task 9: Sync a producción y verificación manual end-to-end

**Files:** ninguno nuevo — tarea de despliegue y verificación.

- [ ] **Step 1: Correr la suite completa localmente**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm exec next build`
Expected: todo verde, build sin errores.

- [ ] **Step 2: Push de la migración al proyecto real**

Run: `supabase db push`
Expected: aplica la migración de Task 1 (sequence + `next_order_number` + `create_guest_order`) contra el proyecto de producción.

- [ ] **Step 3: Regenerar tipos contra producción**

Run: `supabase gen types typescript --linked > types/supabase.ts`
Expected: el único cambio real debería ser las dos funciones nuevas dentro de `Functions`; si aparece ruido de formato/metadata del CLI sin relación (BOM, bloque `__InternalSupabase`), descartar esa parte del diff.

- [ ] **Step 4: Confirmar la variable de entorno del service role en Vercel**

Verificar que `SUPABASE_SERVICE_ROLE_KEY` ya está configurada como
variable de entorno de producción en el proyecto de Vercel (debería
estarlo desde que se creó el proyecto — Fase 0). Si no está, agregarla
desde el dashboard de Supabase (Project Settings → API → `service_role`
key) antes de deployar; sin esto, `createOrder` y `/compra-exitosa`
fallan en producción con un error de autenticación de Supabase.

- [ ] **Step 5: Deploy a Vercel**

Verificar que el push a `nueva-ui`/`main` dispara el deploy (mismo
flujo que fases anteriores). Confirmar con las herramientas de Vercel
que el deployment queda en estado `READY`.

- [ ] **Step 6: Verificación manual end-to-end en producción**

Contra `https://libreriablanco.vercel.app` (sin sesión — el checkout
es público):

1. Agregar un producto al carrito desde el catálogo (`/productos`) y
   confirmar que el contador del header sube.
2. Agregar un segundo producto desde su ficha (`/productos/[slug]`).
3. Ir a `/carrito`, confirmar que ambos productos aparecen con precio
   correcto, cambiar la cantidad de uno y confirmar que el total se
   recalcula.
4. Ir a `/checkout`, completar el formulario con datos reales de
   prueba y confirmar el pedido.
5. Confirmar que `/compra-exitosa/LB-XXXX` muestra el número de
   pedido, el resumen correcto, los datos de transferencia
   configurados en `settings`, y que **no** muestra nombre/email/
   teléfono en ningún lado.
6. Click en "Enviar comprobante por WhatsApp" (si `whatsapp_number` y
   `whatsapp_receipt_template` están configurados) abre `wa.me` con el
   mensaje correcto incluyendo el número de pedido.
7. Confirmar en la base (`supabase db query --linked` o el dashboard)
   que se creó una fila en `customers` (o se reusó la existente si el
   email ya existía), una fila en `orders` con `payment_method =
   'BANK_TRANSFER'` y `status = 'NEW'`, y las filas correspondientes en
   `order_items` con los snapshots correctos.
8. Volver a `/carrito`: debe estar vacío (se limpió tras la compra).
9. Intentar completar un checkout con el carrito vacío navegando
   directo a `/checkout`: debe redirigir a `/carrito`.
10. Responsive en 360px/768px/1440px (spec maestra §101).

Si no hay acceso a un navegador real (Playwright u otro) en el momento
de cerrar esta fase, documentar explícitamente qué quedó verificado
por HTTP/consulta directa a la base y qué queda pendiente de una
verificación visual manual — mismo criterio ya usado al cerrar las
Fases 2 y 3.

- [ ] **Step 7: Limpiar cualquier archivo temporal de la verificación**

Confirmar `git status` limpio (sin contar archivos preexistentes no
relacionados con esta fase) antes de cerrar.
