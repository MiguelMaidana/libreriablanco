# Fase 1b — Auth Admin + Roles/Permisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login funcional de administradoras contra Supabase Auth,
`/admin/*` protegido, y helpers de servidor (`getCurrentAdmin`,
`requirePermission`) que envuelven el motor de permisos de la Fase 1a
— sin reimplementar esa lógica en TypeScript.

**Architecture:** Un middleware acotado a `/admin/:path*` que solo
refresca cookies de sesión (patrón oficial `@supabase/ssr`); un route
group `app/admin/(protected)/` cuyo `layout.tsx` hace el chequeo real de
autorización; `/admin/login` y `/admin/unauthorized` viven **fuera** de
ese grupo para no auto-redirigirse en loop. Un nuevo helper SQL
`get_my_admin_profile()` (SECURITY DEFINER, auto-referido a
`auth.uid()`) resuelve un problema real de RLS: las políticas de
`admin_profiles`/`roles` de la Fase 1a exigen el permiso `usuarios:ver`
para leer esas tablas, lo cual bloquearía a cualquier admin sin ese
permiso específico de leer **su propio** perfil — necesario para que el
login funcione para roles que no sean `SUPER_ADMIN` o tengan
`usuarios:ver`.

**Tech Stack:** Supabase Auth (`@supabase/ssr`, ya instalado), Zod
(nuevo), Next.js Server Actions, React 19 `useActionState`.

**Spec:** `docs/superpowers/specs/2026-08-31-fase1b-auth-admin-design.md`

## Global Constraints

- `requirePermission`/`getCurrentAdmin` son las únicas formas de chequear
  autorización en código de aplicación — nunca reimplementar la lógica
  de `has_permission` en TypeScript.
- El mensaje de login fallido nunca distingue "no existe el email" de
  "contraseña incorrecta" — mismo mensaje genérico para ambos casos
  (evita enumeración de cuentas).
- Ningún error técnico crudo llega al usuario (spec maestra §47).
- `typescript` (^6.0.3) y `eslint` (^9.39.5) pinneados — no tocar.
- No construir pantallas de gestión de usuarios/roles en esta fase (spec
  de fase §3) — solo login + el gate de autorización.

---

## File Structure

```text
supabase/migrations/
  <ts>_get_my_admin_profile.sql   # Task 2

types/supabase.ts                 # regenerado, Task 2

lib/
  validations/
    auth.ts                       # adminLoginSchema — Task 1
    auth.test.ts
  auth/
    permissions.ts                 # getCurrentAdmin, requirePermission — Task 3
    permissions.test.ts
  supabase/
    middleware.ts                  # cliente Supabase para middleware — Task 4

middleware.ts                      # raíz del repo — Task 4

app/
  admin/
    login/
      page.tsx                     # Task 5 — FUERA del route group protegido
      actions.ts
    unauthorized/
      page.tsx                     # Task 6 — FUERA del route group protegido
    (protected)/
      layout.tsx                   # Task 6 — el gate real
      page.tsx                     # Task 7 — dashboard mínimo
    logout/
      route.ts                     # Task 7
```

`(protected)` es un route group de Next.js: no aparece en la URL
(`app/admin/(protected)/page.tsx` sigue sirviendo `/admin`), pero solo
envuelve lo que está adentro con su `layout.tsx`. `login/` y
`unauthorized/` quedan deliberadamente fuera de ese grupo — si
estuvieran adentro, el layout se aplicaría también a esas páginas y
crearía un loop de redirección (sin sesión → redirect a login → el
layout vuelve a correr sobre login → sin sesión → redirect a login...).

---

### Task 1: Esquema de validación del login (Zod)

**Files:**
- Create: `lib/validations/auth.ts`
- Create: `lib/validations/auth.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `adminLoginSchema` (Zod schema) y el tipo `AdminLoginInput`
  inferido — usados por Task 5 (Server Action de login).

- [ ] **Step 1: Instalar Zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Escribir el test (falla primero)**

`lib/validations/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { adminLoginSchema } from "./auth";

