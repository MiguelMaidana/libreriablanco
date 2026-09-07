# Fase 8: Pulido de UI del Portal Público (mobile-first) — Design Spec

**Master spec:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md` §35-38, §44, §46, §76-88, §98-106.

## Contexto

Tras cerrar Fase 7 (Usuarios y Roles) y confirmar que el MVP definido por la spec maestra (§55) está completo en producción, se hizo una auditoría de diseño/UX del portal público contra las secciones de diseño de la spec maestra, con prioridad mobile-first (§37 lo pide explícitamente, y el QA responsive de Fase 7 ya había encontrado fricción real en mobile). La auditoría comparó el código real de `components/shop/`/`app/(shop)/` y capturas reales de producción (desktop 1440px, tablet 768px, mobile 375px) contra 20 secciones de la spec maestra.

Esta fase corrige los hallazgos priorizados de esa auditoría. **No incluye el Admin** — queda para una fase separada.

## Hallazgos fuera de esta fase (decisión explícita, no olvido)

- Grid de productos a 2 columnas en mobile: se mantiene (patrón estándar de e-commerce mobile), solo se corrige el corte visual de badges.
- Badges de "Sin stock"/"Oferta" en las cards: no se agregan (no hay sistema de ofertas construido; el botón ya dice "No disponible").
- Barra informativa sin simplificar en mobile, íconos en `CategoryPill`, componente reutilizable de "Empty State", adopción del componente `Alert` de shadcn en vez de `<p>` hand-rolled: quedan documentados como mejoras futuras de bajo impacto, no se abordan acá.
- **Imagen de "Cuaderno Rivadavia A4" en negro sólido**: confirmado que el archivo real en el bucket (`product-images/fase3-verificacion/cuaderno-rivadavia-a4.png`) es un **PNG de 1×1 píxel** subido como test descartable durante la verificación interactiva de Fase 3, nunca reemplazado por una foto real. No es un bug de código (`next/image` + `remotePatterns` están bien configurados). Es una acción pendiente del negocio (cargar una foto real desde `/admin/productos`), no un ítem de este plan.
- Auditoría del Admin (incluye el hallazgo ya conocido de la tabla de `/admin/usuarios` desbordada en mobile): queda para una fase posterior.

## Alcance de esta fase

### 1. Buscador del header (mobile)

**Problema:** `components/shop/header.tsx` es un único `flex flex-wrap` con 4 hijos (logo, buscador, WhatsApp, carrito). `components/shop/search-input.tsx` da al `<form>` la clase `min-w-0 flex-1`, sin ningún ancho mínimo protegido — en mobile, el buscador se comprime a casi 0px compitiendo por espacio con los otros 3 elementos, mostrando una caja vacía sin el placeholder visible.

**Fix:** el buscador pasa a ocupar su propia fila a ancho completo por debajo del breakpoint `sm` (640px) de Tailwind, quedando el header en 2 filas en mobile (fila 1: logo + WhatsApp + carrito; fila 2: buscador a ancho completo) y en 1 fila desde `sm` hacia arriba, igual que hoy.

**Además:** se agrega `aria-label="Buscar productos"` al `<Input>` del buscador — hoy solo tiene `placeholder`, que no es un label accesible (§37, §46 piden explícitamente "formularios con labels reales"; el proyecto ya tiene el patrón correcto en `product-filters.tsx`, que sí usa `aria-label` en sus `SelectTrigger`).

### 2. Badges cortados en las cards de producto (mobile)

**Problema:** `components/shop/product-card.tsx` posiciona los badges "Nuevo"/"Destacado" en un contenedor `flex gap-1` sin `flex-wrap`, dentro de una card de ~163px de ancho en el grid de 2 columnas a 375px — con los dos badges presentes, se cortan visualmente contra el borde de la imagen (`overflow-hidden`).

**Fix:** el contenedor de badges pasa a `flex flex-wrap gap-1` para que, si no entran en una fila, pasen a una segunda fila en vez de cortarse.

### 3. Dirección y horario del local ausentes en checkout y confirmación

**Problema:** `settings.address` y `settings.business_hours` ya existen en el esquema y se cargan desde `/admin/configuracion` (Fase 6), pero nunca se leen ni se muestran en `checkout-form.tsx` ni en `order-confirmation.tsx` — el cliente nunca ve dónde ni cuándo puede retirar su pedido, pese a que §87 y §104 lo esperan explícitamente como parte de la experiencia de checkout.

**Fix:**
- `app/(shop)/checkout/page.tsx` pasa `address`/`businessHours` (de `settings.address`/`settings.business_hours`) a `CheckoutForm`, que los muestra en la sección de resumen (junto al mensaje de retiro/WhatsApp ya existente).
- `app/(shop)/compra-exitosa/[orderNumber]/page.tsx` agrega los mismos dos campos a `OrderConfirmationSettings` y los muestra en `OrderConfirmation`, junto a los datos de transferencia.
- Ambos usan renderizado condicional (`{address && <p>...</p>}`) para no mostrar nada si el negocio todavía no cargó esos datos — consistente con el patrón ya usado para los campos de transferencia en `order-confirmation.tsx`.

### 4. Carrito: mensaje de retiro/envío, "Continuar comprando", subtotal por línea

**Problema (3 gaps en `components/shop/cart-view.tsx`):**
- Falta el mensaje "Retiro sin cargo en el local. ¿Necesitás envío? Consultanos por WhatsApp." — hoy solo está en el `Footer` global y en `checkout-form.tsx`; §86 lo pide específicamente visible en el carrito también.
- Falta un link "Continuar comprando" de vuelta al catálogo — §86 lo lista como elemento obligatorio junto a "Finalizar compra".
- Falta el subtotal por línea (cantidad × precio unitario) — hoy se muestra precio unitario y el total general, pero no el subtotal de cada ítem.

**Fix:** se agregan los tres al `CartView`, reusando `getSettings()`/`buildWhatsAppUrl` de la misma forma que ya lo hace `checkout-form.tsx` (requiere convertir `CartView` en un componente que reciba `whatsappNumber`/`shippingMessage` como props desde `app/(shop)/carrito/page.tsx`, igual que el patrón ya establecido en `/checkout`). El subtotal por línea se calcula igual que el total (`product.price * item.quantity`) pero por ítem, mostrado junto al precio unitario existente.

### 5. Botón "Continuar a checkout" → "Continuar con la compra"

**Problema:** el texto del CTA en `cart-view.tsx` (dos ocurrencias: habilitado y deshabilitado) dice "Continuar a checkout"; §86 sugiere textualmente "Continuar con la compra".

**Fix:** cambio de copy en las dos ocurrencias del botón.

### 6. Mensaje de WhatsApp de consulta de envío sin itemizar productos

**Problema:** §88 da el ejemplo textual *"Hola, quisiera consultar si pueden realizar el envío de estos productos: - Producto A x 2 - Producto B x 1"*. La implementación real usa `shippingMessage` (la plantilla configurada en Admin) tal cual, vía `buildWhatsAppUrl(whatsappNumber, shippingMessage)` en `checkout-form.tsx` — sin interpolar los productos del carrito.

**Fix:** nueva función en `lib/shop/whatsapp.ts`, `buildShippingInquiryMessage(template, items)`, que recibe la plantilla configurada y la lista de ítems del carrito (nombre + cantidad) y arma el mensaje final agregando el detalle de productos al final de la plantilla (mismo patrón que `buildReceiptMessage`, que ya interpola el número de pedido al final del template). `checkout-form.tsx` pasa a usar esta función en vez de `shippingMessage` directo.

### 7. Sin opción de WhatsApp post-compra en `/compra-exitosa`

**Problema:** `order-confirmation.tsx` solo ofrece un botón de WhatsApp para enviar el comprobante (cuando `whatsappNumber` + `receiptMessage` están configurados). El texto *"Cualquier consulta, escribinos por WhatsApp"* no tiene ningún link — el criterio de aceptación §104 ("consultar envío por WhatsApp") solo está cubierto antes de comprar, no después, que es el momento más natural para esa pregunta (ya con el pedido confirmado).

**Fix:** se agrega un segundo link/botón de WhatsApp junto al de comprobante, usando el mismo mensaje de consulta general (`settings.whatsapp_general_message`, el mismo campo que ya usa `app/(shop)/layout.tsx` para el botón "WhatsApp" del header) en vez de dejar el texto sin acción.

## Archivos afectados

```
components/shop/header.tsx              (fix 1: layout responsive)
components/shop/search-input.tsx        (fix 1: aria-label)
components/shop/product-card.tsx        (fix 2: flex-wrap en badges)
app/(shop)/checkout/page.tsx            (fix 3: pasa address/businessHours)
components/shop/checkout-form.tsx       (fix 3: muestra address/businessHours; fix 6: usa buildShippingInquiryMessage)
app/(shop)/compra-exitosa/[orderNumber]/page.tsx  (fix 3: pasa address/businessHours; fix 7: pasa mensaje de consulta general)
components/shop/order-confirmation.tsx  (fix 3: muestra address/businessHours; fix 7: segundo botón de WhatsApp)
app/(shop)/carrito/page.tsx             (fix 4: pasa whatsappNumber/shippingMessage a CartView)
components/shop/cart-view.tsx           (fix 4: mensaje de retiro, "Continuar comprando", subtotal; fix 5: copy del CTA)
lib/shop/whatsapp.ts                    (fix 6: nueva función buildShippingInquiryMessage)
```

No hay cambios de esquema de base de datos ni de Server Actions — todos los datos que se van a mostrar (`address`, `business_hours`, plantillas de WhatsApp) ya existen en la tabla `settings` desde Fase 6.

## Testing

Se agregan/ajustan tests unitarios para: `buildShippingInquiryMessage` (nueva función pura, fácil de testear con casos de 1 y N ítems), y los componentes que ya tienen test (`cart-view.test.tsx` si existe, o se crea si no) para cubrir la aparición del subtotal por línea y el link "Continuar comprando". Los cambios de solo-layout (fix 1, fix 2) no requieren test nuevo — son clases de Tailwind sin lógica.

## Autorevisión

- **Cobertura de spec:** los 4 hallazgos "Alto" de la auditoría están cubiertos (buscador mobile, accesibilidad del buscador, badges cortados, dirección/horario ausentes) salvo la imagen en negro, que se documentó explícitamente como fuera de alcance con su causa raíz verificada.
- **Placeholders:** ninguno — cada fix tiene su archivo, su causa raíz verificada contra el código real, y su solución concreta.
- **Ambigüedad:** el fix 4 (carrito) requiere convertir `CartView` de "sin props" a "recibe `whatsappNumber`/`shippingMessage`" — se decidió reusar el mismo patrón exacto que `CheckoutForm` en vez de inventar uno nuevo, para mantener consistencia entre las dos pantallas del flujo de compra.
