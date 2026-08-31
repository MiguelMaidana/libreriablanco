<!--
╔══════════════════════════════════════════════════════════════╗
║           TSOFT AI Dev Kit — AGENTS.md                      ║
║                                                              ║
║  Este archivo es el contexto global del proyecto para        ║
║  todos los agentes del kit. Completalo antes de invocar      ║
║  cualquier agente por primera vez.                           ║
║                                                              ║
║  CÓMO LLENARLO — hay tres formas:                            ║
║                                                              ║
║  1. Pedile a Codex que lo genere automáticamente:            ║
║     "Analizá la estructura de este repositorio y completá    ║
║      el AGENTS.md con lo que encontrés"                      ║
║     Funciona bien en proyectos con código existente.         ║
║                                                              ║
║  2. Completarlo a mano usando las secciones de abajo         ║
║     como guía. Recomendado para proyectos nuevos o cuando    ║
║     querés más control sobre el contexto que leen los        ║
║     agentes.                                                 ║
║                                                              ║
║  3. Combinado: Codex genera el borrador, vos lo revisás      ║
║     y ajustás. Es la mejor práctica en la mayoría de         ║
║     los casos.                                               ║
║                                                              ║
║  REGLAS:                                                     ║
║  - Sé específico. "Usamos buenas prácticas" no ayuda.        ║
║    "Todas las funciones async usan try/catch con logs        ║
║    en el catch" sí ayuda.                                    ║
║  - Actualizalo cuando el proyecto cambie. Si cambia la       ║
║    arquitectura o se agrega una convención nueva, este       ║
║    archivo debe reflejarlo.                                  ║
║  - No pongas información sensible (tokens, passwords,        ║
║    datos de producción).                                     ║
║  - La sección "Convención de features" viene completa y      ║
║    es igual en todos los proyectos: no la edites.            ║
╚══════════════════════════════════════════════════════════════╝
-->

# AGENTS.md — Librería Blanco

> Contexto global del proyecto para el TSOFT AI Dev Kit.
> Leído por todos los agentes antes de ejecutar cualquier tarea.
> Última actualización: 2026-08-31

---

## Convención de features — estándar del kit, no editar

Toda feature usa **un único nombre** en los tres lugares donde aparece:

```
docs/[feature]/          material de la feature (uno o varios archivos)
tsoft-dev/[feature]/     archivos de trabajo del kit
$orquestador [feature]   invocación, con el nombre pelado
```

Ejemplo correcto:

```
docs/cambio-de-color/brief.md
docs/cambio-de-color/mockup.png
tsoft-dev/cambio-de-color/
$orquestador cambio-de-color
```

Reglas:

- La carpeta de `docs/` **es** el nombre de la feature. Puede contener varios
  archivos; el Explorador los lee todos.
- Al invocar se escribe el nombre pelado: **sin** `docs/`, **sin** barra final
  y **sin** extensión.
- El nombre no se traduce, ni se abrevia, ni se "corrige" entre pasos, ni se
  cambia a mitad del trabajo.

Por qué importa: la medición de consumo registra literalmente el texto que
sigue a `$orquestador`, y busca el estado del flujo en
`tsoft-dev/[feature]/orquestador-estado.md`. Si el nombre tipeado no coincide
con la carpeta, esa feature aparece partida en varias filas del reporte y sin
estado. El reconciliador normaliza rutas como red de seguridad, pero no puede
adivinar un nombre mal escrito.

---

## Descripción del proyecto

<!-- Qué hace este proyecto, para qué cliente, cuál es su propósito.
     2-4 oraciones. -->

Plataforma integral de e-commerce y backoffice para Librería Blanco: un
portal público sin login para comprar como invitado (retiro en local,
pago por transferencia + comprobante por WhatsApp) y un backoffice
administrativo (`/admin`) para gestionar catálogo, precios, pedidos y
clientes. Única aplicación Next.js full-stack sobre Supabase, desplegada
en Vercel. Fuente de verdad funcional completa:
`docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`.

