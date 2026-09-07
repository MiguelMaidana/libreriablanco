# Fase 9: Rediseño visual de la Home y componentes compartidos — Design Spec

**Master spec:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md` §76-88, §97, §102.

## Contexto

Tras cerrar Fase 8 (Pulido de UI del Portal Público, mobile-first) y confirmar que está en producción, el usuario compartió un sitio de referencia (`blanco-shelf.lovable.app`, 4 capturas) cuya estética de e-commerce quiere aplicar a nuestra Home y componentes compartidos, sin modificar la funcionalidad existente. Junto con las capturas de referencia, el usuario proveyó los dos assets de marca reales del negocio:

- **Logo real**: insignia circular roja con anillos concéntricos tipo diana, una flecha atravesando el centro, y texto curvo "LIBRERÍA" (arriba) / "BLANCO" (abajo) en blanco.
- **Banner hero real**: imagen ancha con textura de papel rojo, íconos de línea blancos de útiles escolares (manzana, goma, lápiz, reglas, libros, cuaderno, pizarra), y texto centrado "LIBRERIA" / "Blanco" (cursiva) / "- Sucursal Murguiondo -".

Ambos assets ya están guardados localmente (`<scratchpad>/brand-assets/logo.png` y `hero-banner.png`) y se confirmó con el usuario que son los reales, no ilustrativos.

Se auditó el código actual de los componentes compartidos del portal público (`Hero`, `Header`, `InfoBar`, `CategoryPill`, `ProductCard`, `Footer`) contra la referencia visual y se detectó que:

- `settings.logo_url` y `settings.hero_image_url` ya existen en el esquema, ya son subibles desde `/admin/configuracion` (Fase 6, vía `image-actions.ts`), pero **ningún componente del portal público los renderiza hoy** (`grep -rn "logo_url" app/(shop) components/shop/` devuelve cero resultados; `Hero` nunca lee `hero_image_url`).
- El token de color de marca (`--primary: hsl(0 72% 51%)`, rojo) ya está correctamente configurado en `app/globals.css` — no requiere cambios.
- `InfoBar`, `CategoryPill` y `Footer` son visualmente mínimos (una línea de texto, pills sin ícono, dos líneas de footer) comparado con la referencia, pero ya leen o podrían leer datos reales existentes (`categories`, `settings.address`/`phone`/`business_hours`) sin necesitar nuevo modelo de datos.

**No se toca el Admin** en esta fase, salvo el agregado puntual de 2 campos nuevos a Configuración (punto 7).

## Hallazgos fuera de esta fase (decisión explícita, no olvido)

- **Badge de "Oferta" con precio tachado**: la referencia lo muestra, pero requeriría un modelo de datos de ofertas/descuentos que no existe (§32 está fuera del MVP per §55/§56). Se omite — es un cambio de funcionalidad, no visual.
- **Nombres de categorías hardcodeados de la referencia** (ej. "Escolares", "Oficina"): `CategoryPill` sigue alimentándose 100% de la tabla `categories` real del negocio, nunca de una lista fija.
- **Rediseño del Admin**: fuera de alcance, es una fase separada.
- Todo lo que la Fase 8 ya dejó documentado como fuera de alcance (imagen de producto en negro, tabla de usuarios desbordada en mobile, etc.) sigue igual de fuera de alcance acá.

## Alcance de esta fase

### 1. `Hero` — usar `hero_image_url` como fondo real

**Problema:** `components/shop/hero.tsx` es hoy un bloque `bg-muted` centrado con título/texto/CTA, sin imagen — ignora completamente `settings.hero_image_url`, que ya es cargable desde Fase 6.

**Fix:** `Hero` recibe una prop nueva `imageUrl: string | null`. Si está presente, se renderiza como imagen de fondo (`next/image` con `fill`, o `background-image` vía CSS) con un overlay oscuro semitransparente encima para mantener el contraste de texto (blanco) legible, igual que en la referencia. Título, texto y CTA siguen 100% dinámicos (`title`/`text`/`ctaText`/`ctaLink`, con los mismos defaults `DEFAULT_TITLE`/`DEFAULT_TEXT` que hoy). Si `imageUrl` es `null` (negocio no cargó el banner), se mantiene el fondo `bg-muted` actual sin overlay — no debe romperse mientras el contenido real no esté cargado. `app/(shop)/page.tsx` pasa `imageUrl: settings?.hero_image_url ?? null`.

### 2. `Header` — logo real con fallback a texto

**Problema:** `components/shop/header.tsx` muestra únicamente el texto "Librería Blanco" como link a `/`. `settings.logo_url` nunca se lee.

**Fix:** el link del logo pasa a renderizar `<Image src={logoUrl} .../>` (alto fijo tipo `h-10 w-auto`, `next/image`) cuando `settings.logo_url` no es `null`; si es `null`, se mantiene el texto actual "Librería Blanco" como fallback — mismo criterio que `Hero`. Se agrega `logoUrl: string | null` como prop nueva de `Header`, resuelta desde `getSettings()` en el layout del shop (`app/(shop)/layout.tsx`, que ya carga `settings` para el `WhatsAppButton` del header).

### 3. `InfoBar` — de una línea a 3 columnas con ícono

**Problema:** hoy es una única línea de texto ("Retirá gratis por nuestro local · ¿Necesitás envío? Consultanos por WhatsApp") o el mensaje de mantenimiento. La referencia usa 3 columnas con ícono (envío, medio de pago, contacto).

**Fix:** cuando `storeEnabled` es `true`, `InfoBar` pasa a un grid de 3 columnas (`grid-cols-1 sm:grid-cols-3`, apiladas en mobile) cada una con un ícono de `lucide-react` (ya es dependencia del proyecto, usado en otros componentes shadcn) + texto corto:
- Ícono `Truck` — "Retirá gratis por nuestro local"
- Ícono `Banknote` — "Pago por transferencia" (mismo texto que ya usa `Footer` hoy)
- Ícono `MessageCircle` — "¿Necesitás envío? Consultanos por WhatsApp"

No se agrega ningún dato nuevo — es el mismo contenido de hoy repartido en 3 columnas con ícono en vez de una sola oración. El estado de mantenimiento (`!storeEnabled`) no cambia.

### 4. `CategoryPill` — de pill de texto a card con ícono

**Problema:** hoy es un `<Link>` con borde redondeado y texto plano. La referencia usa cards cuadradas con ícono ilustrativo por categoría.

**Fix:** `CategoryPill` pasa a una card (`rounded-lg border p-4` en vez de `rounded-full px-4 py-2`) con un ícono genérico de `lucide-react` (`Package`, el mismo para todas las categorías — no hay campo de ícono por categoría en la tabla `categories` hoy, y agregarlo sería un cambio de modelo de datos fuera de alcance) encima del nombre. Sigue recibiendo `name`/`slug` exactamente igual que hoy y sigue alimentándose de las categorías reales cargadas por `app/(shop)/page.tsx` — ningún cambio de datos ni de query.

### 5. `ProductCard` — pulido visual únicamente

**Problema:** la card actual es funcional pero visualmente básica comparada con la referencia (sombra, hover, tipografía de precio).

**Fix:** ajustes de clases Tailwind únicamente — sombra sutil con hover (`shadow-sm hover:shadow-md transition-shadow`), precio con mayor peso tipográfico. Sin agregar el badge de "Oferta" (decisión ya tomada, ver arriba). Sin cambiar la lógica de disponibilidad, el grid de 2 columnas en mobile, ni los badges "Nuevo"/"Destacado" ya arreglados en Fase 8.

### 6. `Footer` — de 2 líneas a footer completo

**Problema:** `components/shop/footer.tsx` es estático (2 `<p>`, sin leer `settings`) pese a que `address`, `phone`, `business_hours` ya están disponibles desde Fase 6/8.

**Fix:** `Footer` pasa a recibir `settings` (mismo shape ya usado en otros lugares: `businessName`, `address`, `phone`, `businessHours`, mas los 2 campos nuevos del punto 7) como props desde `app/(shop)/layout.tsx`, y renderiza 3 bloques uno al lado del otro en desktop (`grid-cols-1 md:grid-cols-3`, apilados en mobile):
- Nombre del negocio + copyright (igual que hoy).
- Navegación: links a `/productos` y `/carrito` (ya existentes en el sitio).
- Contacto: dirección, horario y teléfono (renderizado condicional `{address && <p>...}`, igual patrón que checkout/confirmación de Fase 8) + íconos de redes sociales (punto 7) si están cargados.

### 7. Nuevo, chico: campos de redes sociales en `settings`

**Fix:** se agregan 2 columnas nullable a `settings` vía nueva migración: `facebook_url text`, `instagram_url text`. Se agregan a `lib/validations/settings.ts` (`optionalText`, mismo patrón que el resto de los campos), a `components/admin/settings-form.tsx` (2 nuevos `<Input>` en la sección "Librería", después de "Email"), y a `parseSettingsForm`/`toRow` en `app/admin/(protected)/configuracion/actions.ts` (mapeo `facebookUrl`↔`facebook_url`, `instagramUrl`↔`instagram_url`), siguiendo exactamente el patrón ya usado para cada campo existente de esa sección. `Footer` los usa para mostrar íconos `Facebook`/`Instagram` de `lucide-react` como links, solo si están cargados (`null` por defecto → no se muestra nada, igual que hoy con `logo_url`/`hero_image_url` antes de esta fase).

### 8. Contenido real: subir el logo y el banner

**Acción de contenido, no de código.** Una vez que `Header` y `Hero` sepan renderizar `logo_url`/`hero_image_url` (puntos 1 y 2), el logo circular real y el banner hero real (ya guardados localmente) se cargan a producción vía la pantalla existente `/admin/configuracion` (la misma que ya usa `uploadLogo`/`uploadHeroImage` en `image-actions.ts` desde Fase 6) — no hace falta escribir código nuevo para esto, es el mismo flujo de carga de imágenes que el negocio ya usaría para cualquier otro contenido. Se hace como parte del cierre de esta fase, después de que el código correspondiente esté deployado, para verificar el resultado final contra producción.

## Archivos afectados

```
components/shop/hero.tsx                         (punto 1: imageUrl + overlay)
app/(shop)/page.tsx                               (punto 1: pasa hero_image_url)
components/shop/header.tsx                        (punto 2: logo real con fallback)
app/(shop)/layout.tsx                             (punto 2: pasa logo_url; punto 6: pasa settings a Footer)
components/shop/info-bar.tsx                      (punto 3: 3 columnas con ícono)
components/shop/category-pill.tsx                 (punto 4: card con ícono)
components/shop/product-card.tsx                  (punto 5: pulido visual)
components/shop/footer.tsx                        (punto 6: footer completo + redes sociales)
lib/validations/settings.ts                       (punto 7: facebookUrl/instagramUrl)
components/admin/settings-form.tsx                (punto 7: 2 campos nuevos)
app/admin/(protected)/configuracion/actions.ts    (punto 7: mapeo de los 2 campos nuevos)
supabase/migrations/<timestamp>_settings_redes_sociales.sql  (punto 7: 2 columnas nuevas)
types/supabase.ts                                 (punto 7: regenerar tras la migración)
```

No hay cambios a Server Actions existentes de imágenes (`image-actions.ts` no se toca — ya soporta `logo_url`/`hero_image_url` desde Fase 6), ni a la lógica de negocio de catálogo, carrito, checkout o pedidos. Ningún componente de `/checkout`, `/carrito`, `/compra-exitosa` ni del Admin (salvo el formulario de Configuración) se modifica.

## Testing

- `Hero`, `Header`, `Footer`: se ajustan sus tests existentes (si los tienen) o se agregan casos nuevos para cubrir el caso `imageUrl`/`logoUrl` presente vs. `null` (fallback), siguiendo el mismo patrón de renderizado condicional ya testeado en Fase 8 para `address`/`businessHours` en checkout.
- `InfoBar`, `CategoryPill`, `ProductCard`: cambios de solo clases/markup visual sin nueva lógica condicional relevante — no requieren test nuevo, salvo que ya tengan un test de snapshot/contenido que dependa del markup actual (se ajusta si rompe).
- Los 2 campos nuevos de `settings` (`facebook_url`/`instagram_url`) siguen el mismo patrón ya cubierto por los tests existentes de `settings-form`/`actions.ts` para el resto de los campos de texto opcionales — se extienden esos tests con los 2 casos nuevos, no se crea una suite separada.
- Sin tests de integración nuevos: no hay flujo de negocio nuevo, solo presentación.

## Autorevisión

- **Cobertura:** los 8 puntos presentados y aprobados por el usuario están cubiertos, cada uno con su archivo, su causa raíz (dato ya disponible pero no renderizado, o componente visualmente mínimo) y su fix concreto.
- **Placeholders:** ninguno — cada punto especifica el componente, la prop nueva (si aplica) y el criterio de fallback cuando el dato no está cargado.
- **Ambigüedad resuelta:** el ícono de `CategoryPill` es genérico (no por-categoría) porque agregar un campo de ícono a la tabla `categories` sería un cambio de modelo de datos, fuera del alcance "sin modificar funcionalidad" que pidió el usuario explícitamente.
- **Consistencia con fases previas:** el patrón de "prop nueva + fallback a `null`" es idéntico al ya usado en Fase 8 para `address`/`businessHours`/`pickupInstructionsText`; el patrón de "nueva columna en `settings`" (punto 7) es idéntico al usado en cada fase anterior que agregó un campo de configuración.
