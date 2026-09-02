# Fase 5 — Admin: Operación — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por
> tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Construir las pantallas de admin para operar pedidos y
consultar clientes una vez que empiezan a entrar compras por el
checkout de invitado (Fase 4), más un Home del Admin funcional que
reemplace el saludo placeholder de Fase 1b.

**Arquitectura:** Nuevas rutas dentro de `app/admin/(protected)/`
(`pedidos`, `clientes`) siguiendo exactamente los mismos patrones ya
usados en `productos` de Fase 2: Server Components para lectura (sin
guard de permiso explícito, se apoyan en las políticas RLS ya vigentes
desde Fase 1a) y Server Actions con `withPermissionAction` para las
únicas dos mutaciones de esta fase (`finalizeOrder`, `cancelOrder`).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind
v4 + shadcn/ui, Supabase (Postgres, sin migraciones nuevas — esta fase
es 100% código de aplicación), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-02-fase5-admin-operacion-design.md`

## Global Constraints

- Sin ninguna migración nueva en esta fase — todas las columnas que se
  usan (`orders.payment_confirmed_at`, etc.) ya existen desde Fase 1a.
- La pantalla de Clientes es de solo consulta — sin ninguna acción de
  edición de datos del cliente.
- Sin sección de Facturas en el detalle de cliente (ARCA/Facturación
  es evolutivo, fuera del MVP).
- "Finalizar pedido" es un solo paso (`NEW → COMPLETED`, seteando
  `payment_confirmed_at = now()`) — no hay un estado intermedio de
  "pago confirmado" separado. La validación del comprobante ocurre por
  WhatsApp, fuera del sistema.
- Sin gráficos en el Home del Admin (`"No priorizar gráficos"`, spec
  maestra §90).
- Las páginas de lectura (listas y detalle) no tienen guard de permiso
  explícito — confían en las políticas RLS ya vigentes
  (`has_permission(auth.uid(), 'pedidos'|'clientes', 'ver')`), mismo
  criterio que `/admin/productos` desde Fase 2. Se asume que cualquier
  rol con permiso `pedidos:ver` también tiene `clientes:ver` (razonable
  para el tamaño de esta librería) — si en el futuro se separan, el
  nombre del cliente embebido en la lista/detalle de pedidos podría
  venir `null` para un rol sin `clientes:ver` (RLS bloquea el embed
  silenciosamente, no tira error). Documentado, no resuelto en esta fase.
- Las Server Actions de pedidos (`finalizeOrder`, `cancelOrder`) usan
  `withPermissionAction("pedidos", "editar", ...)`, y revalidan
  server-side que el pedido siga en `status = 'NEW'` antes de aplicar
  el cambio (vía `.eq("status", "NEW")` en el propio `update`) — no
  alcanza con ocultar el botón en el cliente.
- Todo precio se formatea con `formatPrice` de `lib/shop/format.ts`
  (ya existente desde Fase 3) — nunca interpolación cruda de números.
- Toda interpolación de `$` en JSX usa un template literal real
  (`` {`$${valor}`} ``) — nunca `${valor}` como texto JSX plano.
- Componentes nuevos van en `components/admin/`; helpers nuevos en
  `lib/admin/` (carpeta nueva en esta fase, mismo nivel que
  `lib/shop/`).

---

### Task 1: Mensaje de WhatsApp para contactar al cliente

**Files:**
- Create: `lib/admin/whatsapp.ts`
- Create: `lib/admin/whatsapp.test.ts`

**Interfaces:**
- Consume: `buildWhatsAppUrl` de `lib/shop/whatsapp.ts` (Fase 3, ya
  existente) — se importa directo desde donde se use, no se re-exporta
  acá.
- Produce: `buildOrderContactMessage(firstName: string, orderNumber: string): string`.
- Consumido por: Task 5 (detalle de pedido).

- [ ] **Step 1: Escribir el test**

```typescript
// lib/admin/whatsapp.test.ts
import { describe, it, expect } from "vitest";
import { buildOrderContactMessage } from "./whatsapp";

