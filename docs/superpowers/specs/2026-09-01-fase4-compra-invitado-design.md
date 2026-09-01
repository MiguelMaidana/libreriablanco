# Fase 4 — Compra invitado (design)

## Corrección de alcance respecto al nombre original de la fase

La spec maestra (§24, §25, §26, §55) es explícita: **Mercado Pago no forma parte del MVP.** El wireframe de checkout de §87 que muestra un botón "[PAGAR CON MERCADO PAGO]" es un mockup evolutivo/aspiracional, no un requisito vigente — contradice directamente §55 ("MVP propuesto"), que es la lista de alcance autoritativa, y el propio esquema de datos de Fase 1a (`orders.payment_method` solo permite `'BANK_TRANSFER'`; no hay tablas ni columnas de integración de pago en ningún lado).

El flujo real de esta fase es: **transferencia bancaria + comprobante enviado manualmente por WhatsApp**, validado por un humano (Fase 5, Admin: Operación se encarga de la pantalla de validación — esta fase solo se ocupa de generar el pedido y mostrarle al cliente cómo pagar).

## Alcance

**Incluye:**
- Carrito de compra persistido en el navegador (`localStorage`), sin cuenta de cliente.
- Página `/carrito`: ver, editar cantidad, quitar items; revalidación de disponibilidad contra la base al cargar.
- Página `/checkout`: datos del cliente (nombre, apellido, email, teléfono opcional) + resumen de compra.
- Creación del pedido server-side (Server Action + función Postgres `SECURITY DEFINER` vía `service_role`), con recálculo de precio y disponibilidad 100% desde la base — nunca desde el navegador.
- Generación de `order_number` único y secuencial (`LB-1000`, `LB-1001`, ...) vía `sequence` de Postgres.
- Alta o reutilización (`upsert` por email) de la fila en `customers`.
- Página `/compra-exitosa/[orderNumber]`: número de pedido, resumen (desde snapshot), datos de transferencia (`settings`), botón de WhatsApp con mensaje pre-armado para enviar el comprobante. Sin datos personales del cliente en esta pantalla (ver "Seguridad" abajo), y `noindex`.
- Mensaje de "Retiro en el local. ¿Necesitás envío? Consultanos por WhatsApp." en el carrito/checkout.

**Explícitamente fuera de esta fase (documentado para que no se reintroduzca por error):**
- Cualquier integración de Mercado Pago o webhooks de pago (§24/§25, out of MVP).
- Estado `CONFIRMED` en `orders.status` — el constraint actual (`NEW`/`COMPLETED`/`CANCELLED`) no se toca; se evalúa en Fase 5 si el flujo de validación manual lo necesita.
- Registro de `product_events` (`add_to_cart`, `sale`) — diferido, igual criterio que en Fase 3.
- Cuentas de cliente, historial de pedidos visible para el cliente, seguimiento público de pedidos — explícitamente fuera del MVP por spec (§55, §21).
- Costo de envío / descuentos en el total — el MVP es retiro en local sin cargo adicional; `total = subtotal`.
- Validación admin del comprobante y cambio de estado del pedido — eso es Fase 5 (Admin: Operación).

## Arquitectura

Cliente navega productos → agrega al carrito (estado 100% en el navegador) → `/carrito` → `/checkout` → Server Action crea el pedido con `service_role` → `/compra-exitosa` muestra número de pedido + datos de transferencia + WhatsApp.

### Piezas nuevas

- `lib/shop/cart.ts` — tipo `CartItem` y funciones puras de localStorage (sin React, testeables sin DOM):
  ```typescript
  export interface CartItem { productId: string; quantity: number }

  const STORAGE_KEY = "lb_cart";

  export function readCart(): CartItem[]
  export function writeCart(items: CartItem[]): void
  export function addToCart(items: CartItem[], productId: string, quantity: number): CartItem[]
  export function setItemQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] // quantity <= 0 elimina el item
  export function removeFromCart(items: CartItem[], productId: string): CartItem[]
  ```
- `components/shop/cart-provider.tsx` — Client Component, Context de React. En el montaje inicial llama `readCart()`; cada mutación aplica la función pura correspondiente y persiste con `writeCart`. Expone `useCart()`: `{ items, count, addItem, setQuantity, removeItem, clear }`. Se monta en `app/(shop)/layout.tsx`, envolviendo todo el shop.
- `lib/supabase/service.ts` — cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY`, sin sesión (`persistSession: false`), marcado `import "server-only"`. Se instancia una vez por invocación, nunca como singleton importado fuera de Server Actions/Server Components puntuales.
  ```typescript
  import "server-only";
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
- `lib/shop/cart-products.ts` — `getCartProducts(ids: string[])`: consulta `public_products` (cliente anon normal) filtrando por `id in (...)`, adjunta imagen primaria (reusa `attachPrimaryImages`). Cualquier id pedido que no vuelva en el resultado significa que el producto ya no está publicado/disponible.
- `app/(shop)/carrito/page.tsx` — Client Component.
- `app/(shop)/checkout/page.tsx` — Client Component.
- `app/(shop)/checkout/actions.ts` — Server Action `createOrder`.
- `app/(shop)/compra-exitosa/[orderNumber]/page.tsx` — Server Component.
- Botón "Agregar al carrito" en `ProductCard` y en la ficha de producto (`/productos/[slug]`), deshabilitado si `available` es `false`.
- Ícono/contador de carrito en el Header (`components/shop/header.tsx`), linkeando a `/carrito`.