---

## Stack tecnológico

<!-- Listá las tecnologías principales con sus versiones.
     Ejemplo:
     - Next.js 15.2
     - TypeScript 5.4
     - PostgreSQL 16 (via Prisma 5.x)
     - Tailwind CSS 3.4
-->

- Next.js 16 (App Router)
- TypeScript 6 (strict)
- React 19
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth, Storage) vía @supabase/ssr
- Vitest + Testing Library
- ESLint 9 (config Next) + Prettier
- pnpm
- Vercel (hosting)

---

## Estructura de carpetas

<!-- Describí las carpetas principales y qué responsabilidad tiene cada una.
     No hace falta listar todo — solo lo que no es obvio.
     Ejemplo:
     /src/app          → rutas y páginas (Next.js App Router)
     /src/components   → componentes reutilizables
     /src/lib          → utilidades y helpers
     /src/services     → lógica de negocio y llamadas a APIs externas
     /src/types        → tipos TypeScript compartidos
-->

/app                    → rutas (App Router): portal público en la raíz,
                           backoffice bajo /admin (desde Fase 2), API
                           routes bajo /app/api
/components/ui          → componentes base de shadcn/ui, no editar a mano
                           salvo necesidad real (regenerar con la CLI)
/components/store        → componentes específicos del portal público
                           (desde Fase 3)
/components/admin        → componentes específicos del backoffice
                           (desde Fase 2)
/lib/supabase            → clientes de Supabase (browser y servidor)
/lib/validations         → esquemas de validación compartidos (desde
                           Fase 1)
/types                   → tipos compartidos, incluyendo los generados
                           por Supabase CLI

---

## Convenciones de código

<!-- Las reglas que todos los archivos deben seguir.
     Sé específico — estas son las instrucciones que el Desarrollador
     va a respetar al pie de la letra.

     Ejemplos de lo que va acá:
     - Nombres de archivos: kebab-case para componentes, camelCase para utils
     - Nombres de funciones: verbos en infinitivo (getUser, createOrder)
     - Manejo de errores: siempre try/catch con log en el catch
     - Imports: absolutos desde /src, nunca relativos de más de un nivel
     - Tipado: strict mode activo, no usar any
-->

- Componentes: PascalCase, un componente por archivo, kebab-case en el
  nombre de archivo (`product-card.tsx` exporta `ProductCard`).
- Funciones y utilidades: camelCase, verbos en infinitivo
  (`getProducts`, `createOrder`).
- Imports: siempre con el alias `@/*` desde la raíz, nunca relativos de
  más de un nivel (`../../`).
- TypeScript estricto activo (`strict: true`,
  `noUncheckedIndexedAccess: true`); `any` prohibido (regla de ESLint en
  error, no warning).
- Todo texto de interfaz en español, corto y sin tecnicismos (spec
  maestra §103) — ver ejemplos en esa sección antes de escribir copy.
- Tests co-ubicados junto al archivo que testean
  (`archivo.ts` + `archivo.test.ts`).

---

## Patrones de arquitectura

<!-- Cómo está organizado el código a nivel lógico.
     Ejemplos de lo que va acá:
     - Separación de responsabilidades: controllers → services → repositories
     - Cómo se manejan los estados (Redux, Zustand, Context, etc.)
     - Cómo se hacen las llamadas a APIs externas
     - Cómo se validan los datos de entrada
     - Cómo se manejan las respuestas de error hacia el cliente
-->

En esta fase (Fundaciones) todavía no hay lógica de negocio, así que
no hay patrones de dominio que documentar. Lo que sí queda establecido
y debe respetarse en las fases siguientes:

- Server Components por defecto; un componente pasa a Client Component
  (`"use client"`) solo cuando necesita interactividad o hooks del
  navegador (ejemplo: `app/error.tsx`).
