# Fase 0 — Fundaciones — Diseño

> **Proyecto:** Librería Blanco (plataforma e-commerce + backoffice)
> **Fase:** 0 de 7 — Fundaciones
> **Fuente de verdad funcional:** `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`
> **Estado:** Aprobado por el IA Maker el 2026-08-30

## 1. Contexto

Librería Blanco necesita una única aplicación Next.js full-stack (e-commerce
público + backoffice administrativo) sobre Supabase, desplegada en Vercel,
según la especificación maestra del producto. El repositorio hoy solo
contiene tooling de un kit de desarrollo (`tsoft-dev/`, `.codex/`, scripts
`.ps1`) pero ninguna aplicación.

El proyecto completo se decidió dividir en 7 fases (ver acuerdo en la sesión
de brainstorming previa a este documento). Esta spec cubre únicamente la
**Fase 0: Fundaciones** — el esqueleto técnico sobre el que se construirán
todas las fases siguientes. No incluye ninguna tabla de negocio ni pantalla
real de tienda o admin.

## 2. Objetivo de la fase

Dejar corriendo, en producción (Vercel), una aplicación Next.js en blanco
con:

- El sistema de diseño base instalado y con la identidad visual de
  Librería Blanco aplicada a nivel de tokens.
- Conexión funcional a Supabase (sin tablas de negocio todavía).
- Convenciones de código, testing y estructura de carpetas listas para que
  las fases siguientes las usen sin tener que re-decidir nada estructural.

Criterio de éxito: una página de inicio mínima, deployada en Vercel, que
renderiza componentes del design system con la paleta/tipografía correctas,
y que puede leer datos reales desde Supabase (por ejemplo, una tabla de
prueba `_healthcheck`) tanto en Server Component como en un Route Handler.

## 3. Fuera de alcance de esta fase

- Cualquier tabla de dominio (`products`, `customers`, `orders`, etc.) —
  Fase 1.
- Autenticación de administradores — Fase 1.
- Cualquier pantalla real de tienda o admin — Fases 2 a 6.
- Integraciones externas (WhatsApp, Mercado Pago, ARCA) — evolutivos,
  fuera del MVP completo.

## 4. Referencia visual y decisiones de identidad

Se inspeccionó la referencia mencionada en la spec maestra (§35):
`https://blanco-shelf.lovable.app/`, tanto en desktop como en mobile
(390px). Es una implementación shadcn/ui (usa exactamente esa convención de
variables CSS en HSL), lo que valida directamente el enfoque técnico
elegido para el design system.

### 4.1 Tokens extraídos de la referencia

| Token | Valor | Uso |
|---|---|---|
| `--background` | `hsl(0 0% 99%)` | Fondo general |
| `--foreground` | `hsl(0 0% 12%)` | Texto principal |
| `--primary` | `hsl(0 72% 51%)` | Marca, CTAs, links activos |
| `--primary-foreground` | `hsl(0 0% 100%)` | Texto sobre primary |
| `--secondary` | `hsl(0 0% 96%)` | Fondos secundarios |
| `--muted` | `hsl(0 0% 95%)` | Fondos apagados |
| `--muted-foreground` | `hsl(0 0% 45%)` | Texto secundario |
| `--accent` | `hsl(0 85% 96%)` | Fondos de badges/hover suaves |
| `--accent-foreground` | `hsl(0 72% 41%)` | Texto sobre accent |
| `--destructive` | `hsl(0 84.2% 60.2%)` | Acciones destructivas |
| `--border` / `--input` | `hsl(0 0% 90%)` | Bordes |
| `--ring` | `hsl(0 72% 51%)` | Focus ring |
| `--radius` | `0.5rem` | Radio base de todos los componentes |
| card shadow | `0 2px 12px -2px hsl(0 0% 0% / .08)` | Sombra de card en reposo |
| card shadow hover | `0 8px 24px -4px hsl(0 0% 0% / .12)` | Sombra de card en hover |
| Tipografía de títulos | **Montserrat**, peso 900 | H1/H2/hero |
| Tipografía de cuerpo | **Open Sans** | Texto general |

Estos valores se cargan como variables CSS de shadcn/ui en `app/globals.css`
(modo claro únicamente en el MVP; no se pidió dark mode en la spec maestra).

### 4.2 Patrones visuales a reutilizar

- Barra informativa compacta debajo del header, con 3 íconos + texto corto.
- Badges de estado sólidos: rojo = oferta, verde = nuevo.
- Cards de producto con sombra suave, imagen 1:1, precio destacado en negro
  y CTA rojo de "Agregar al carrito" (se construirán en fases posteriores;
  acá solo se deja el token/estilo base).
- Categorías como tiles cuadrados con ícono + nombre.

### 4.3 Desviación intencional respecto a la referencia

La referencia muestra "Envíos y retiro en local" en la barra informativa.
El MVP de la spec maestra (§7, §58) **no ofrece envío gestionado por la
plataforma** — solo retiro en local, con consulta de envío por WhatsApp.
Cuando se construya esa barra (Fase 3), el texto real será del estilo
"Retiro en el local · ¿Necesitás envío? Consultanos por WhatsApp", nunca
"Envíos y retiro en local". Se documenta acá para que no se copie el texto
de la referencia sin pensarlo.

## 5. Decisiones técnicas

