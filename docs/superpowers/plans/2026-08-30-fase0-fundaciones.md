# Fase 0 — Fundaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up, in production on Vercel, a Next.js skeleton for Librería
Blanco with the design system tokens applied and a working Supabase
connection — no business tables or real screens yet.

**Architecture:** Single Next.js 15 App Router application at the repo
root, TypeScript strict, Tailwind CSS v4 + shadcn/ui for the component
layer, `@supabase/ssr` for the Supabase browser/server clients, Vitest +
Testing Library for tests. Deployed to Vercel via the CLI (no Git remote
exists yet — see Task 11).

**Tech Stack:** Next.js 15 (App Router), TypeScript, React 19, Tailwind
CSS v4, shadcn/ui, `@supabase/ssr`, Vitest, @testing-library/react, ESLint
9 (flat config), Prettier, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-30-fase0-fundaciones-design.md`
(and, for the product as a whole, `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`)

## Global Constraints

- Una única aplicación Next.js full-stack, en la raíz del repositorio — no
  crear apps separadas para tienda y admin (spec maestra §2.1).
- TypeScript estricto, evitar `any` (spec maestra §2.2, §65).
- Nunca commitear secretos; `SUPABASE_SERVICE_ROLE_KEY` nunca se usa ni se
  expone en código de cliente (spec maestra §40, §64).
- El usuario nunca debe ver errores técnicos crudos — siempre mensajes
  entendibles (spec maestra §47).
- No crear carpetas ni abstracciones para necesidades futuras que esta
  fase no tiene (spec maestra §65; spec de fase §3, §6).
- Todo texto de interfaz va en español, corto y sin tecnicismos (spec
  maestra §103).

---

## File Structure

```text
package.json
tsconfig.json
next.config.ts
postcss.config.mjs
components.json                # config de shadcn/ui
vitest.config.ts
vitest.setup.ts
eslint.config.mjs
.prettierrc.json
.gitignore
.env.local.example
.env.local                      # no versionado

app/
  layout.tsx                    # RootLayout: fuentes + tokens
  globals.css                   # tokens de diseño (Tailwind v4 @theme)
  page.tsx                      # home de verificación del design system
  page.test.tsx
  not-found.tsx
  not-found.test.tsx
  error.tsx
  error.test.tsx
  api/
    healthcheck/
      route.ts
      route.test.ts

components/
  ui/                            # generado por shadcn/ui (button, card, badge, etc.)

lib/
  utils.ts                       # cn() — generado por shadcn/ui init
  supabase/
    client.ts
    client.test.ts
    server.ts
    server.test.ts
```

---

### Task 1: Scaffold del proyecto Next.js con Tailwind CSS v4

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `next-env.d.ts`
- Create: `postcss.config.mjs`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`

**Interfaces:**
- Consumes: nada (primer task).
- Produces: script `pnpm dev` / `pnpm build` / `pnpm start` funcionando;
  alias de import `@/*` apuntando a la raíz; `app/layout.tsx` exportando
  `RootLayout({ children })`; `app/globals.css` con Tailwind importado.

- [ ] **Step 1: Inicializar package.json**

Correr en la raíz del repo:

```bash
pnpm init
```

- [ ] **Step 2: Editar package.json**

Reemplazar el contenido generado por:

```json
{
  "name": "libreria-blanco",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

- [ ] **Step 3: Instalar dependencias de runtime**

```bash
pnpm add next react react-dom
```

- [ ] **Step 4: Instalar dependencias de desarrollo (TypeScript + Tailwind v4)**

```bash
pnpm add -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss
```

- [ ] **Step 5: Crear tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Crear next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 7: Crear postcss.config.mjs (Tailwind v4)**

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 8: Crear app/globals.css**

```css
@import "tailwindcss";
```

- [ ] **Step 9: Crear app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Librería Blanco",
  description: "Útiles, papelería y más — Librería Blanco",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Crear app/page.tsx (placeholder temporal)**

```tsx
export default function HomePage() {
  return <main>Librería Blanco</main>;
}
```

- [ ] **Step 11: Crear .gitignore**

```text
node_modules
.next
.env*.local
.vercel
*.tsbuildinfo
next-env.d.ts
coverage
```

- [ ] **Step 12: Verificar que el proyecto compila**

```bash
pnpm exec next build
```

Expected: build exitoso, sin errores de TypeScript ni de Tailwind.
(`next-env.d.ts` se genera automáticamente en este paso; por eso está en
`.gitignore` y no se crea a mano.)

- [ ] **Step 13: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs .gitignore app/
git commit -m "feat: scaffold Next.js 15 + TypeScript + Tailwind v4"
```