- Dos clientes de Supabase separados por contexto de ejecución:
  `lib/supabase/client.ts` (browser, Client Components) y
  `lib/supabase/server.ts` (Server Components y Route Handlers, usa
  cookies de sesión). Nunca mezclar uno con el otro.
- El servidor nunca muestra un error técnico crudo al usuario — ver
  `app/error.tsx` y `app/not-found.tsx`. Este patrón se repite a medida
  que se agreguen Server Actions en fases futuras.

Esta sección se completa con los patrones reales de datos, validación
y manejo de mutaciones cuando la Fase 1 (modelo de datos + Auth Admin)
los defina.

---

## Convenciones de base de datos

<!-- Solo si el proyecto tiene base de datos.
     Ejemplos:
     - ORM: Prisma con migraciones versionadas
     - Nombres de tablas: snake_case en plural (users, order_items)
     - Nunca modificar datos directamente — siempre via repository
     - Campos de auditoría obligatorios: created_at, updated_at
-->

- Motor: Postgres vía Supabase, sin ORM — queries con el cliente de
  `@supabase/ssr` y tipos generados por Supabase CLI.
- Nombres de tablas: snake_case en plural (`products`, `order_items`).
- RLS habilitado en toda tabla de negocio; documentar explícitamente qué
  puede leer el público anónimo y qué requiere sesión de admin.
- Nunca aceptar precio, total, descuento o stock enviados por el
  navegador como fuente de verdad — siempre recalcular en servidor (spec
  maestra §67).
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en código de servidor que
  explícitamente necesita bypassear RLS; nunca en Client Components ni en
  variables `NEXT_PUBLIC_*`.

---

## Testing

<!-- Cómo se testea este proyecto.
     Ejemplos:
     - Framework: Vitest + Testing Library
     - Los tests van en __tests__/ dentro de cada módulo
     - Nomenclatura: [nombre-del-archivo].test.ts
     - Mocks: se generan con vi.mock(), no con datos hardcodeados
-->

- Framework: Vitest + Testing Library (jsdom).
- Convención de nombres: `[archivo].test.ts` / `.test.tsx`, co-ubicado.
- Mocks de Supabase: mockear el módulo `@/lib/supabase/server` o
  `@/lib/supabase/client` con `vi.mock`, nunca pegarle a una base real
  desde un test automatizado.

---

## Lo que nunca se debe hacer

<!-- Prohibiciones explícitas. Las cosas que si el agente hace
     van a romper algo o violar una política del cliente.
     Ejemplos:
     - No commitear archivos .env
     - No modificar archivos en /legacy sin aprobación explícita
     - No usar fetch directo — siempre usar el wrapper en /src/lib/api
     - No agregar dependencias nuevas sin aprobación del IA Maker
-->

- No commitear `tsoft-dev/metrics/` ni `tsoft-dev/reportes/`: contienen los
  prompts, rutas y comandos reales de las sesiones.
- No commitear `.env.local` ni ningún archivo con credenciales reales.
- No crear una aplicación separada para admin y tienda — es una sola app
  Next.js (spec maestra §2.1).
- No implementar stock cuantitativo, Mercado Pago, ARCA ni cuenta de
  cliente en el MVP — están explícitamente fuera de alcance (spec
  maestra §68).
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en código de cliente.

---

## Skills disponibles

<!-- Lista de skills activas en .codex/skills/ que los agentes pueden usar.
     Se actualiza cada vez que se agrega una skill nueva al proyecto.
     Para ver las skills cargadas escribí /skills en el chat de Codex.
     Ejemplo:
     - backend-api         → convenciones para crear endpoints REST
     - frontend-components → cómo construir componentes React
     - db-queries          → patrones para queries con el ORM del proyecto
-->

- `orquestador` → flujo principal del kit para ejecutar una feature con Human
  in the Loop
- `reporte-ejecucion` → genera los reportes de consumo
- [Completar a medida que se agregan skills al proyecto]

---

*TSOFT AI Dev Kit · Codex · v1.0*

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