describe("adminLoginSchema", () => {
  it("acepta un email y password válidos", () => {
    const result = adminLoginSchema.safeParse({
      email: "admin@libreriablanco.com",
      password: "secreto123",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un email mal formado", () => {
    const result = adminLoginSchema.safeParse({
      email: "no-es-un-email",
      password: "secreto123",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un password vacío", () => {
    const result = adminLoginSchema.safeParse({
      email: "admin@libreriablanco.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
pnpm test lib/validations/auth.test.ts
```

Expected: FAIL — `lib/validations/auth.ts` no existe todavía.

- [ ] **Step 4: Crear lib/validations/auth.ts**

```typescript
import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
```

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
pnpm test lib/validations/auth.test.ts
```

Expected: PASS, 3/3.

- [ ] **Step 6: Commit**

```bash
git add lib/validations/ package.json pnpm-lock.yaml
git commit -m "feat: esquema de validación del login de admin (Zod)"
```

---

### Task 2: Migración — get_my_admin_profile()

**Files:**
- Create: `supabase/migrations/<ts>_get_my_admin_profile.sql`
- Modify: `types/supabase.ts` (regenerado)

**Interfaces:**
- Consumes: `admin_profiles`, `admin_profile_roles`, `roles` (Fase 1a).
- Produces: función `get_my_admin_profile()` (sin parámetros, usa
  `auth.uid()` internamente) — usada por Task 3
  (`getCurrentAdmin`).

- [ ] **Step 1: Generar la migración**

```bash
pnpm exec supabase migration new get_my_admin_profile
```

Si el stack local no está corriendo (`pnpm exec supabase status`),
levantarlo con `pnpm exec supabase start` primero.

- [ ] **Step 2: Escribir el contenido**

```sql
-- Las políticas RLS de admin_profiles/roles (Fase 1a) exigen el
-- permiso 'usuarios:ver' para leer esas tablas — correcto para
-- consultar el perfil de OTRO admin, pero bloquearía a cualquier admin
-- sin ese permiso específico de leer su PROPIO perfil, algo que el
-- login necesita para funcionar sin importar el rol. Esta función,
-- SECURITY DEFINER y auto-referida a auth.uid() (sin parámetro, no se
-- le puede pedir el perfil de otro usuario), resuelve ese problema sin
-- tener que aflojar ninguna política existente.
create or replace function public.get_my_admin_profile()
returns table (
  id uuid,
  full_name text,
  is_active boolean,
  role_names text[]
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    ap.id,
    ap.full_name,
    ap.is_active,
    coalesce(array_agg(r.name) filter (where r.name is not null), '{}')
  from public.admin_profiles ap
  left join public.admin_profile_roles apr on apr.admin_profile_id = ap.id
  left join public.roles r on r.id = apr.role_id
  where ap.id = auth.uid()
  group by ap.id, ap.full_name, ap.is_active;
$$;

grant execute on function public.get_my_admin_profile() to authenticated;
```

- [ ] **Step 3: Aplicar localmente**

```bash
pnpm exec supabase db reset
```

Expected: sin errores (las 7 migraciones de Fase 1a + esta, en orden).

- [ ] **Step 4: Verificar con datos de prueba, simulando un usuario autenticado**

```sql
-- Datos de prueba (solo local)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000010', 'test-1b@test.local');

insert into public.admin_profiles (id, full_name, is_active) values
  ('00000000-0000-0000-0000-000000000010', 'Admin de Prueba 1b', true);

insert into public.admin_profile_roles (admin_profile_id, role_id)
select '00000000-0000-0000-0000-000000000010', id from public.roles where name = 'SUPER_ADMIN';

-- Simular una sesión autenticada como ese usuario (técnica estándar
-- para probar funciones que dependen de auth.uid() sin necesitar un
-- login real)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000010"}';

select * from public.get_my_admin_profile();

reset role;
```

Expected: una fila — `full_name = 'Admin de Prueba 1b'`,
`is_active = true`, `role_names = {SUPER_ADMIN}`.

Usar `pnpm exec supabase db query --local "<sql>"` para correr esto (o
el fallback de psql/Studio si esa subcomando no existe en la versión
instalada del CLI, mismo criterio que en la Fase 1a).

- [ ] **Step 5: Verificar que un usuario sin admin_profile devuelve cero filas**

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000099"}';
select * from public.get_my_admin_profile();
reset role;
```

Expected: 0 filas (no un error).

- [ ] **Step 6: Verificar que `anon` no puede ejecutar la función**

```sql
select has_function_privilege('anon', 'public.get_my_admin_profile()', 'EXECUTE');
```

Expected: `false`.

- [ ] **Step 7: Regenerar los tipos de TypeScript**

```bash
pnpm exec supabase gen types typescript --local > types/supabase.ts
```

- [ ] **Step 8: Verificar que typecheck sigue limpio**

```bash
pnpm typecheck
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/ types/supabase.ts
git commit -m "feat: función get_my_admin_profile para que un admin lea su propio perfil"
```

---

### Task 3: Helpers de autorización de servidor

**Files:**
- Create: `lib/auth/permissions.ts`
- Create: `lib/auth/permissions.test.ts`

**Interfaces:**
- Consumes: `createClient` de `lib/supabase/server.ts` (Fase 0/1a);
  RPCs `get_my_admin_profile` (Task 2) y `has_permission` (Fase 1a).
- Produces: `getCurrentAdmin(): Promise<AdminProfile | null>`,
  `requirePermission(module, action): Promise<AdminProfile>`, tipos
  `PermissionModule`, `PermissionAction`, `AdminProfile`, clase
  `ForbiddenError` — usados por Task 6 (layout) y Task 7 (dashboard), y
  por toda fase futura que necesite chequear permisos en servidor.

- [ ] **Step 1: Escribir los tests (fallan primero)**

`lib/auth/permissions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

import { getCurrentAdmin, requirePermission, ForbiddenError } from "./permissions";

describe("getCurrentAdmin", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("devuelve null si get_my_admin_profile no encuentra perfil", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    const admin = await getCurrentAdmin();
    expect(admin).toBeNull();
  });

  it("devuelve null si el perfil existe pero está inactivo", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({
        data: { id: "u1", full_name: "Inactiva", is_active: false, role_names: [] },
        error: null,
      }),
    });

    const admin = await getCurrentAdmin();
    expect(admin).toBeNull();
  });

  it("devuelve el perfil con roles cuando está activo", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({
        data: { id: "u1", full_name: "María", is_active: true, role_names: ["SUPER_ADMIN"] },
        error: null,
      }),
    });

    const admin = await getCurrentAdmin();
    expect(admin).toEqual({ id: "u1", fullName: "María", roles: ["SUPER_ADMIN"] });
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("lanza ForbiddenError si no hay admin logueado", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    await expect(requirePermission("productos", "ver")).rejects.toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError si has_permission devuelve false", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: false, error: null });
    });

    await expect(requirePermission("usuarios", "eliminar")).rejects.toThrow(ForbiddenError);
  });

  it("devuelve el admin si has_permission devuelve true", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    const admin = await requirePermission("pedidos", "ver");
    expect(admin.fullName).toBe("Vendedora");
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
pnpm test lib/auth/permissions.test.ts
```

Expected: FAIL — `lib/auth/permissions.ts` no existe todavía.

- [ ] **Step 3: Crear lib/auth/permissions.ts**

```typescript
import { createClient } from "@/lib/supabase/server";

export type PermissionModule =
  | "productos"
  | "precios"
  | "stock"
  | "pedidos"
  | "clientes"
  | "facturacion"
  | "usuarios"
  | "configuracion";

export type PermissionAction = "ver" | "crear" | "editar" | "eliminar";

export interface AdminProfile {
  id: string;
  fullName: string;
  roles: string[];
}

export class ForbiddenError extends Error {
  constructor(module: PermissionModule, action: PermissionAction) {
    super(`No autorizado: ${module}:${action}`);
    this.name = "ForbiddenError";
  }
}

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_admin_profile").maybeSingle();

  if (error || !data || !data.is_active) {
    return null;
  }

  return {
    id: data.id,
    fullName: data.full_name,
    roles: data.role_names ?? [],
  };
}

export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<AdminProfile> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new ForbiddenError(module, action);
  }

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_user_id: admin.id,
    p_module: module,
    p_action: action,
  });

  if (!allowed) {
    throw new ForbiddenError(module, action);
  }

  return admin;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