---

### Task 2: ESLint estricto + Prettier

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json` (agregar scripts `lint`, `format`, `typecheck`)

**Interfaces:**
- Consumes: `tsconfig.json` de Task 1.
- Produces: script `pnpm lint` y `pnpm typecheck` usados por todas las
  tareas siguientes como paso de verificación.

- [ ] **Step 1: Instalar dependencias de lint/format**

```bash
pnpm add -D eslint eslint-config-next @eslint/eslintrc prettier eslint-config-prettier
```

- [ ] **Step 2: Crear eslint.config.mjs**

```javascript
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
```

- [ ] **Step 3: Crear .prettierrc.json**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 80
}
```

- [ ] **Step 4: Crear .prettierignore**

```text
.next
node_modules
pnpm-lock.yaml
```

- [ ] **Step 5: Agregar scripts a package.json**

Agregar dentro de `"scripts"`:

```json
"lint": "eslint .",
"format": "prettier --write .",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 6: Verificar**

```bash
pnpm lint
pnpm typecheck
```

Expected: ambos comandos terminan sin errores (puede haber cero archivos
para lintear más allá de `app/`, eso es correcto en esta etapa).

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs .prettierrc.json .prettierignore package.json pnpm-lock.yaml
git commit -m "chore: configurar ESLint estricto y Prettier"
```

---

### Task 3: Vitest + Testing Library

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/page.test.tsx`
- Modify: `package.json` (agregar script `test`)

**Interfaces:**
- Consumes: `app/page.tsx` de Task 1 (componente `HomePage`).
- Produces: script `pnpm test`; convención de test co-ubicado
  (`archivo.test.tsx` junto al archivo que testea) que usan todas las
  tareas siguientes.

- [ ] **Step 1: Instalar dependencias de testing**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/dom
```

- [ ] **Step 2: Crear vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Crear vitest.setup.ts**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Escribir el test (falla primero)**

`app/page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("muestra el nombre de la librería", () => {
    render(<HomePage />);
    expect(screen.getByText("Librería Blanco")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Agregar script y correr el test**

Agregar a `package.json`:

```json
"test": "vitest run"
```

```bash
pnpm test
```

Expected: PASS — `app/page.tsx` (Task 1) ya renderiza exactamente ese
texto, así que este test confirma que la infraestructura de test funciona
de punta a punta, no que falte implementación.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts app/page.test.tsx package.json pnpm-lock.yaml
git commit -m "chore: configurar Vitest y Testing Library"
```

---