| Decisión | Elección | Motivo |
|---|---|---|
| Framework | Next.js 15, App Router | No negociable (spec §2.2) |
| Lenguaje | TypeScript estricto | No negociable (spec §2.2, §65) |
| Estilos / componentes | Tailwind CSS + shadcn/ui | Cubre exactamente la lista de componentes de la spec §102 (Button, Input, Select, Checkbox, Radio, Switch, Card, Badge, Alert, Modal, Drawer, Table, Tabs, Toast, Skeleton) con accesibilidad (Radix) ya resuelta, y coincide con la convención de variables de la referencia visual |
| Backend / datos | Supabase (Postgres + Auth + Storage) vía `@supabase/ssr` | No negociable (spec §2.2, §39) |
| Package manager | pnpm | Rápido, buen soporte nativo en Vercel |
| Testing | Vitest + Testing Library | Liviano, integración directa con Vite/Next, sin infraestructura adicional |
| Lint/format | ESLint (config Next) + Prettier | Evitar `any`, consistencia (spec §65) |
| Hosting | Vercel, proyecto nuevo conectado a GitHub | No negociable (spec §2.2) |
| Ubicación del código | Raíz del repositorio | Ya decidido — convive con `tsoft-dev/`, `.codex/`, scripts `.ps1` existentes sin conflicto (no comparten namespace de archivos) |

## 6. Estructura de carpetas (Fase 0)

Basada en la estructura orientativa de la spec maestra (§4), simplificada a
lo que existe en esta fase:

```text
app/
  layout.tsx              # layout raíz, fuentes (Montserrat + Open Sans)
  globals.css             # tokens de diseño (variables shadcn/ui)
  page.tsx                # home mínima de verificación (temporal)
  api/
    healthcheck/route.ts  # Route Handler que confirma conexión a Supabase

components/
  ui/                      # componentes shadcn/ui generados (button, card, badge, etc.)

lib/
  supabase/
    client.ts              # cliente Supabase para browser
    server.ts               # cliente Supabase para Server Components / Route Handlers

.env.local.example
.env.local                  # no versionado
```

`components/store`, `components/admin`, `services/`, `lib/validations/`,
etc. de la estructura orientativa de la spec se crean cuando la fase que
los necesita los use — no se generan carpetas vacías por adelantado.

## 7. Supabase — patrón de conexión (sin datos de negocio)

- Dos clientes, siguiendo el patrón oficial de `@supabase/ssr`:
  - `lib/supabase/client.ts`: cliente para Client Components (usa
    `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
  - `lib/supabase/server.ts`: cliente para Server Components y Route
    Handlers, manejando cookies de sesión (necesario para Fase 1 - Auth
    Admin, aunque en F0 todavía no hay login).
- La `SUPABASE_SERVICE_ROLE_KEY` se deja documentada en
  `.env.local.example` pero **no se usa en ningún código de esta fase** —
  se reserva para operaciones de servidor de fases posteriores que la
  necesiten explícitamente (spec §40, §64: nunca exponer esta key al
  cliente).
- Verificación de esta fase: una tabla trivial `_healthcheck` (una fila) se
  crea manualmente en el proyecto de Supabase y se lee desde:
  - Un Server Component (`app/page.tsx`), y
  - Un Route Handler (`app/api/healthcheck/route.ts`).

  Esta tabla y su verificación se eliminan al cerrar la Fase 0 (no forma
  parte del modelo de datos real, que empieza en Fase 1).

## 8. Variables de entorno

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # reservada, no usada en F0
```

Documentadas en `.env.local.example`, nunca commiteadas con valores reales
(spec §64). Se configuran también como variables de entorno del proyecto
en Vercel (Production + Preview).

## 9. Testing (Fase 0)

- Vitest configurado con soporte de React Testing Library.
- Un test mínimo por convención: renderizado del layout raíz y de un
  componente `ui/` (por ejemplo, `Button`), para dejar el patrón de test
  establecido antes de que las fases siguientes agreguen lógica de negocio.
- No se testea el healthcheck de Supabase con un test automatizado (requiere
  credenciales reales); se verifica manualmente antes de cerrar la fase.

## 10. Errores y estados

No aplica todavía manejo de errores de negocio (no hay negocio en esta
fase). Sí se deja configurado:

- Página `not-found.tsx` y `error.tsx` mínimas a nivel raíz, con estilo del
  design system (para no dejar las pantallas default de Next.js), ya que
  toda pantalla debe evitar errores técnicos crudos (spec §47).

## 11. Despliegue

- Repositorio conectado a un proyecto nuevo de Vercel.
- Variables de entorno cargadas en Vercel antes del primer deploy.
- Un deploy de producción exitoso es parte del criterio de cierre de la
  fase.

## 12. Criterio de aceptación de la Fase 0

- [ ] `pnpm dev` levanta la app localmente sin errores.
- [ ] La home renderiza tipografía (Montserrat/Open Sans) y color primario
      correctos, con al menos un componente shadcn/ui visible (ej. un
      `Button` con la variante primaria).
- [ ] La home (Server Component) y `/api/healthcheck` (Route Handler)
      leen correctamente la fila de `_healthcheck` desde Supabase.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan sin errores.
- [ ] La app está deployada en Vercel (producción) y accesible por URL.
- [ ] `AGENTS.md` queda completado con la info real del proyecto (stack,
      estructura, convenciones) para que sirva de contexto a futuras
      sesiones, tanto de Claude Code como del kit de Codex si se usa en
      paralelo.
- [ ] La tabla `_healthcheck` y el código que la usa se eliminan antes de
      dar la fase por cerrada.

## 13. Riesgos / decisiones que quedan abiertas para fases siguientes

- No se decide en esta fase ninguno de los puntos pendientes de la spec
  maestra §72 (dirección de retiro, datos de transferencia, número de
  WhatsApp, nombre definitivo de "destacados", etc.) — no bloquean la
  Fase 0 y se resuelven cuando la fase que los necesita llegue (Fase 3 en
  adelante, mayormente vía Configuración).
- El dark mode no está contemplado; si se pidiera más adelante, es un
  cambio aditivo sobre los tokens ya definidos, no una reestructuración.
