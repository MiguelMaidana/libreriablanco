# Fase 5 — Admin: Operación (design)

## Alcance

Pantallas de admin para operar el día a día una vez que empiezan a
entrar pedidos por el checkout de invitado (Fase 4): gestión de
Pedidos, consulta de Clientes, y el Home del Admin como centro de
trabajo (spec maestra §90/§94/§95).

**Incluye:**
- `/admin/pedidos`: lista con tabs Nuevos/Finalizados/Cancelados/Todos.
- `/admin/pedidos/[id]`: detalle del pedido, con botón de WhatsApp al
  cliente y acciones Finalizar/Cancelar.
- `/admin/clientes`: lista de solo consulta, con buscador.
- `/admin/clientes/[id]`: detalle de solo lectura (datos, historial de
  compras, total comprado).
- `/admin/page.tsx` (Home del Admin): reemplaza el saludo placeholder
  por un resumen accionable (pedidos nuevos, productos, ventas de hoy).

**Explícitamente fuera de esta fase:**
- Cualquier edición de datos de cliente (la pantalla es de consulta,
  por diseño explícito de la spec — "no convertir en CRM").
- Sección de Facturas en el detalle de cliente (ARCA/Facturación es
  evolutivo, fuera del MVP).
- Un estado intermedio de "pago confirmado" separado de "Finalizar
  pedido" — la validación del comprobante ocurre por WhatsApp, fuera
  del sistema; el admin solo registra el resultado con un click.
- Gráficos o analítica en el dashboard (`"No priorizar gráficos"`,
  spec §90).
- Cualquier guard de permisos a nivel de página para las pantallas de
  solo lectura — se apoyan en las políticas RLS ya vigentes desde
  Fase 1a, mismo criterio que `/admin/productos`.

## Arquitectura

```
app/admin/(protected)/pedidos/page.tsx          — lista con tabs
app/admin/(protected)/pedidos/[id]/page.tsx     — detalle + acciones
app/admin/(protected)/pedidos/actions.ts        — finalizeOrder, cancelOrder
app/admin/(protected)/clientes/page.tsx         — lista con buscador
app/admin/(protected)/clientes/[id]/page.tsx    — detalle (solo lectura)
app/admin/(protected)/page.tsx                  — dashboard real (modifica el placeholder de Fase 1b)
lib/admin/dashboard.ts                          — getDashboardStats()
lib/admin/whatsapp.ts                           — buildOrderContactMessage (reusa buildWhatsAppUrl de lib/shop/whatsapp.ts)
components/admin/sidebar.tsx                    — agrega los links Pedidos/Clientes (modificación)
components/admin/order-status-actions.tsx       — botones Finalizar/Cancelar, con confirmación en Cancelar
```

**Permisos:** las lecturas (listas y detalle) no tienen guard explícito
de página — se apoyan en las políticas RLS ya vigentes desde Fase 1a
(`has_permission(auth.uid(), 'pedidos'|'clientes', 'ver')`), idéntico
al criterio ya usado en `/admin/productos`. Las mutaciones
(`finalizeOrder`, `cancelOrder`) usan
`withPermissionAction("pedidos", "editar", ...)`, mismo patrón que
`toggleProductAvailability` de Fase 2.

## Pedidos — lista

Tarjetas (no tabla, siguiendo el wireframe de §94), con tabs de filtro
por estado. Sin buscador (la spec no lo pide para esta pantalla, a
diferencia de Clientes).

- Tabs: Nuevos (`status = 'NEW'`, default al entrar) · Finalizados
  (`'COMPLETED'`) · Cancelados (`'CANCELLED'`) · Todos (sin filtro).
- Cada card muestra: número de pedido, nombre del cliente (join con
  `customers`), cantidad total de unidades (`sum(order_items.quantity)`
  de ese pedido — no cantidad de líneas distintas), total, estado, y
  un link "Ver pedido".