### Task 4: shadcn/ui — instalar el set base de componentes

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Create: `components/ui/button.tsx`, `input.tsx`, `select.tsx`,
  `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `card.tsx`, `badge.tsx`,
  `alert.tsx`, `dialog.tsx`, `sheet.tsx`, `table.tsx`, `tabs.tsx`,
  `sonner.tsx`, `skeleton.tsx` (generados por la CLI de shadcn/ui)
- Modify: `app/globals.css` (la CLI agrega las variables base de shadcn)

**Interfaces:**
- Consumes: `postcss.config.mjs` / `app/globals.css` de Task 1.
- Produces: componentes en `components/ui/*` con nombres de export
  estándar de shadcn/ui (`Button`, `Card`, `CardContent`, `Badge`, etc.)
  que Task 6 usa directamente; helper `cn()` en `lib/utils.ts`.

- [ ] **Step 1: Crear components.json (config no interactiva)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Agregar el set base de componentes**

```bash
pnpm dlx shadcn@latest add button input select checkbox radio-group switch card badge alert dialog sheet table tabs sonner skeleton --yes
```

Si la CLI pide inicializar el proyecto en lugar de agregar componentes
directamente (versiones distintas de la CLI se comportan diferente),
correr primero `pnpm dlx shadcn@latest init -d` y repetir el comando de
`add` de arriba.

- [ ] **Step 3: Verificar que compila**

```bash
pnpm typecheck
pnpm exec next build
```

Expected: sin errores. `components/ui/` debe contener los 15 archivos
listados arriba y `lib/utils.ts` debe exportar una función `cn`.

- [ ] **Step 4: Commit**

```bash
git add components.json lib/utils.ts components/ui/ app/globals.css package.json pnpm-lock.yaml
git commit -m "feat: instalar set base de componentes shadcn/ui"
```

---

### Task 5: Tokens de diseño de Librería Blanco + tipografía

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: variables de shadcn/ui generadas en Task 4 dentro de
  `app/globals.css`.
- Produces: variables `--font-sans` / `--font-heading` disponibles en
  `<body>` (usadas por Task 6 y todas las pantallas futuras); paleta
  actualizada según la sección 4.1 de la spec de fase.

- [ ] **Step 1: Reemplazar el bloque de tokens de color en app/globals.css**

Ubicar el bloque `:root { ... }` y `.dark { ... }` que generó shadcn/ui
dentro de `@layer base` (o el bloque `@theme inline` según la versión de
la CLI) y reemplazar únicamente los valores de color por los de la
referencia visual de Librería Blanco. El archivo debe quedar con este
bloque `:root` (dejar el resto de la estructura que generó la CLI —
`@theme inline`, `@layer base`, etc. — intacta, solo se editan los
valores):

```css
:root {
  --radius: 0.5rem;
  --background: hsl(0 0% 99%);
  --foreground: hsl(0 0% 12%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(0 0% 12%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(0 0% 12%);
  --primary: hsl(0 72% 51%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(0 0% 96%);
  --secondary-foreground: hsl(0 0% 12%);
  --muted: hsl(0 0% 95%);
  --muted-foreground: hsl(0 0% 45%);
  --accent: hsl(0 85% 96%);
  --accent-foreground: hsl(0 72% 41%);
  --destructive: hsl(0 84.2% 60.2%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(0 0% 90%);
  --input: hsl(0 0% 90%);
  --ring: hsl(0 72% 51%);
}
```

No se define un bloque `.dark` con valores propios: la spec maestra no
pide modo oscuro para el MVP (queda documentado como no-objetivo en la
spec de fase, sección 13).

- [ ] **Step 2: Agregar variables de tipografía y sombras al final de app/globals.css**

```css
@layer base {
  :root {
    --font-heading: "Montserrat", sans-serif;
    --font-sans: "Open Sans", sans-serif;
    --card-shadow: 0 2px 12px -2px hsl(0 0% 0% / 0.08);
    --card-shadow-hover: 0 8px 24px -4px hsl(0 0% 0% / 0.12);
  }

  body {
    font-family: var(--font-sans);
  }

  h1,
  h2,
  h3 {
    font-family: var(--font-heading);
    font-weight: 900;
  }
}
```

- [ ] **Step 3: Cargar las fuentes reales con next/font en app/layout.tsx**

```tsx
import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-montserrat",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "Librería Blanco",
  description: "Útiles, papelería y más — Librería Blanco",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${montserrat.variable} ${openSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Apuntar los tokens de fuente a las variables reales de next/font**

En `app/globals.css`, dentro del bloque `:root` agregado en el Step 2,
cambiar los valores para usar las variables inyectadas por `next/font`:

```css
--font-heading: var(--font-montserrat), sans-serif;
--font-sans: var(--font-open-sans), sans-serif;
```

- [ ] **Step 5: Verificación manual (no hay test automatizado de CSS)**

```bash
pnpm dev
```

Abrir `http://localhost:3000`, confirmar visualmente con las devtools que
`body` usa Open Sans y que un `<h1>` (se agrega en Task 6) usaría
Montserrat en negrita. Este paso es manual porque jsdom (usado por
Vitest) no ejecuta el pipeline de CSS de Next.js — no tiene sentido
fingir un test automatizado para esto.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: aplicar paleta e identidad tipográfica de Librería Blanco"
```

---

### Task 6: Home de verificación del sistema de diseño

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.test.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`,
  `Badge` de `components/ui/*` (Task 4); tokens de Task 5.
- Produces: página raíz (`/`) que cumple el criterio de aceptación de la
  spec de fase (sección 12): tipografía, color primario y al menos un
  componente shadcn/ui visibles.

- [ ] **Step 1: Actualizar el test primero**

`app/page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("muestra el nombre de la librería como título", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Librería Blanco" }),
    ).toBeInTheDocument();
  });

  it("muestra un botón primario de ejemplo", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("button", { name: "Ver productos" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test
```

Expected: FAIL — `screen.getByRole("heading", ...)` no encuentra nada
porque `app/page.tsx` todavía es el placeholder de Task 1 (un `<main>`
sin heading ni botón).

- [ ] **Step 3: Reescribir app/page.tsx**

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-3xl">Librería Blanco</h1>
      <p className="text-muted-foreground">
        Base del proyecto lista — esta pantalla se reemplaza en la Fase 3
        por la vidriera pública real.
      </p>
      <Button>Ver productos</Button>
      <Card>
        <CardHeader>
          <CardTitle>Cuaderno Rivadavia A4</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge>Nuevo</Badge>
          <span>$ 3.500</span>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test
```

Expected: PASS en ambos casos.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: home de verificación del sistema de diseño"
```

---

### Task 7: Páginas de error amigables

**Files:**
- Create: `app/not-found.tsx`
- Create: `app/not-found.test.tsx`
- Create: `app/error.tsx`
- Create: `app/error.test.tsx`

**Interfaces:**
- Consumes: `Button` de `components/ui/button` (Task 4).
- Produces: `NotFound` (default export de `not-found.tsx`) y `ErrorPage`
  (default export de `error.tsx`, componente cliente con props
  `{ error: Error & { digest?: string }, reset: () => void }`, contrato
  estándar de Next.js App Router).

- [ ] **Step 1: Escribir el test de not-found (falla primero)**

`app/not-found.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("muestra un mensaje amigable en español", () => {
    render(<NotFound />);
    expect(
      screen.getByText("No encontramos esta página."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
pnpm test app/not-found.test.tsx
```

Expected: FAIL — `app/not-found.tsx` no existe todavía.

- [ ] **Step 3: Crear app/not-found.tsx**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-2xl">No encontramos esta página.</h1>
      <p className="text-muted-foreground">
        Puede que el link esté mal escrito o que la página ya no exista.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
pnpm test app/not-found.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Escribir el test de error (falla primero)**

`app/error.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorPage from "./error";

describe("ErrorPage", () => {
  it("muestra un mensaje amigable, nunca el error técnico crudo", () => {
    const error = Object.assign(new Error("SQL ERROR 23505"), {
      digest: "abc123",
    });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(
      screen.getByText("No pudimos completar la operación."),
    ).toBeInTheDocument();
    expect(screen.queryByText("SQL ERROR 23505")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Verificar que falla**

```bash
pnpm test app/error.test.tsx
```

Expected: FAIL — `app/error.tsx` no existe todavía.

- [ ] **Step 7: Crear app/error.tsx**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-2xl">No pudimos completar la operación.</h1>
      <p className="text-muted-foreground">Probá de nuevo en un momento.</p>
      <Button onClick={reset}>Intentar de nuevo</Button>
    </main>
  );
}
```

Nota: el parámetro `error` no se muestra en la interfaz a propósito (spec
maestra §47) — Next.js igual lo registra en los logs del servidor.

- [ ] **Step 8: Verificar que pasa**

```bash
pnpm test app/error.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/not-found.tsx app/not-found.test.tsx app/error.tsx app/error.test.tsx
git commit -m "feat: páginas de error amigables (404 y error genérico)"
```

---

### Task 8: Clientes de Supabase (browser y servidor)

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/client.test.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/server.test.ts`
- Create: `.env.local.example`

**Interfaces:**
- Consumes: nada de tareas anteriores (independiente).
- Produces: `createClient()` en `lib/supabase/client.ts` (síncrono, para
  Client Components) y `createClient()` en `lib/supabase/server.ts`
  (async, para Server Components / Route Handlers) — ambos usados por
  Task 10 y por toda fase futura que necesite Supabase.

- [ ] **Step 1: Instalar @supabase/ssr y @supabase/supabase-js**

```bash
pnpm add @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Crear .env.local.example**

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Escribir el test del cliente de browser (falla primero)**

`lib/supabase/client.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "./client";

describe("createClient (browser)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  it("devuelve un cliente de Supabase utilizable", () => {
    const supabase = createClient();
    expect(typeof supabase.from).toBe("function");
  });
});
```

- [ ] **Step 4: Verificar que falla**

```bash
pnpm test lib/supabase/client.test.ts
```

Expected: FAIL — `lib/supabase/client.ts` no existe todavía.

- [ ] **Step 5: Crear lib/supabase/client.ts**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 6: Verificar que pasa**

```bash
pnpm test lib/supabase/client.test.ts
```

Expected: PASS.

- [ ] **Step 7: Escribir el test del cliente de servidor (falla primero)**

`lib/supabase/server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

import { createClient } from "./server";

describe("createClient (server)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  it("devuelve un cliente de Supabase utilizable", async () => {
    const supabase = await createClient();
    expect(typeof supabase.from).toBe("function");
  });
});
```

- [ ] **Step 8: Verificar que falla**

```bash
pnpm test lib/supabase/server.test.ts
```

Expected: FAIL — `lib/supabase/server.ts` no existe todavía.

- [ ] **Step 9: Crear lib/supabase/server.ts**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura;
            // se ignora porque el middleware de sesión (fase de Auth) se
            // encarga de refrescar cookies cuando corresponde.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 10: Verificar que pasa**

```bash
pnpm test lib/supabase/server.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/supabase/ .env.local.example package.json pnpm-lock.yaml
git commit -m "feat: clientes de Supabase para browser y servidor"
```

---

### Task 9: Crear el proyecto de Supabase (manual) y la tabla de verificación

**Esta tarea es manual — la ejecuta el IA Maker, no un desarrollador vía
código.** No tiene test automatizado porque implica crear una cuenta /
proyecto real.

**Files:**
- Create: `.env.local` (no versionado)

- [ ] **Step 1: Crear el proyecto en Supabase**

Ir a `https://supabase.com/dashboard`, crear una cuenta/organización si no
existe, y crear un proyecto nuevo llamado `libreria-blanco`. Elegir la
región más cercana a Argentina disponible (por ejemplo, `sa-east-1`).

- [ ] **Step 2: Copiar las credenciales**

En el proyecto creado, ir a Project Settings → API y copiar:
- `Project URL`
- `anon` `public` key
- `service_role` key (secreta — no compartir, no pegar en el chat)

- [ ] **Step 3: Completar .env.local**

Crear `.env.local` en la raíz del repo (ya está en `.gitignore` desde
Task 1) con:

```text
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

- [ ] **Step 4: Crear la tabla temporal de verificación**

En el SQL Editor del proyecto de Supabase, correr:

```sql
create table public._healthcheck (
  id bigint generated always as identity primary key,
  status text not null default 'ok'
);

insert into public._healthcheck (status) values ('ok');

alter table public._healthcheck enable row level security;

create policy "healthcheck is publicly readable"
  on public._healthcheck
  for select
  to anon
  using (true);
```

- [ ] **Step 5: Confirmar**

Verificar en el Table Editor de Supabase que `_healthcheck` tiene
exactamente una fila con `status = 'ok'`. Esta tabla se elimina en la
Task 13, al cerrar la fase.

---

### Task 10: Leer el healthcheck desde Server Component y Route Handler

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.test.tsx`
- Create: `app/api/healthcheck/route.ts`
- Create: `app/api/healthcheck/route.test.ts`

**Interfaces:**
- Consumes: `createClient` de `lib/supabase/server.ts` (Task 8); tabla
  `_healthcheck` de Task 9 (solo disponible en runtime real, no en tests).
- Produces: `GET` handler en `app/api/healthcheck/route.ts` que responde
  `{ status: "ok" }` con 200, o `{ status: "error" }` con 500.

- [ ] **Step 1: Escribir el test del route handler (falla primero, con mock)**

`app/api/healthcheck/route.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({
          data: { status: "ok" },
          error: null,
        }),
      }),
    }),
  })),
}));

import { GET } from "./route";

describe("GET /api/healthcheck", () => {
  it("responde 200 con el status de la tabla", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 2: Verificar que falla**

```bash
pnpm test app/api/healthcheck/route.test.ts
```

Expected: FAIL — `app/api/healthcheck/route.ts` no existe todavía.

- [ ] **Step 3: Crear app/api/healthcheck/route.ts**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("_healthcheck")
    .select("status")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: data.status });
}
```

- [ ] **Step 4: Verificar que pasa**

```bash
pnpm test app/api/healthcheck/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Mostrar el healthcheck también en la home (temporal)**

Modificar `app/page.tsx` para que sea un Server Component `async` y
agregue una línea con el resultado, debajo del `<p>` existente:

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("_healthcheck")
    .select("status")
    .maybeSingle();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-3xl">Librería Blanco</h1>
      <p className="text-muted-foreground">
        Base del proyecto lista — esta pantalla se reemplaza en la Fase 3
        por la vidriera pública real.
      </p>
      <p className="text-sm text-muted-foreground">
        Conexión a Supabase: {data?.status ?? "sin verificar"}
      </p>
      <Button>Ver productos</Button>
      <Card>
        <CardHeader>
          <CardTitle>Cuaderno Rivadavia A4</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge>Nuevo</Badge>
          <span>$ 3.500</span>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Actualizar app/page.test.tsx para el componente async**

Testing Library soporta componentes Server async si se les hace `await`
antes de `render`. Reemplazar el contenido de `app/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({
          data: { status: "ok" },
          error: null,
        }),
      }),
    }),
  })),
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("muestra el nombre de la librería como título", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("heading", { name: "Librería Blanco" }),
    ).toBeInTheDocument();
  });

  it("muestra un botón primario de ejemplo", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("button", { name: "Ver productos" }),
    ).toBeInTheDocument();
  });

  it("muestra el estado de la conexión a Supabase", async () => {
    render(await HomePage());
    expect(screen.getByText(/Conexión a Supabase: ok/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Correr toda la suite**

```bash
pnpm test
```

Expected: PASS en todos los archivos.

- [ ] **Step 8: Verificación manual contra Supabase real**

```bash
pnpm dev
```

Abrir `http://localhost:3000` y confirmar que dice
"Conexión a Supabase: ok". Abrir `http://localhost:3000/api/healthcheck`
y confirmar que devuelve `{"status":"ok"}`. Esto requiere que `.env.local`
(Task 9) tenga las credenciales reales.

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx app/page.test.tsx app/api/
git commit -m "feat: verificar conexión a Supabase desde Server Component y Route Handler"
```

---

### Task 11: Deploy a Vercel (sin GitHub por ahora)

**Contexto:** todavía no existe un repositorio remoto (no hay `origin`).
Por decisión explícita del IA Maker, en esta fase se deploya directo con
la CLI de Vercel; cuando el repo en la nube esté habilitado, se conecta
Vercel a Git para habilitar previews automáticos por rama/PR (spec
maestra §63) — ese paso queda anotado para cuando corresponda, no es
parte de esta tarea.

**Files:** ninguno versionado (agrega `.vercel/` local, ya ignorado desde
Task 1).

- [ ] **Step 1: Login en Vercel**

```bash
pnpm dlx vercel login
```

Seguir el flujo interactivo (abre el navegador para autenticar).

- [ ] **Step 2: Linkear el proyecto**

```bash
pnpm dlx vercel link
```

Elegir "Link to existing project" → No (crear uno nuevo), nombre
`libreria-blanco`, directorio `./`.

- [ ] **Step 3: Cargar las variables de entorno en Vercel**

Por cada variable de `.env.local` (Task 9), para los tres entornos:

```bash
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL development
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

Cada comando pide pegar el valor por stdin — usar los mismos valores de
`.env.local`.

- [ ] **Step 4: Deploy de producción**

```bash
pnpm dlx vercel --prod
```

Expected: build exitoso, URL de producción devuelta por la CLI.

- [ ] **Step 5: Verificar en producción**

Abrir la URL devuelta y `<url>/api/healthcheck`, confirmar el mismo
resultado que en local (Task 10, Step 8).

- [ ] **Step 6 (pendiente, no bloqueante — ejecutar cuando el repo en la nube esté disponible):**

```bash
git remote add origin <url-del-repo>
git push -u origin nueva-ui
pnpm dlx vercel git connect
```

Esto no se ejecuta como parte del cierre de esta fase; queda documentado
acá para no perder el paso cuando el repositorio remoto esté habilitado.

---

### Task 12: Completar AGENTS.md con la información real del proyecto

**Files:**
- Modify: `AGENTS.md`

**Interfaces:** ninguna — es documentación.

- [ ] **Step 1: Completar la sección "Descripción del proyecto"**

Reemplazar `[Completar]` con:

```markdown
Plataforma integral de e-commerce y backoffice para Librería Blanco: un
portal público sin login para comprar como invitado (retiro en local,
pago por transferencia + comprobante por WhatsApp) y un backoffice
administrativo (`/admin`) para gestionar catálogo, precios, pedidos y
clientes. Única aplicación Next.js full-stack sobre Supabase, desplegada
en Vercel. Fuente de verdad funcional completa:
`docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md`.
```

- [ ] **Step 2: Completar "Stack tecnológico"**

```markdown
- Next.js 15 (App Router)
- TypeScript 5 (strict)
- React 19
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth, Storage) vía @supabase/ssr
- Vitest + Testing Library
- pnpm
- Vercel (hosting)
```

- [ ] **Step 3: Completar "Estructura de carpetas"**

```markdown
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
```

- [ ] **Step 4: Completar "Convenciones de código"**

```markdown
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
```

- [ ] **Step 5: Completar "Convenciones de base de datos"**

```markdown
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
```

- [ ] **Step 6: Completar "Testing"**

```markdown
- Framework: Vitest + Testing Library (jsdom).
- Convención de nombres: `[archivo].test.ts` / `.test.tsx`, co-ubicado.
- Mocks de Supabase: mockear el módulo `@/lib/supabase/server` o
  `@/lib/supabase/client` con `vi.mock`, nunca pegarle a una base real
  desde un test automatizado.
```

- [ ] **Step 7: Completar "Lo que nunca se debe hacer"**

Agregar, sin borrar la línea existente sobre `tsoft-dev/metrics/`:

```markdown
- No commitear `.env.local` ni ningún archivo con credenciales reales.
- No crear una aplicación separada para admin y tienda — es una sola app
  Next.js (spec maestra §2.1).
- No implementar stock cuantitativo, Mercado Pago, ARCA ni cuenta de
  cliente en el MVP — están explícitamente fuera de alcance (spec
  maestra §68).
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en código de cliente.
```

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md
git commit -m "docs: completar AGENTS.md con la información real del proyecto"
```

---

### Task 13: Cierre de la Fase 0 — limpiar el healthcheck temporal

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.test.tsx`
- Delete: `app/api/healthcheck/route.ts`
- Delete: `app/api/healthcheck/route.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: estado final de la Fase 0 — `lib/supabase/*` queda intacto
  (es infraestructura reutilizable), solo se retira el código de
  verificación temporal y la tabla `_healthcheck`.

- [ ] **Step 1: Quitar la lectura de healthcheck de la home**

Revertir `app/page.tsx` al contenido de Task 6 (sin el `async`, sin la
llamada a Supabase, sin la línea "Conexión a Supabase: ..."):

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-3xl">Librería Blanco</h1>
      <p className="text-muted-foreground">
        Base del proyecto lista — esta pantalla se reemplaza en la Fase 3
        por la vidriera pública real.
      </p>
      <Button>Ver productos</Button>
      <Card>
        <CardHeader>
          <CardTitle>Cuaderno Rivadavia A4</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge>Nuevo</Badge>
          <span>$ 3.500</span>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Revertir app/page.test.tsx al de Task 6**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("muestra el nombre de la librería como título", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Librería Blanco" }),
    ).toBeInTheDocument();
  });

  it("muestra un botón primario de ejemplo", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("button", { name: "Ver productos" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Borrar el route handler y su test**

```bash
git rm app/api/healthcheck/route.ts app/api/healthcheck/route.test.ts
```

- [ ] **Step 4: Borrar la tabla en Supabase**

En el SQL Editor del proyecto de Supabase:

```sql
drop table public._healthcheck;
```

- [ ] **Step 5: Correr toda la verificación de la fase**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm exec next build
```

Expected: los cuatro comandos terminan sin errores.

- [ ] **Step 6: Re-deployar**

```bash
pnpm dlx vercel --prod
```

Expected: deploy exitoso; `<url>/api/healthcheck` ahora responde 404 (el
handler ya no existe) y `<url>/` ya no menciona la conexión a Supabase.

- [ ] **Step 7: Commit final**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "chore: retirar verificación temporal de healthcheck al cerrar Fase 0"
```

- [ ] **Step 8: Confirmar contra el criterio de aceptación**

Repasar la sección 12 de
`docs/superpowers/specs/2026-08-30-fase0-fundaciones-design.md` ítem por
ítem y confirmar que todos están tildados antes de dar la Fase 0 por
cerrada.