pnpm test lib/auth/permissions.test.ts
```

Expected: PASS, 6/6. Si el tipado estricto de `supabase.rpc(...)`
(generado a partir de `types/supabase.ts` de Task 2) no coincide
exactamente con la forma del mock, ajustar el mock con un cast que
mantenga la forma asignable (mismo criterio que en Fase 1a Task 7) —
nunca aflojar el tipo real de `createClient`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/
git commit -m "feat: helpers de autorización de servidor (getCurrentAdmin, requirePermission)"
```

---

### Task 4: Middleware de refresco de sesión

**Files:**
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts` (raíz del repo)

**Interfaces:**
- Consumes: nada nuevo (usa las mismas env vars que
  `lib/supabase/server.ts`).
- Produces: middleware de Next.js que refresca cookies de sesión en
  cada request a `/admin/*`.

- [ ] **Step 1: Crear lib/supabase/middleware.ts**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No agregar lógica entre createServerClient y auth.getUser(): un
  // error acá puede desloguear usuarios de forma intermitente y muy
  // difícil de diagnosticar (advertencia del patrón oficial de Supabase).
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 2: Crear middleware.ts en la raíz**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 3: Verificar que compila**

```bash
pnpm typecheck
pnpm exec next build
```

Expected: sin errores. No hay test automatizado para el middleware en
sí (correr Next.js en modo edge no es algo que Vitest ejecute) — se
verifica funcionalmente en la Task 9 (Playwright end-to-end).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts middleware.ts
git commit -m "feat: middleware de refresco de sesión para /admin"
```

---

### Task 5: Página de login

**Files:**
- Create: `app/admin/login/actions.ts`
- Create: `app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `adminLoginSchema` (Task 1), `createClient` de
  `lib/supabase/server.ts`, componentes `Button`/`Input` (Fase 0).
- Produces: página `/admin/login` con Server Action `signIn`.

- [ ] **Step 1: Crear app/admin/login/actions.ts**

```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminLoginSchema } from "@/lib/validations/auth";

export interface LoginState {
  error: string | null;
}

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Revisá los datos ingresados." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "No pudimos iniciar sesión. Revisá tu email y contraseña." };
  }

  redirect("/admin");
}
```

- [ ] **Step 2: Crear app/admin/login/page.tsx**

```tsx
"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl">Ingresar</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password">Contraseña</label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verificar que compila y el resto de la suite sigue verde**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/login/
git commit -m "feat: página de login del admin"
```

---

### Task 6: Layout protegido + página de "sin acceso"

**Files:**
- Create: `app/admin/(protected)/layout.tsx`
- Create: `app/admin/(protected)/layout.test.tsx`
- Create: `app/admin/unauthorized/page.tsx`

**Interfaces:**
- Consumes: `createClient` de `lib/supabase/server.ts`,
  `getCurrentAdmin` (Task 3).
- Produces: el gate de autorización real para todo lo que viva dentro
  de `app/admin/(protected)/`.

- [ ] **Step 1: Escribir el test primero (falla)**

`app/admin/(protected)/layout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockGetCurrentAdmin = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/auth/permissions", () => ({
  getCurrentAdmin: mockGetCurrentAdmin,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import ProtectedAdminLayout from "./layout";

describe("ProtectedAdminLayout", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetCurrentAdmin.mockReset();
  });

  it("redirige a /admin/login si no hay sesión", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(
      ProtectedAdminLayout({ children: <div /> }),
    ).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("redirige a /admin/unauthorized si hay sesión pero no hay admin activo", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCurrentAdmin.mockResolvedValue(null);

    await expect(
      ProtectedAdminLayout({ children: <div /> }),
    ).rejects.toThrow("REDIRECT:/admin/unauthorized");
  });

  it("renderiza los children si hay sesión y admin activo", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCurrentAdmin.mockResolvedValue({ id: "u1", fullName: "Test", roles: [] });

    const result = await ProtectedAdminLayout({
      children: <div data-testid="child" />,
    });
    expect(result).toBeTruthy();
  });
});
```

Esto es lo que cubre el criterio de aceptación "un admin desactivado ve
`/admin/unauthorized`" (spec de fase §9) — sin este test, esa regla solo
estaba probada indirectamente a través de `getCurrentAdmin` (Task 3),
nunca a través del `redirect` real del layout.

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test "app/admin/(protected)/layout.test.tsx"
```

Expected: FAIL — `app/admin/(protected)/layout.tsx` no existe todavía.

- [ ] **Step 3: Crear app/admin/(protected)/layout.tsx**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/auth/permissions";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/unauthorized");
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test "app/admin/(protected)/layout.test.tsx"
```

Expected: PASS, 3/3.

- [ ] **Step 5: Crear app/admin/unauthorized/page.tsx**

```tsx
export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl">Tu cuenta no tiene acceso</h1>
      <p className="text-muted-foreground">
        Iniciaste sesión, pero tu usuario no está habilitado en Librería
        Blanco. Consultá con quien administra el sistema.
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Verificar que compila**

```bash
pnpm lint
pnpm typecheck
```

Expected: sin errores. `app/admin/(protected)/` sin un `page.tsx`
propio todavía no rompe el build (Next.js no exige que un route group
tenga contenido inmediato), pero la Task 7 lo completa.

- [ ] **Step 7: Commit**

```bash
git add "app/admin/(protected)/layout.tsx" "app/admin/(protected)/layout.test.tsx" app/admin/unauthorized/
git commit -m "feat: layout protegido del admin y página de sin acceso"
```

---

### Task 7: Dashboard mínimo + logout

**Files:**
- Create: `app/admin/(protected)/page.tsx`
- Create: `app/admin/logout/route.ts`

**Interfaces:**
- Consumes: `getCurrentAdmin` (Task 3), `createClient`, componente
  `Button` (Fase 0).
- Produces: `/admin` (dashboard mínimo) y `POST /admin/logout`.

- [ ] **Step 1: Crear app/admin/(protected)/page.tsx**

```tsx
import { getCurrentAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl">Hola, {admin?.fullName ?? "administradora"}</h1>
      <p className="text-muted-foreground">
        Tu rol: {admin && admin.roles.length > 0 ? admin.roles.join(", ") : "sin rol asignado"}
      </p>
      <form action="/admin/logout" method="post">
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Crear app/admin/logout/route.ts**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
```

- [ ] **Step 3: Verificar toda la suite**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm exec next build
```

Expected: todo limpio.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(protected)/page.tsx" app/admin/logout/
git commit -m "feat: dashboard mínimo del admin y logout"
```

---

### Task 8: Bootstrap del primer SUPER_ADMIN real (manual — lo ejecuta el IA Maker)

**Esta tarea es manual, contra el proyecto real de Supabase — no un
subagente sin supervisión.**

**Files:** ninguno versionado.

- [ ] **Step 1: Pedir al IA Maker el nombre y email reales de la primera administradora**

- [ ] **Step 2: Crear el usuario en Supabase Auth (proyecto real)**

Dashboard → Authentication → Users → Add user. Definir una contraseña
temporal (se puede cambiar después manualmente, no hay flujo de cambio
de contraseña en el MVP).

- [ ] **Step 3: Copiar el UUID del usuario creado**

- [ ] **Step 4: Insertar su admin_profile y asignarle SUPER_ADMIN**

En el SQL Editor del proyecto real:

```sql
insert into public.admin_profiles (id, full_name)
values ('<uuid del paso 3>', '<nombre completo real>');

insert into public.admin_profile_roles (admin_profile_id, role_id)
select '<uuid del paso 3>', id from public.roles where name = 'SUPER_ADMIN';
```

- [ ] **Step 5: Deshabilitar el self-signup público**

Dashboard → Authentication → Settings/Providers → deshabilitar "Allow
new users to sign up" (o el toggle equivalente en la versión del
dashboard vigente).

- [ ] **Step 6: Subir el largo mínimo de contraseña a 8**

Misma sección de configuración, `Minimum password length` → `8`.

- [ ] **Step 7: Confirmar la fila creada**

```sql
select ap.full_name, ap.is_active, r.name
from public.admin_profiles ap
join public.admin_profile_roles apr on apr.admin_profile_id = ap.id
join public.roles r on r.id = apr.role_id;
```

Expected: una fila con el nombre real, `is_active = true`,
`name = 'SUPER_ADMIN'`.

---

### Task 9: Verificación end-to-end (manual/controller — Playwright)

**Esta tarea la ejecuta el controller directamente (necesita un
navegador real), no un subagente sin acceso a Playwright.**

**Files:** ninguno.

- [ ] **Step 1: Verificar todo el proyecto una vez más**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

- [ ] **Step 2: Levantar el servidor de desarrollo**

```bash
pnpm dev
```

`.env.local` ya apunta al proyecto real de Supabase (desde la Fase 0),
así que este flujo prueba contra el backend real, con las credenciales
reales creadas en la Task 8.

- [ ] **Step 3: Verificar el redirect sin sesión**

Navegar a `http://localhost:3000/admin`. Expected: redirige a
`/admin/login`.

- [ ] **Step 4: Verificar login con contraseña incorrecta**

Completar el formulario con el email real de la Task 8 y una contraseña
incorrecta. Expected: mensaje "No pudimos iniciar sesión. Revisá tu
email y contraseña." — nunca un error técnico.

- [ ] **Step 5: Verificar login correcto**

Completar con las credenciales reales de la Task 8. Expected: redirige
a `/admin`, muestra "Hola, `<nombre real>`" y "Tu rol: SUPER_ADMIN".

- [ ] **Step 6: Verificar logout**

Click en "Cerrar sesión". Expected: redirige a `/admin/login`. Navegar
de nuevo a `/admin` manualmente. Expected: vuelve a redirigir a
`/admin/login` (la sesión quedó realmente invalidada, no solo la UI).

- [ ] **Step 7: Detener el servidor de desarrollo**

Confirmar que no queda ningún proceso de `next dev` corriendo en
background antes de cerrar la fase.