- Orden: `created_at desc`.
- Estado vacío por tab, con copy ajustado (ej. "No hay pedidos nuevos
  por el momento.").

## Pedidos — detalle y acciones

- Header con número de pedido.
- Sección Cliente: nombre completo, teléfono (si existe), email.
- Sección Productos: cada línea desde el snapshot de `order_items`
  (`product_name_snapshot`, `unit_price`, `quantity`) — nunca desde
  `products` en vivo, para que un pedido viejo siga mostrando
  exactamente lo que se vendió aunque el producto haya cambiado o se
  haya borrado después.
- Total: `orders.total`.
- Pago: texto fijo "Transferencia" (`payment_method` solo admite
  `'BANK_TRANSFER'` en el MVP).
- Botón "Abrir WhatsApp": visible solo si el cliente cargó teléfono.
  Abre `wa.me` con el teléfono del **cliente** (no el de la tienda) y
  el mensaje de `buildOrderContactMessage(firstName, orderNumber)` —
  ej. `"Hola María! Te escribo por tu pedido #LB-1042."`.
- Botones "Finalizar pedido" / "Cancelar": visibles únicamente cuando
  `status === 'NEW'`. Un pedido ya `COMPLETED`/`CANCELLED` muestra su
  estado como texto, sin acciones.
  - `finalizeOrder(id)`: `NEW → COMPLETED` y setea
    `payment_confirmed_at = now()` — es el momento en que la librera
    confirma, con el click, que el comprobante ya fue validado por
    WhatsApp. Sin este seteo, la columna (ya existente desde Fase 1a)
    quedaría siempre `null` y sin ningún punto del sistema que la
    complete. Sin confirmación adicional en la UI (acción esperada).
  - `cancelOrder(id)`: `NEW → CANCELLED`, con confirmación
    (`AlertDialog`, componente ya usado en el proyecto). No toca
    `payment_confirmed_at`.
  - Ambas Server Actions revalidan server-side que el pedido siga en
    `NEW` antes de aplicar el cambio (no alcanza con ocultar el botón
    en el cliente) — un pedido ya cerrado no puede volver a cambiar de
    estado por esta vía, incluso si dos pestañas del admin quedan
    desincronizadas.

## Clientes — lista y detalle (solo lectura)

**Lista:** buscador por nombre, teléfono o email (`ilike`/`or` sobre
esas tres columnas). Cada card muestra nombre, teléfono, cantidad de
compras y fecha de la última compra — ambas calculadas únicamente
sobre pedidos `COMPLETED` (un pedido cancelado no cuenta como compra
real).

**Detalle** (solo lectura, sin sección de Facturas):
- Datos: nombre, teléfono, email.
- Historial de compras: **todos** los pedidos del cliente (no solo
  `COMPLETED`), cada uno con número, fecha, total y estado — para que
  la librera vea también pedidos nuevos o cancelados si los hay.
- Total comprado: suma de `total` únicamente de los pedidos
  `COMPLETED` de ese cliente (es plata que efectivamente se cobró).

## Home del Admin (dashboard)

Reemplaza el saludo placeholder de Fase 1b (`app/admin/(protected)/page.tsx`)
por el centro de trabajo de §90, sin gráficos:

- "Pedidos nuevos": cantidad de `orders` con `status = 'NEW'`, con link
  a `/admin/pedidos` (que abre en el tab Nuevos por default).
- "Productos": cantidad `is_published = true` y cantidad
  `available = false`, con link a `/admin/productos`.
- "Hoy": cantidad de pedidos **creados** hoy (`created_at` dentro del
  día local, sin importar su estado actual — es una foto de actividad
  entrante, no de plata ya cobrada, coherente con que la validación
  del comprobante pasa por WhatsApp fuera del sistema y casi ningún
  pedido llega a `COMPLETED` el mismo día) y la suma de sus `total`.
- Botón "+ Agregar producto" → `/admin/productos/nuevo` (ya existe).
- `getDashboardStats()` en `lib/admin/dashboard.ts` trae las cuatro
  cifras en paralelo (`Promise.all` de queries `count`/`select` livianas).

## Testing

- `finalizeOrder`/`cancelOrder`: tests mockeando Supabase, mismo patrón
  que `productos/actions.test.ts` — casos: éxito, error de permisos, y
  rechazo cuando el pedido ya no está en `NEW`.
- Listas/detalle (Server Components con datos reales): no se testean
  directo, mismo criterio ya establecido en el resto del proyecto —
  solo se testean funciones puras y Client Components.
- `order-status-actions.tsx`: test de componente con `userEvent`,
  confirmando que "Cancelar" pide confirmación antes de ejecutar la
  Server Action, y que "Finalizar" la ejecuta directo.
- `buildOrderContactMessage`: test unitario puro.
