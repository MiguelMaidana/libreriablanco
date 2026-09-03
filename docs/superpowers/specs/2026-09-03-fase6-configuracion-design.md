# Fase 6 — Admin: Configuración del negocio (design)

## Alcance

Pantalla única de admin para editar la fila `settings` (única, ya
sembrada desde Fase 1a) — datos de la librería, WhatsApp, transferencia
bancaria y configuración de la tienda pública. Spec maestra §97.

Cierra una brecha real ya documentada durante las Fases 3-5: los datos
de transferencia y las plantillas de WhatsApp llevan vacíos (`NULL`)
en producción desde que se verificó la Fase 3, porque no existía
ninguna forma de cargarlos salvo SQL directo.

**Incluye:**
- Formulario de admin en `/admin/configuracion` con las 4 secciones de
  §97: Librería, WhatsApp, Transferencia, Tienda.
- Carga de logo e imagen del hero vía upload a Supabase Storage
  (reemplaza los campos de texto plano `logo_url`/`hero_image_url`).
- Toggle de `store_enabled` (tienda habilitada / en mantenimiento).

**Explícitamente fuera de esta fase:**
- "Categorías destacadas" — ya cubierto por el toggle "Destacada" que
  existe en la pantalla de Categorías desde Fase 2; no se duplica acá.
- `legal_name`/`tax_id` (razón social, CUIT) — son datos de
  facturación/ARCA, evolutivo fuera del MVP; existen en la tabla pero
  no se exponen en este formulario.
- Cualquier lógica nueva de bloqueo real de la tienda cuando
  `store_enabled = false` — hoy solo cambia el texto de la barra
  informativa (`InfoBar`, Fase 3); esta fase no cambia ese
  comportamiento, solo expone el toggle que ya existía sin una UI para
  editarlo.
- Usuarios y Roles (§96) — fase separada, ya decidida con el usuario.

## Arquitectura

```
app/admin/(protected)/configuracion/page.tsx    — Server Component, lee settings
app/admin/(protected)/configuracion/actions.ts  — updateSettings, uploadLogo, uploadHeroImage
components/admin/settings-form.tsx              — formulario (useActionState)
components/admin/sidebar.tsx                    — agrega el link "Configuración" (modificación)
supabase/migrations/<ts>_settings_images_bucket.sql — bucket "settings-images"
```

Todas las mutaciones usan `withPermissionAction("configuracion", "editar", ...)`
— permiso ya sembrado desde Fase 1a. La lectura no tiene guard de
página explícito (mismo criterio que el resto del admin): la RLS de
`settings` ya es de lectura pública y de escritura solo para
`configuracion:editar`. El formulario siempre actualiza la fila única
(`id = 1`, ya sembrada) — nunca crea ni borra filas.

## Formulario — campos por sección

Un solo formulario largo, dividido visualmente en 4 bloques (sin
accordion — a diferencia de "Más datos" en `ProductForm`, acá todas las
secciones son igualmente relevantes, no hace falta ocultar ninguna).

**Librería:** `business_name`, `address`, `business_hours`, `phone`, `email`.

**WhatsApp:** `whatsapp_number`, `whatsapp_general_message`,
`whatsapp_receipt_template`, `whatsapp_shipping_inquiry_template`.

**Transferencia:** `transfer_alias`, `transfer_account_holder`,
`transfer_cbu_cvu`, `transfer_bank_or_wallet`, `transfer_instructions`.

**Tienda:** `store_enabled` (switch), `hero_title`, `hero_text`,
`hero_image_url` (upload), `hero_cta_text`, `hero_cta_link`,
`logo_url` (upload), `pickup_instructions_text`.

Todos los campos de texto son opcionales — la tabla los define
`nullable` y la tienda puede operar con datos parciales mientras se
van cargando, igual que hoy. `store_enabled` es el único campo no
nulo (`boolean not null default true`).

## Carga de logo e imagen del hero

A diferencia de las imágenes de producto (varias por producto, con
orden y "principal"), acá siempre hay una sola imagen por campo que se
reemplaza — mucho más simple que `product-image-manager`:

- Bucket nuevo `settings-images` (público de lectura vía policy;
  escritura solo con `has_permission(auth.uid(), 'configuracion', 'editar')`),
  mismos límites que el bucket de productos: `image/jpeg`, `image/png`,
  `image/webp`, `image/avif`, máximo 5MB.
- Cada subida genera un archivo con nombre único
  (`logo_url/<uuid>.<ext>` o `hero_image_url/<uuid>.<ext>`) — nunca se
  pisa el archivo anterior en Storage; se actualiza la columna
  correspondiente de `settings` para que apunte al nuevo archivo. El
  archivo viejo queda huérfano en Storage sin limpiarse — para dos
  imágenes que cambian ocasionalmente, la complejidad de borrarlo no
  se justifica (mismo criterio de simplicidad ya usado varias veces en
  este proyecto).
- Una única función interna `uploadSettingsImage(field, formData)` (no
  dos copias casi idénticas de la misma validación) usada por dos
  Server Actions públicas, `uploadLogo` y `uploadHeroImage`, cada una
  envuelta en `withPermissionAction("configuracion", "editar", ...)`.
- Al subir, se revalida `/admin/configuracion` y `/` (el Home público
  usa `hero_image_url`; el logo no se consume todavía en ningún lado
  del portal público, pero se revalida `/admin/configuracion` igual
  para que el admin vea el cambio reflejado de inmediato).
- En el formulario, cada campo de imagen muestra la imagen actual (si
  existe) más un input de archivo para reemplazarla — sin galería, sin
  reordenar.
- La subida de cada imagen es una acción independiente del guardado de
  los campos de texto — mismo criterio que Productos en Fase 2, donde
  `ProductImageManager` sube imágenes con su propio botón/acción,
  separado del formulario principal de datos del producto
  (`ProductForm`). El admin puede reemplazar el logo o la imagen del
  hero sin tener que reenviar el resto del formulario, y viceversa.

## Testing

- `updateSettings`, `uploadLogo`, `uploadHeroImage`: tests mockeando
  Supabase, mismo patrón que las Server Actions ya existentes en el
  proyecto (éxito, error de permisos, validación de archivo para las
  dos de imagen).
- `SettingsForm`: sin test de componente dedicado más allá de lo que
  ya cubren las Server Actions — es un formulario largo pero mecánico
  (mismos inputs controlados que `ProductForm`), sin lógica de negocio
  propia (no hay cálculo de margen ni advertencias condicionales como
  en productos) que amerite un test de UI específico.
- La página (Server Component con datos reales) no se testea directo,
  mismo criterio ya establecido en el resto del proyecto.