### Migración: `order_number` y función de creación atómica

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

`security definer` + `set search_path = public` sigue el mismo patrón de las demás funciones de la base (evita hijacking de search_path). `grant execute` es exclusivo de `service_role`: ni `anon` ni `authenticated` pueden invocarla vía PostgREST — la única puerta de entrada real es la Server Action de checkout.

### `createOrder` (Server Action, `app/(shop)/checkout/actions.ts`)

Recibe: datos del cliente + `items: {productId, quantity}[]` (nunca precio, viene del contexto del carrito serializado a JSON en el form).

Pasos:
1. Validar el form con Zod (email válido; nombre/apellido no vacíos; `items.length > 0`; cada `quantity` entero > 0).
2. Con el cliente **anon normal**, volver a consultar `public_products` filtrando por los `productId` recibidos, para confirmar que siguen publicados/disponibles y obtener su `price` actual. Si algún id no vuelve, fallar el pedido completo con un error claro — nunca un pedido parcial.
3. Con el cliente **service role**, consultar `products` (tabla completa, no la vista) por esos mismos ids para obtener `cost` (necesario para `unit_cost_snapshot`, un campo interno que no debe exponerse vía la vista pública).
4. Recalcular `unit_price` y `subtotal` desde los datos recién leídos, ignorando cualquier precio que venga del cliente.
5. Llamar a `create_guest_order` vía `.rpc()` con el service client, pasando el array de items ya validados y con costo resuelto.
6. Devolver `{ orderNumber }` en éxito o `{ error }` tipado en fallo.

### `/checkout` (Client Component)

- Si `items.length === 0` (contexto del carrito), redirect a `/carrito`.
- Llama a `getCartProducts(ids)` para mostrar el resumen (nombre, precio, cantidad, subtotal por línea, total).
- Form de datos del cliente con Zod + `react-hook-form` (mismo patrón que `ProductForm` de Fase 2).
- Botón deshabilitado mientras la Server Action está en vuelo (`useTransition`).
- En error: se muestra el mensaje, el carrito no se limpia.
- En éxito: `clear()` del carrito + redirect a `/compra-exitosa/[orderNumber]`.
- Mensaje fijo: "Retiro en el local. ¿Necesitás envío? Consultanos por WhatsApp." con link de WhatsApp usando `settings.whatsapp_shipping_inquiry_template`.

### `/compra-exitosa/[orderNumber]` (Server Component)

- Lee el pedido por `order_number` usando el **service client** (única lectura pública de `orders`/`order_items`, documentada como excepción puntual — no hay policy de SELECT pública en esas tablas y esta página la necesita para poder confirmar la compra sin login).
- Muestra: número de pedido, items desde el snapshot (`order_items`, no desde `products` — así se ve exactamente lo comprado aunque el producto cambie después), subtotal/total con `formatPrice`.
- Muestra datos de transferencia desde `settings` (`transfer_alias`, `transfer_cbu_cvu`, `transfer_bank_or_wallet`, `transfer_account_holder`, `transfer_instructions`) — de lectura pública por diseño ya existente de Fase 1a.
- Botón de WhatsApp con `settings.whatsapp_receipt_template` (pidiendo el comprobante, mencionando el número de pedido) vía `buildWhatsAppUrl` (Fase 3).
- **No muestra nombre, email ni teléfono del cliente** — los `order_number` son secuenciales y la URL no tiene autenticación, así que cualquiera que la adivine o la comparta solo debe poder ver el resumen de compra e instrucciones de pago, nunca datos personales.
- `generateMetadata` con `robots: { index: false }`.
- Nota fija: "No existe seguimiento público de pedidos" (texto de spec §21).

## Seguridad

- El `service_role` solo se instancia dentro de: (a) `createOrder`, y (b) la lectura de `/compra-exitosa`. Nunca en un Client Component, nunca como cliente compartido para lecturas normales del shop.
- Precio y disponibilidad siempre recalculados server-side contra la base — el navegador solo manda `productId` + `quantity`.
- La función `create_guest_order` solo es ejecutable por `service_role` (revoke explícito a `public`/`anon`/`authenticated`), cerrando cualquier posibilidad de invocarla directo vía PostgREST.
- `/compra-exitosa` no expone datos personales, mitigando el riesgo de enumeración sobre `order_number` secuenciales.

## Casos borde

- Carrito vacío al entrar a `/checkout` → redirect a `/carrito`.
- Todos los items dejaron de estar disponibles al pagar → error general, no se llama a `create_guest_order`.
- Algunos items (no todos) dejaron de estar disponibles → se corta el pedido completo, nunca un pedido parcial.
- Doble submit → botón deshabilitado con `isPending`.
- Volver atrás después de comprar → el carrito ya está vacío (`clear()` corre antes del redirect), un checkout repetido arranca desde cero.

## Testing

- `lib/shop/cart.ts`: tests unitarios puros, sin DOM.
- `cart-provider.tsx`: Testing Library, `localStorage` nativo de jsdom.
- `createOrder`: tests mockeando por separado el cliente anon (revalidación) y el cliente service (RPC), mismo patrón que los tests existentes de Server Actions de Fase 2.
- `create_guest_order` (función SQL): verificación con `supabase db reset` local + invocación real vía `supabase db query --linked` — lógica de base, no se mockea.
- `/checkout` y `/compra-exitosa`: tests de componente (validación de form, estado de error, render del resumen y de los datos de transferencia).