describe("buildOrderContactMessage", () => {
  it("arma el mensaje con el nombre del cliente y el número de pedido", () => {
    expect(buildOrderContactMessage("María", "LB-1042")).toBe(
      "Hola María! Te escribo por tu pedido #LB-1042.",
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test lib/admin/whatsapp.test.ts`
Expected: FAIL — `Cannot find module './whatsapp'`.

- [ ] **Step 3: Implementar `lib/admin/whatsapp.ts`**

```typescript
export function buildOrderContactMessage(firstName: string, orderNumber: string): string {
  return `Hola ${firstName}! Te escribo por tu pedido #${orderNumber}.`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test lib/admin/whatsapp.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/whatsapp.ts lib/admin/whatsapp.test.ts
git commit -m "feat: mensaje de WhatsApp para contactar al cliente desde el admin"
```

---

### Task 2: Server Actions de pedidos (`finalizeOrder`, `cancelOrder`)

**Files:**
- Create: `app/admin/(protected)/pedidos/actions.ts`
- Create: `app/admin/(protected)/pedidos/actions.test.ts`

**Interfaces:**
- Consume: `withPermissionAction` de `lib/auth/permissions.ts` (Fase 1b/2, ya existente).
- Produce: `interface OrderActionResult { error: string | null }`, `finalizeOrder(id: string): Promise<OrderActionResult>`, `cancelOrder(id: string): Promise<OrderActionResult>`.
- Consumido por: Task 3 (`OrderStatusActions`).

- [ ] **Step 1: Escribir el test**

```typescript
// app/admin/(protected)/pedidos/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function mockAdminAllowed() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["SUPER_ADMIN"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: true, error: null });
  });
}

function mockAdminForbidden() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["VENDEDORA"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: false, error: null });
  });
}

function mockUpdateChain(result: { data: { id: string } | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eqStatus = vi.fn().mockReturnValue({ select });
  const eqId = vi.fn().mockReturnValue({ eq: eqStatus });
  const update = vi.fn().mockReturnValue({ eq: eqId });
  mockFrom.mockReturnValue({ update });
  return { update, eqId, eqStatus };
}

import { finalizeOrder, cancelOrder } from "./actions";

describe("finalizeOrder", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de permisos si el admin no tiene acceso", async () => {
    mockAdminForbidden();
    const result = await finalizeOrder("order-1");
    expect(result.error).toBe("No tenés permiso para esta acción.");
  });

  it("pasa el pedido a COMPLETED y setea payment_confirmed_at", async () => {
    mockAdminAllowed();
    const { update, eqId, eqStatus } = mockUpdateChain({ data: { id: "order-1" }, error: null });

    const result = await finalizeOrder("order-1");

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED", payment_confirmed_at: expect.any(String) }),
    );
    expect(eqId).toHaveBeenCalledWith("id", "order-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "NEW");
  });

  it("devuelve error si el pedido ya no está en estado Nuevo", async () => {
    mockAdminAllowed();
    mockUpdateChain({ data: null, error: null });

    const result = await finalizeOrder("order-1");

    expect(result.error).toBe("Este pedido ya no está en estado Nuevo.");
  });
});

describe("cancelOrder", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de permisos si el admin no tiene acceso", async () => {
    mockAdminForbidden();
    const result = await cancelOrder("order-1");
    expect(result.error).toBe("No tenés permiso para esta acción.");
  });

  it("pasa el pedido a CANCELLED", async () => {
    mockAdminAllowed();
    const { update } = mockUpdateChain({ data: { id: "order-1" }, error: null });

    const result = await cancelOrder("order-1");

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ status: "CANCELLED" });
  });

  it("devuelve error si el pedido ya no está en estado Nuevo", async () => {
    mockAdminAllowed();
    mockUpdateChain({ data: null, error: null });

    const result = await cancelOrder("order-1");

    expect(result.error).toBe("Este pedido ya no está en estado Nuevo.");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test "app/admin/(protected)/pedidos/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Implementar `app/admin/(protected)/pedidos/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";

export interface OrderActionResult {
  error: string | null;
}

const FORBIDDEN: OrderActionResult = { error: "No tenés permiso para esta acción." };
const NOT_NEW_ERROR: OrderActionResult = { error: "Este pedido ya no está en estado Nuevo." };

export async function finalizeOrder(id: string): Promise<OrderActionResult> {
  return withPermissionAction("pedidos", "editar", FORBIDDEN, async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "COMPLETED", payment_confirmed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "NEW")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("finalizeOrder: error updating order", error);
      return { error: "No pudimos finalizar el pedido." };
    }

    if (!data) {
      return NOT_NEW_ERROR;
    }

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/admin");
    return { error: null };
  });
}

