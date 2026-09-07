# Librería Blanco

E-commerce + backoffice administrativo para una librería/papelería de barrio en Argentina. Portal público de catálogo con compra sin login (transferencia + retiro en local, coordinación por WhatsApp), y un panel de administración con gestión de productos, categorías, pedidos, clientes, configuración del negocio y usuarios/roles con permisos granulares.

Deployado en producción: **https://libreriablanco.vercel.app**

## Stack tecnológico

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (sobre Radix UI)
- **Supabase**: Postgres + Auth + Storage. Cliente vía `@supabase/supabase-js` y `@supabase/ssr`
- **Zod v4** para validación
- **Vitest** + **Testing Library** para tests
- **pnpm** como package manager
- **Vercel** como plataforma de deploy

## Puesta en marcha local

```bash
pnpm install
cp .env.local.example .env.local   # completar con las credenciales de Supabase
pnpm dev
```

Variables de entorno requeridas (`.env.local`):

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Key pública, usada por el cliente de sesión normal |
| `SUPABASE_SERVICE_ROLE_KEY` | Key privilegiada, **solo server-side** — usada para operaciones que necesitan bypassear RLS (Auth Admin API, algunas escrituras de RBAC) |

## Scripts

```bash
pnpm dev         # servidor de desarrollo
pnpm build       # build de producción (Turbopack)
pnpm lint        # eslint . --max-warnings 0
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run (suite completa)
pnpm format      # prettier
```

## Estructura del proyecto

```
app/(shop)/...            rutas públicas del e-commerce
app/admin/...              rutas del panel administrativo (protegidas por sesión + permisos)
components/                componentes de UI, separados en shop/ y admin/
lib/                        lógica de dominio (auth, admin, shop, validaciones, supabase clients)
supabase/migrations/        migraciones SQL, en orden cronológico
docs/                       documentación (este directorio)
```

## Documentación

- **[Documentación técnica completa](docs/DOCUMENTACION_TECNICA.md)** — arquitectura, esquema de base de datos, modelo de autorización (RBAC), patrones de código, testing, deploy.
- **[Documentación funcional completa](docs/DOCUMENTACION_FUNCIONAL.md)** — recorrido de cada pantalla y flujo, con capturas de pantalla reales de producción, para el portal público y el panel administrativo.
- **[Spec maestra del producto](docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md)** — la especificación funcional original que guio todo el desarrollo.
- **[Historial de diseño e implementación](docs/superpowers/)** — specs y planes de cada fase de desarrollo (proceso brainstorming → spec → plan → implementación → revisión).

## Estado del proyecto

El MVP definido en la spec maestra (§55) está completo y en producción: catálogo, categorías, precios/costos, compra sin login, gestión de pedidos, clientes, dashboard, usuarios administrativos con roles y permisos dinámicos, y configuración del negocio.

Explícitamente fuera de este alcance (ver spec maestra §56, "Fase posterior"): integración de Mercado Pago, facturación electrónica (ARCA), stock cuantitativo/inventario, cuenta de cliente, envíos automáticos, punto de venta físico, proveedores/compras.

## Deploy

El deploy a producción en Vercel está configurado para disparar desde la rama `main` de este repositorio. El desarrollo activo ocurre en la rama `nueva-ui`; para deployar a producción hace falta empujar a ambas:

```bash
git push origin nueva-ui
git push origin nueva-ui:main
```