export async function cancelOrder(id: string): Promise<OrderActionResult> {
  return withPermissionAction("pedidos", "editar", FORBIDDEN, async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .eq("status", "NEW")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("cancelOrder: error updating order", error);
      return { error: "No pudimos cancelar el pedido." };
    }

    if (!data) {
      return NOT_NEW_ERROR;
    }

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/admin");
    return { error: null };
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test "app/admin/(protected)/pedidos/actions.test.ts"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/pedidos/actions.ts" "app/admin/(protected)/pedidos/actions.test.ts"
git commit -m "feat: server actions para finalizar y cancelar pedidos"
```

---

### Task 3: Botones de acción del pedido (`OrderStatusActions`)

**Files:**
- Create: `components/admin/order-status-actions.tsx`
- Create: `components/admin/order-status-actions.test.tsx`

**Interfaces:**
- Consume: `finalizeOrder`, `cancelOrder` de `app/admin/(protected)/pedidos/actions.ts` (Task 2).
- Produce: `OrderStatusActions({ orderId: string })`.
- Consumido por: Task 5 (detalle de pedido).

- [ ] **Step 1: Escribir el test**

```tsx
// components/admin/order-status-actions.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFinalizeOrder = vi.fn();
const mockCancelOrder = vi.fn();

vi.mock("@/app/admin/(protected)/pedidos/actions", () => ({
  finalizeOrder: (...args: unknown[]) => mockFinalizeOrder(...args),
  cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
}));

import { OrderStatusActions } from "./order-status-actions";

describe("OrderStatusActions", () => {
  beforeEach(() => {
    mockFinalizeOrder.mockReset();
    mockCancelOrder.mockReset();
  });

  it("ejecuta finalizeOrder directo al hacer click en Finalizar pedido", async () => {
    mockFinalizeOrder.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<OrderStatusActions orderId="order-1" />);

    await user.click(screen.getByRole("button", { name: "Finalizar pedido" }));

    expect(mockFinalizeOrder).toHaveBeenCalledWith("order-1");
    expect(mockCancelOrder).not.toHaveBeenCalled();
  });

  it("pide confirmación antes de cancelar y no ejecuta cancelOrder hasta confirmar", async () => {
    mockCancelOrder.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<OrderStatusActions orderId="order-1" />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mockCancelOrder).not.toHaveBeenCalled();

    expect(await screen.findByText("¿Cancelar este pedido?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sí, cancelar" }));
    expect(mockCancelOrder).toHaveBeenCalledWith("order-1");
  });

  it("no ejecuta cancelOrder si se hace click en Volver", async () => {
    const user = userEvent.setup();
    render(<OrderStatusActions orderId="order-1" />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await screen.findByText("¿Cancelar este pedido?");
    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test components/admin/order-status-actions.test.tsx`
Expected: FAIL — `Cannot find module './order-status-actions'`.

- [ ] **Step 3: Implementar `OrderStatusActions`**

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { finalizeOrder, cancelOrder, type OrderActionResult } from "@/app/admin/(protected)/pedidos/actions";

interface OrderStatusActionsProps {
  orderId: string;
}

export function OrderStatusActions({ orderId }: OrderStatusActionsProps) {
  const [isPending, startTransition] = useTransition();

  function run(promise: Promise<OrderActionResult>, successMessage: string) {
    startTransition(async () => {
      const result = await promise;
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => run(finalizeOrder(orderId), "Pedido finalizado.")}
      >
        Finalizar pedido
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" disabled={isPending}>
            Cancelar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(cancelOrder(orderId), "Pedido cancelado.")}>
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test components/admin/order-status-actions.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/admin/order-status-actions.tsx components/admin/order-status-actions.test.tsx
git commit -m "feat: botones de finalizar/cancelar pedido con confirmación"
```

---

### Task 4: Página `/admin/pedidos` (lista)

**Files:**
- Create: `lib/admin/orders.ts`
- Create: `app/admin/(protected)/pedidos/page.tsx`

**Interfaces:**
- Produce: `ORDER_STATUS_LABEL: Record<string, string>`, `ORDER_STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive">` en `lib/admin/orders.ts`.
- Consumido por: Task 5 (detalle de pedido), Task 7 (detalle de cliente).

- [ ] **Step 1: Implementar `lib/admin/orders.ts`**

No lleva test propio — son constantes planas sin lógica.

```typescript
export const ORDER_STATUS_LABEL: Record<string, string> = {
  NEW: "Nuevo",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  NEW: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};
```

- [ ] **Step 2: Implementar `app/admin/(protected)/pedidos/page.tsx`**

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/shop/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE_VARIANT } from "@/lib/admin/orders";

type OrderFilter = "nuevos" | "finalizados" | "cancelados" | "todos";

const STATUS_BY_FILTER: Record<Exclude<OrderFilter, "todos">, string> = {
  nuevos: "NEW",
  finalizados: "COMPLETED",
  cancelados: "CANCELLED",
};

const EMPTY_MESSAGE_BY_FILTER: Record<OrderFilter, string> = {
  nuevos: "No hay pedidos nuevos por el momento.",
  finalizados: "Todavía no hay pedidos finalizados.",
  cancelados: "No hay pedidos cancelados.",
  todos: "Todavía no llegó ningún pedido.",
};

interface OrdersPageProps {
  searchParams: Promise<{ filtro?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { filtro } = await searchParams;
  const filter = (filtro as OrderFilter) ?? "nuevos";

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, status, total, customers(first_name, last_name), order_items(quantity)")
    .order("created_at", { ascending: false });

  if (filter !== "todos") {
    query = query.eq("status", STATUS_BY_FILTER[filter]);
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error("OrdersPage: error fetching orders", error);
  }

  const rows = orders ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Pedidos</h1>

      <Tabs value={filter}>
        <TabsList>
          <TabsTrigger value="nuevos" asChild>
            <Link href="/admin/pedidos?filtro=nuevos">Nuevos</Link>
          </TabsTrigger>
          <TabsTrigger value="finalizados" asChild>
            <Link href="/admin/pedidos?filtro=finalizados">Finalizados</Link>
          </TabsTrigger>
          <TabsTrigger value="cancelados" asChild>
            <Link href="/admin/pedidos?filtro=cancelados">Cancelados</Link>
          </TabsTrigger>
          <TabsTrigger value="todos" asChild>
            <Link href="/admin/pedidos?filtro=todos">Todos</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{EMPTY_MESSAGE_BY_FILTER[filter]}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((order) => {
            const customerName = order.customers
              ? `${order.customers.first_name} ${order.customers.last_name}`
              : "Cliente";
            const unitCount = (order.order_items ?? []).reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{`Pedido #${order.order_number}`}</p>
                  <p className="text-sm text-muted-foreground">{customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {`${unitCount} producto${unitCount === 1 ? "" : "s"} · ${formatPrice(order.total)}`}
                  </p>
                  <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]} className="w-fit">
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/pedidos/${order.id}`}>Ver pedido</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Correr toda la suite**

Run: `pnpm test`
Expected: PASS (esta tarea no agrega tests nuevos — la página es un Server Component con datos reales, mismo criterio ya establecido en el resto del proyecto para páginas de este tipo).

- [ ] **Step 4: Commit**

```bash
git add lib/admin/orders.ts "app/admin/(protected)/pedidos/page.tsx"
git commit -m "feat: página /admin/pedidos con tabs de estado"
```

---

### Task 5: Página `/admin/pedidos/[id]` (detalle)

**Files:**
- Create: `app/admin/(protected)/pedidos/[id]/page.tsx`

**Interfaces:**
- Consume: `buildWhatsAppUrl` (`lib/shop/whatsapp.ts`, Fase 3), `buildOrderContactMessage` (Task 1), `OrderStatusActions` (Task 3), `ORDER_STATUS_LABEL`/`ORDER_STATUS_BADGE_VARIANT` (Task 4), `formatPrice` (`lib/shop/format.ts`, Fase 3).

- [ ] **Step 1: Implementar la página**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";
import { buildOrderContactMessage } from "@/lib/admin/whatsapp";
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE_VARIANT } from "@/lib/admin/orders";
import { OrderStatusActions } from "@/components/admin/order-status-actions";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, total, payment_method, customers(first_name, last_name, phone, email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name_snapshot, unit_price, quantity")
    .eq("order_id", id)
    .order("id", { ascending: true });

  const customerName = order.customers
    ? `${order.customers.first_name} ${order.customers.last_name}`
    : "Cliente";
  const customerPhone = order.customers?.phone ?? null;

  const whatsappUrl =
    customerPhone && order.customers
      ? buildWhatsAppUrl(
          customerPhone,
          buildOrderContactMessage(order.customers.first_name, order.order_number),
        )
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl">{`Pedido #${order.order_number}`}</h1>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Cliente</h2>
        <p>{customerName}</p>
        {customerPhone && <p>{customerPhone}</p>}
        {order.customers?.email && <p>{order.customers.email}</p>}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Productos</h2>
        {(items ?? []).map((item) => (
          <p key={item.id}>
            {`${item.quantity} x ${item.product_name_snapshot} — ${formatPrice(item.unit_price * item.quantity)}`}
          </p>
        ))}
      </section>

      <section>
        <h2 className="font-semibold">Total</h2>
        <p className="text-xl font-semibold">{formatPrice(order.total)}</p>
      </section>

      <section>
        <h2 className="font-semibold">Pago</h2>
        <p>Transferencia</p>
      </section>

      {whatsappUrl && (
        <Button asChild variant="outline">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            Abrir WhatsApp
          </a>
        </Button>
      )}

      {order.status === "NEW" ? (
        <OrderStatusActions orderId={order.id} />
      ) : (
        <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]} className="w-fit">
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Correr toda la suite**

Run: `pnpm test`
Expected: PASS (Server Component con datos reales, sin test directo).

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/pedidos/[id]/page.tsx"
git commit -m "feat: página de detalle de pedido con acciones y WhatsApp al cliente"
```

---

### Task 6: Página `/admin/clientes` (lista)

**Files:**
- Create: `app/admin/(protected)/clientes/page.tsx`

- [ ] **Step 1: Implementar la página**

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CustomersPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { q } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, first_name, last_name, phone, email")
    .order("created_at", { ascending: false });

  if (q) {
    const term = `%${q}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`,
    );
  }

  const { data: customers, error } = await query;

  if (error) {
    console.error("CustomersPage: error fetching customers", error);
  }

  const rows = customers ?? [];
  const customerIds = rows.map((customer) => customer.id);

  let completedOrders: { customer_id: string; created_at: string }[] = [];
  if (customerIds.length > 0) {
    const { data } = await supabase
      .from("orders")
      .select("customer_id, created_at")
      .eq("status", "COMPLETED")
      .in("customer_id", customerIds);
    completedOrders = data ?? [];
  }

  const statsByCustomer = new Map<string, { count: number; lastPurchase: string | null }>();
  for (const order of completedOrders) {
    const existing = statsByCustomer.get(order.customer_id) ?? { count: 0, lastPurchase: null };
    existing.count += 1;
    if (!existing.lastPurchase || order.created_at > existing.lastPurchase) {
      existing.lastPurchase = order.created_at;
    }
    statsByCustomer.set(order.customer_id, existing);
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Clientes</h1>

      <form className="flex gap-2" action="/admin/clientes">
        <Input name="q" placeholder="Buscar por nombre, teléfono o email" defaultValue={q} />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No encontramos clientes con esa búsqueda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((customer) => {
            const stats = statsByCustomer.get(customer.id) ?? { count: 0, lastPurchase: null };
            return (
              <Link
                key={customer.id}
                href={`/admin/clientes/${customer.id}`}
                className="flex flex-col gap-1 rounded-lg border p-4 hover:bg-accent"
              >
                <p className="font-medium">{`${customer.first_name} ${customer.last_name}`}</p>
                {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
                <p className="text-sm text-muted-foreground">
                  {`${stats.count} compra${stats.count === 1 ? "" : "s"}`}
                </p>
                {stats.lastPurchase && (
                  <p className="text-sm text-muted-foreground">
                    {`Última compra: ${new Date(stats.lastPurchase).toLocaleDateString("es-AR")}`}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/clientes/page.tsx"
git commit -m "feat: página /admin/clientes con buscador"
```

---

### Task 7: Página `/admin/clientes/[id]` (detalle, solo lectura)

**Files:**
- Create: `app/admin/(protected)/clientes/[id]/page.tsx`

**Interfaces:**
- Consume: `ORDER_STATUS_LABEL`/`ORDER_STATUS_BADGE_VARIANT` (Task 4), `formatPrice` (`lib/shop/format.ts`).

- [ ] **Step 1: Implementar la página**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/shop/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE_VARIANT } from "@/lib/admin/orders";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone, email")
    .eq("id", id)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const orderRows = orders ?? [];
  const totalComprado = orderRows
    .filter((order) => order.status === "COMPLETED")
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl">{`${customer.first_name} ${customer.last_name}`}</h1>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Datos</h2>
        {customer.phone && <p>{customer.phone}</p>}
        {customer.email && <p>{customer.email}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Historial de compras</h2>
        {orderRows.length === 0 ? (
          <p className="text-muted-foreground">Todavía no tiene pedidos.</p>
        ) : (
          orderRows.map((order) => (
            <div key={order.id} className="flex items-center justify-between text-sm">
              <span>
                {`Pedido #${order.order_number} · ${new Date(order.created_at).toLocaleDateString("es-AR")} · ${formatPrice(order.total)}`}
              </span>
              <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                {ORDER_STATUS_LABEL[order.status]}
              </Badge>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="font-semibold">Total comprado</h2>
        <p className="text-xl font-semibold">{formatPrice(totalComprado)}</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/clientes/[id]/page.tsx"
git commit -m "feat: página de detalle de cliente (solo lectura)"
```

---

### Task 8: Home del Admin (dashboard) y nav de la sidebar

**Files:**
- Create: `lib/admin/dashboard.ts`
- Modify: `app/admin/(protected)/page.tsx` (reemplaza el saludo placeholder de Fase 1b)
- Modify: `components/admin/sidebar.tsx` (agrega los links Pedidos/Clientes)

**Interfaces:**
- Produce: `interface DashboardStats { newOrdersCount: number; publishedProductsCount: number; unavailableProductsCount: number; todayOrdersCount: number; todayOrdersTotal: number }`, `getDashboardStats(): Promise<DashboardStats>`.

- [ ] **Step 1: Implementar `lib/admin/dashboard.ts`**

No lleva test propio — es un Server Component/helper con datos reales
de Supabase, mismo criterio ya establecido para este tipo de función
en el resto del proyecto (no se mockea Supabase para funciones que
solo agregan counts/sumas triviales sobre tablas ya cubiertas por
tests de sus propias Server Actions).

```typescript
import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  newOrdersCount: number;
  publishedProductsCount: number;
  unavailableProductsCount: number;
  todayOrdersCount: number;
  todayOrdersTotal: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [newOrders, publishedProducts, unavailableProducts, todayOrders] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "NEW"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("available", false),
    supabase.from("orders").select("total").gte("created_at", startOfToday.toISOString()),
  ]);

  const todayOrdersList = todayOrders.data ?? [];

  return {
    newOrdersCount: newOrders.count ?? 0,
    publishedProductsCount: publishedProducts.count ?? 0,
    unavailableProductsCount: unavailableProducts.count ?? 0,
    todayOrdersCount: todayOrdersList.length,
    todayOrdersTotal: todayOrdersList.reduce((sum, order) => sum + order.total, 0),
  };
}
```

- [ ] **Step 2: Reemplazar `app/admin/(protected)/page.tsx`**

```tsx
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/auth/permissions";
import { getDashboardStats } from "@/lib/admin/dashboard";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/shop/format";

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();
  const stats = await getDashboardStats();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{`Hola, ${admin?.fullName ?? "administradora"} 👋`}</h1>
        <p className="text-muted-foreground">¿Qué necesitás hacer?</p>
        <Button asChild className="w-fit">
          <Link href="/admin/productos/nuevo">+ Agregar producto</Link>
        </Button>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-semibold">Pedidos nuevos</h2>
        <p className="text-2xl">{`${stats.newOrdersCount} pedidos`}</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/admin/pedidos">Ver pedidos</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-semibold">Productos</h2>
        <p>{`${stats.publishedProductsCount} publicados`}</p>
        <p>{`${stats.unavailableProductsCount} no disponibles`}</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/admin/productos">Ver productos</Link>
        </Button>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Hoy</h2>
        <p>{`${stats.todayOrdersCount} pedidos · ${formatPrice(stats.todayOrdersTotal)}`}</p>
      </section>

      <form action="/admin/logout" method="post">
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Agregar los links de Pedidos/Clientes a la sidebar**

Modificar únicamente la función `NavLinks` dentro de `components/admin/sidebar.tsx` — el resto del archivo (`AdminSidebar`, el `Sheet` mobile, `SheetTitle`, el botón de cerrar sesión) queda exactamente igual:

```tsx
function NavLinks({ onNavigate }: NavLinksProps) {
  return (
    <nav className="flex flex-col gap-1">
      <Link
        href="/admin/productos"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Productos
      </Link>
      <Link
        href="/admin/categorias"
        className="ml-3 rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Categorías
      </Link>
      <Link
        href="/admin/pedidos"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Pedidos
      </Link>
      <Link
        href="/admin/clientes"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Clientes
      </Link>
    </nav>
  );
}
```

- [ ] **Step 4: Correr toda la suite**

Run: `pnpm test`
Expected: PASS (no existe `sidebar.test.tsx` hasta ahora en el proyecto — este cambio de navegación no amerita crear uno solo para esto, mismo criterio de no sobre-testear cambios triviales ya visible en el resto del código).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/dashboard.ts "app/admin/(protected)/page.tsx" components/admin/sidebar.tsx
git commit -m "feat: dashboard real del admin y navegación a pedidos/clientes"
```

---

### Task 9: Sync a producción y verificación manual end-to-end

**Files:** ninguno nuevo — tarea de despliegue y verificación. Esta
fase no agrega ninguna migración, así que no hay paso de `supabase db
push` ni regeneración de tipos.

- [ ] **Step 1: Correr la suite completa localmente**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm exec next build`
Expected: todo verde, build sin errores. Si `pnpm test` tropieza con
timeouts transitorios del worker-pool de vitest (ya visto varias veces
en este proyecto por el directorio sincronizado con OneDrive), reintentar
una vez antes de investigar más — un reintento limpio resolvió el
problema todas las veces anteriores.

- [ ] **Step 2: Deploy a producción**

Este proyecto usa `main` (no `nueva-ui`) como Production Branch en
Vercel — un push a `nueva-ui` sola solo genera un preview deployment.
Para promover a producción real:

```bash
git push origin nueva-ui
git push origin nueva-ui:main
```

Confirmar con las herramientas de Vercel que el deployment sobre
`main` queda en estado `READY`.

- [ ] **Step 3: Cargar datos de prueba reales si hace falta**

Si en producción no hay todavía ningún pedido con `status = 'NEW'`
para probar el flujo de Finalizar/Cancelar, crear uno real desde el
checkout público (`/carrito` → `/checkout`) o, si no hay acceso a un
navegador real, insertarlo directo con
`supabase db query --linked` llamando a la función
`create_guest_order` (mismo mecanismo ya usado para verificar la
Fase 4), usando un producto real publicado y disponible.

- [ ] **Step 4: Verificación manual end-to-end en producción**

Con sesión de administradora real contra `https://libreriablanco.vercel.app/admin`:

1. El Home del Admin (`/admin`) muestra la cantidad real de pedidos
   nuevos, productos publicados/no disponibles, y el resumen de "Hoy".
2. `/admin/pedidos` lista los pedidos reales, el tab "Nuevos" es el
   default, y cambiar de tab filtra correctamente.
3. Entrar al detalle de un pedido `NEW`: se ven los datos del cliente,
   los productos con sus snapshots, el total, y los botones Finalizar
   / Cancelar.
4. Click en "Abrir WhatsApp" (si el cliente cargó teléfono) abre
   `wa.me` con el mensaje correcto.
5. Click en "Cancelar" pide confirmación antes de ejecutar; click en
   "Finalizar pedido" cambia el estado sin pedir confirmación.
6. Después de finalizar/cancelar, el pedido ya no muestra los
   botones — solo el badge de su nuevo estado — y el contador de
   "Pedidos nuevos" del Home baja en 1.
7. `/admin/clientes` permite buscar por nombre/teléfono/email y
   muestra la cantidad de compras y última compra correctas.
8. Entrar al detalle de un cliente: historial de compras y total
   comprado coinciden con lo que se ve en `/admin/pedidos`.
9. Responsive en 360px/768px/1440px (spec maestra §101).

Si no hay acceso a un navegador real (Playwright u otro) en el momento
de cerrar esta fase, documentar explícitamente qué quedó verificado
por HTTP/consulta directa a la base y qué queda pendiente de una
verificación visual manual — mismo criterio ya usado al cerrar las
Fases 2, 3 y 4.

- [ ] **Step 5: Limpiar cualquier archivo temporal de la verificación**

Confirmar `git status` limpio (sin contar archivos preexistentes no
relacionados con esta fase) antes de cerrar.
