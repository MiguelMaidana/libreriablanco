# Fase 7: Usuarios y Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la UI de gestión de usuarios administrativos (crear cuenta
real vía Supabase Auth Admin API, editar, desactivar, resetear contraseña) y
roles (matriz visual de permisos), exclusiva de `SUPER_ADMIN`, sobre el
esquema RBAC ya existente desde Fase 1a.

**Architecture:** Dos rutas bajo `/admin/usuarios` (lista + diálogo) y
`/admin/usuarios/roles` (lista + páginas dedicadas de crear/editar), un
módulo `lib/admin/users.ts` que encapsula las operaciones sensibles sobre la
Auth Admin API con compensación ante fallos parciales, y dos nuevos helpers
`requireSuperAdmin`/`withSuperAdminAction` en `lib/auth/permissions.ts` para
gatear toda mutación de esta fase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 +
shadcn/ui (Dialog, AlertDialog, Table, Select, Checkbox, Switch), Zod v4,
Vitest + Testing Library, `@supabase/supabase-js` (Auth Admin API vía
`service_role`).

**Spec:** `docs/superpowers/specs/2026-09-04-fase7-usuarios-roles-design.md`

## Global Constraints

- Master spec: `docs/libreria/LIBRERIA_BLANCO_MASTER_SPEC_v0.4.md` §96
  (Usuarios y Roles) y §11 (Roles administrativos — el SUPER_ADMIN es quien
  gestiona roles/usuarios).
- No hay migraciones nuevas: el esquema RBAC (`admin_profiles`, `roles`,
  `permissions`, `role_permissions`, `admin_profile_roles`,
  `has_permission`, `is_super_admin`) ya existe completo desde Fase 1a.
- Toda mutación de esta fase (crear/editar/desactivar usuario, resetear
  contraseña, crear/editar/borrar rol) pasa por `withSuperAdminAction`
  (nuevo en esta fase) — nunca por `withPermissionAction`. La RLS existente
  (`supabase/migrations/20260831155059_rls_policies.sql:144-197`) ya
  reserva toda escritura sobre `roles`/`permissions`/`role_permissions`/
  `admin_profile_roles` a `SUPER_ADMIN`; `admin_profiles` no tiene política
  de INSERT.
- Toda escritura de esta fase usa `createServiceClient()`
  (`lib/supabase/service.ts`), nunca el `createClient()` de sesión — la
  autorización real ya se verificó en el server action vía
  `requireSuperAdmin()` antes de llegar a la escritura, y el `service_role`
  es indispensable de todos modos para la Auth Admin API y para insertar en
  `admin_profiles` (sin política de INSERT).
- Las páginas de lectura (`/admin/usuarios`, `/admin/usuarios/roles`) NO
  llaman a `requirePermission` explícitamente, salvo la excepción anotada en
  la Tarea 7 (necesaria porque leer emails requiere `service_role`, que
  bypassea la RLS). El resto sigue el patrón ya establecido en todo el admin
  (`categorias/page.tsx`, `clientes/page.tsx`): confían en que la RLS
  filtre los datos.
- No se gestiona el rol `SUPER_ADMIN` desde esta UI: no aparece en
  selectores de rol, no aparece en la lista de roles, no se puede editar ni
  borrar (los server actions lo rechazan aunque la UI no debería poder
  llegar ahí).
- Sin borrado duro de usuarios; solo `admin_profiles.is_active`.
- Mensajes de error en español, nunca exponer errores crudos de
  Postgres/Auth.
- Sin tests dedicados para componentes de formulario mecánicos
  (`user-dialog.tsx`, `user-row-actions.tsx`, `role-form.tsx`,
  `temp-password-dialog.tsx`, `delete-role-button.tsx`) ni para `page.tsx` —
  mismo criterio que `SettingsForm` en Fase 6: la lógica real está cubierta
  por los tests de los server actions.

---

### Task 1: Helper de autorización SUPER_ADMIN

**Files:**
- Modify: `lib/auth/permissions.ts`
- Modify: `lib/auth/permissions.test.ts`

**Interfaces:**
- Produces: `requireSuperAdmin(): Promise<AdminProfile>`,
  `withSuperAdminAction<S extends {error: string|null}>(forbiddenState: S, fn: (admin: AdminProfile) => Promise<S>): Promise<S>`,
  `PERMISSION_MODULES: PermissionModule[]`, `PERMISSION_ACTIONS: PermissionAction[]`
  — usados por todas las tareas siguientes.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `lib/auth/permissions.test.ts` (después del último
`describe`, sin tocar lo existente):

```ts
describe("requireSuperAdmin", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("lanza ForbiddenError si no hay admin logueado", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    await expect(requireSuperAdmin()).rejects.toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError si is_super_admin devuelve false", async () => {
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

    await expect(requireSuperAdmin()).rejects.toThrow(ForbiddenError);
  });

  it("devuelve el admin si is_super_admin devuelve true", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Jessica", is_active: true, role_names: ["SUPER_ADMIN"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    const admin = await requireSuperAdmin();
    expect(admin.fullName).toBe("Jessica");
  });

  it("llama a is_super_admin con el user id exacto", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Jessica", is_active: true, role_names: ["SUPER_ADMIN"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    await requireSuperAdmin();

    expect(mockRpc).toHaveBeenCalledWith("is_super_admin", { p_user_id: "u1" });
  });
});

describe("withSuperAdminAction", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("devuelve forbiddenState sin ejecutar fn cuando no es super admin", async () => {
    const fn = vi.fn();
    mockRpc.mockImplementation((rpcFn: string) => {
      if (rpcFn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: false, error: null });
    });

    const forbiddenState = { error: "Solo un super administrador puede hacer esto." };
    const result = await withSuperAdminAction(forbiddenState, fn);

    expect(result).toEqual(forbiddenState);
    expect(fn).not.toHaveBeenCalled();
  });

  it("ejecuta fn y devuelve su resultado cuando es super admin", async () => {
    mockRpc.mockImplementation((rpcFn: string) => {
      if (rpcFn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Jessica", is_active: true, role_names: ["SUPER_ADMIN"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    const result = await withSuperAdminAction({ error: "no debería verse" }, async (admin) => ({
      error: null,
      who: admin.fullName,
    }));

    expect(result).toEqual({ error: null, who: "Jessica" });
  });
});
```

Actualizar el import de la primera línea del archivo para incluir los
símbolos nuevos:

```ts
import {
  getCurrentAdmin,
  requirePermission,
  requireSuperAdmin,
  ForbiddenError,
  withPermission,
  withPermissionAction,
  withSuperAdminAction,
} from "./permissions";
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm vitest run lib/auth/permissions.test.ts`
Expected: FAIL — `requireSuperAdmin`/`withSuperAdminAction` no existen todavía.

- [ ] **Step 3: Implementar**

Agregar al final de `lib/auth/permissions.ts`:

```ts
export const PERMISSION_MODULES: PermissionModule[] = [
  "productos",
  "precios",
  "stock",
  "pedidos",
  "clientes",
  "facturacion",
  "usuarios",
  "configuracion",
];

export const PERMISSION_ACTIONS: PermissionAction[] = ["ver", "crear", "editar", "eliminar"];

export async function requireSuperAdmin(): Promise<AdminProfile> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    // No hay un module:action único para "no sos SUPER_ADMIN" — se reusa
    // ForbiddenError solo como señal interna para el catch de
    // withSuperAdminAction; su mensaje nunca llega al usuario.
    throw new ForbiddenError("usuarios", "eliminar");
  }

  const supabase = await createClient();
  const { data: isSuperAdmin, error } = await supabase.rpc("is_super_admin", {
    p_user_id: admin.id,
  });

  if (error) {
    console.error("requireSuperAdmin: error calling is_super_admin", error);
  }

  if (!isSuperAdmin) {
    throw new ForbiddenError("usuarios", "eliminar");
  }

  return admin;
}

export async function withSuperAdminAction<S extends { error: string | null }>(
  forbiddenState: S,
  fn: (admin: AdminProfile) => Promise<S>,
): Promise<S> {
  try {
    const admin = await requireSuperAdmin();
    return await fn(admin);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return forbiddenState;
    }
    throw error;
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm vitest run lib/auth/permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/auth/permissions.ts lib/auth/permissions.test.ts
git commit -m "feat: agrega requireSuperAdmin y withSuperAdminAction"
```

---

### Task 2: `lib/admin/users.ts` — operaciones sensibles sobre la Auth Admin API

**Files:**
- Create: `lib/admin/users.ts`
- Create: `lib/admin/users.test.ts`

**Interfaces:**
- Consumes: `createServiceClient()` de `lib/supabase/service.ts`.
- Produces: `createAdminUser(input)`, `resetAdminPassword(userId)`,
  `wouldRemoveLastSuperAdmin(userId)`, tipo `AdminUserActionResult`,
  `generateTempPassword()` — usados por la Tarea 3.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/admin/users.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockUpdateUserById = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        updateUserById: mockUpdateUserById,
      },
    },
    from: mockFrom,
  })),
}));

import { createAdminUser, resetAdminPassword, wouldRemoveLastSuperAdmin } from "./users";

function chain(result: unknown) {
  const query: Record<string, unknown> = {
    select: () => query,
    eq: () => query,
    in: () => query,
    neq: () => query,
    insert: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return query;
}

describe("createAdminUser", () => {
  beforeEach(() => {
    mockCreateUser.mockReset();
    mockDeleteUser.mockReset();
    mockFrom.mockReset();
  });

  it("crea el usuario, el admin_profile y la asignación de rol", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockFrom.mockImplementation(() => chain({ error: null }));

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBeNull();
    expect(result.tempPassword).toMatch(/^LB-.+!Aa$/);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "laura@test.com", email_confirm: true }),
    );
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("devuelve error de email duplicado sin tocar admin_profiles", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBe("Ya existe un usuario con ese email.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("compensa borrando el auth user si falla el insert de admin_profiles", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "admin_profiles") {
        return chain({ error: { message: "fail" } });
      }
      return chain({ error: null });
    });

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBe("No pudimos crear el usuario.");
    expect(mockDeleteUser).toHaveBeenCalledWith("u1");
  });

  it("compensa borrando el auth user si falla la asignación de rol", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "admin_profile_roles") {
        return chain({ error: { message: "fail" } });
      }
      return chain({ error: null });
    });

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBe("No pudimos crear el usuario.");
    expect(mockDeleteUser).toHaveBeenCalledWith("u1");
  });
});

describe("resetAdminPassword", () => {
  beforeEach(() => {
    mockUpdateUserById.mockReset();
  });

  it("genera y devuelve una contraseña temporal nueva", async () => {
    mockUpdateUserById.mockResolvedValue({ error: null });

    const result = await resetAdminPassword("u1");

    expect(result.error).toBeNull();
    expect(result.tempPassword).toMatch(/^LB-.+!Aa$/);
    expect(mockUpdateUserById).toHaveBeenCalledWith("u1", {
      password: result.tempPassword,
    });
  });

  it("devuelve error si falla la actualización", async () => {
    mockUpdateUserById.mockResolvedValue({ error: { message: "fail" } });

    const result = await resetAdminPassword("u1");

    expect(result.error).toBe("No pudimos restablecer la contraseña.");
  });
});

describe("wouldRemoveLastSuperAdmin", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("devuelve false si el usuario no tiene rol SUPER_ADMIN", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "super-role" }, error: null });
      }
      if (table === "admin_profile_roles") {
        return chain({ data: [{ admin_profile_id: "otro-user" }], error: null });
      }
      return chain({ count: 0, error: null });
    });

    const result = await wouldRemoveLastSuperAdmin("u1");
    expect(result).toBe(false);
  });

  it("devuelve true si es el único SUPER_ADMIN activo", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "super-role" }, error: null });
      }
      if (table === "admin_profile_roles") {
        return chain({ data: [{ admin_profile_id: "u1" }], error: null });
      }
      return chain({ count: 0, error: null });
    });

    const result = await wouldRemoveLastSuperAdmin("u1");
    expect(result).toBe(true);
  });

  it("devuelve false si es SUPER_ADMIN pero quedan otros activos", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "super-role" }, error: null });
      }
      if (table === "admin_profile_roles") {
        return chain({ data: [{ admin_profile_id: "u1" }, { admin_profile_id: "u2" }], error: null });
      }
      return chain({ count: 1, error: null });
    });

    const result = await wouldRemoveLastSuperAdmin("u1");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/admin/users.test.ts`
Expected: FAIL — el módulo `./users` no existe.

- [ ] **Step 3: Implementar**

Create `lib/admin/users.ts`:

```ts
import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export interface CreateAdminUserInput {
  fullName: string;
  email: string;
  roleId: string;
}

export interface AdminUserActionResult {
  error: string | null;
  tempPassword?: string;
}

export function generateTempPassword(): string {
  const token = randomBytes(6).toString("hex");
  return `LB-${token}!Aa`;
}

export async function createAdminUser({
  fullName,
  email,
  roleId,
}: CreateAdminUserInput): Promise<AdminUserActionResult> {
  const supabase = createServiceClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    console.error("createAdminUser: error creating auth user", createError);
    if (createError?.message?.toLowerCase().includes("already been registered")) {
      return { error: "Ya existe un usuario con ese email." };
    }
    return { error: "No pudimos crear el usuario." };
  }

  const userId = created.user.id;

  const { error: profileError } = await supabase
    .from("admin_profiles")
    .insert({ id: userId, full_name: fullName, is_active: true });

  if (profileError) {
    console.error("createAdminUser: error inserting admin_profile", profileError);
    await supabase.auth.admin.deleteUser(userId);
    return { error: "No pudimos crear el usuario." };
  }

  const { error: roleError } = await supabase
    .from("admin_profile_roles")
    .insert({ admin_profile_id: userId, role_id: roleId });

  if (roleError) {
    console.error("createAdminUser: error assigning role", roleError);
    await supabase.auth.admin.deleteUser(userId);
    return { error: "No pudimos crear el usuario." };
  }

  return { error: null, tempPassword };
}

export async function resetAdminPassword(userId: string): Promise<AdminUserActionResult> {
  const supabase = createServiceClient();
  const tempPassword = generateTempPassword();

  const { error } = await supabase.auth.admin.updateUserById(userId, { password: tempPassword });

  if (error) {
    console.error("resetAdminPassword: error updating password", error);
    return { error: "No pudimos restablecer la contraseña." };
  }

  return { error: null, tempPassword };
}

export async function wouldRemoveLastSuperAdmin(targetUserId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: superAdminRole } = await supabase
    .from("roles")
    .select("id")
    .eq("is_super_admin", true)
    .maybeSingle();

  if (!superAdminRole) {
    return false;
  }

  const { data: assignments } = await supabase
    .from("admin_profile_roles")
    .select("admin_profile_id")
    .eq("role_id", superAdminRole.id);

  const superAdminIds = (assignments ?? []).map((row) => row.admin_profile_id);
  if (!superAdminIds.includes(targetUserId)) {
    return false;
  }

  const { count } = await supabase
    .from("admin_profiles")
    .select("id", { count: "exact", head: true })
    .in("id", superAdminIds)
    .eq("is_active", true)
    .neq("id", targetUserId);

  return (count ?? 0) === 0;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/admin/users.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/admin/users.ts lib/admin/users.test.ts
git commit -m "feat: lib/admin/users con Auth Admin API y guard de auto-bloqueo"
```

---

### Task 3: Server Actions de usuarios

**Files:**
- Create: `lib/validations/user.ts`
- Create: `app/admin/(protected)/usuarios/actions.ts`
- Create: `app/admin/(protected)/usuarios/actions.test.ts`

**Interfaces:**
- Consumes: `withSuperAdminAction` (Task 1), `createAdminUser`,
  `resetAdminPassword`, `wouldRemoveLastSuperAdmin` (Task 2),
  `createServiceClient()`.
- Produces: `createUser`, `updateUser`, `toggleActive`, `resetPassword`,
  tipo `UserActionState` — usados por las Tareas 5, 6 y 7.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/validations/user.ts`:

```ts
import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z.string().min(1, "Ingresá un nombre."),
  email: z.string().email("Ingresá un email válido."),
  roleId: z.string().uuid("Elegí un rol."),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1, "Ingresá un nombre."),
  roleId: z.string().uuid("Elegí un rol."),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

Create `app/admin/(protected)/usuarios/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockServiceFrom = vi.fn();
const mockCreateAdminUser = vi.fn();
const mockResetAdminPassword = vi.fn();
const mockWouldRemoveLastSuperAdmin = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}));

vi.mock("@/lib/admin/users", () => ({
  createAdminUser: mockCreateAdminUser,
  resetAdminPassword: mockResetAdminPassword,
  wouldRemoveLastSuperAdmin: mockWouldRemoveLastSuperAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function mockSuperAdmin() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Jessica", is_active: true, role_names: ["SUPER_ADMIN"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: true, error: null });
  });
}

function mockNotSuperAdmin() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u2", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: false, error: null });
  });
}

function chain(result: unknown) {
  const query: Record<string, unknown> = {
    delete: () => query,
    update: () => query,
    eq: () => query,
    insert: async () => result,
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return query;
}

import { createUser, updateUser, toggleActive, resetPassword } from "./actions";

describe("createUser", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockCreateAdminUser.mockReset();
  });

  it("rechaza si no es SUPER_ADMIN", async () => {
    mockNotSuperAdmin();
    const formData = new FormData();
    formData.set("fullName", "Laura");
    formData.set("email", "laura@test.com");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await createUser({ error: null }, formData);

    expect(result.error).toBe("Solo un super administrador puede hacer esto.");
    expect(mockCreateAdminUser).not.toHaveBeenCalled();
  });

  it("valida el email antes de llamar a createAdminUser", async () => {
    mockSuperAdmin();
    const formData = new FormData();
    formData.set("fullName", "Laura");
    formData.set("email", "no-es-un-email");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await createUser({ error: null }, formData);

    expect(result.error).toBe("Ingresá un email válido.");
    expect(mockCreateAdminUser).not.toHaveBeenCalled();
  });

  it("crea el usuario y devuelve la contraseña temporal", async () => {
    mockSuperAdmin();
    mockCreateAdminUser.mockResolvedValue({ error: null, tempPassword: "LB-abc123!Aa" });
    const formData = new FormData();
    formData.set("fullName", "Laura");
    formData.set("email", "laura@test.com");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await createUser({ error: null }, formData);

    expect(result).toEqual({ error: null, tempPassword: "LB-abc123!Aa" });
  });
});

describe("toggleActive", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockServiceFrom.mockReset();
    mockWouldRemoveLastSuperAdmin.mockReset();
  });

  it("rechaza desactivar al último SUPER_ADMIN", async () => {
    mockSuperAdmin();
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(true);

    const result = await toggleActive("u1", false);

    expect(result.error).toBe("No podés dejar el sistema sin ningún SUPER_ADMIN activo.");
  });

  it("desactiva cuando el guard lo permite", async () => {
    mockSuperAdmin();
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(false);
    mockServiceFrom.mockImplementation(() => chain({ error: null }));

    const result = await toggleActive("u1", false);

    expect(result.error).toBeNull();
  });

  it("reactivar no llama al guard de auto-bloqueo", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation(() => chain({ error: null }));

    const result = await toggleActive("u1", true);

    expect(result.error).toBeNull();
    expect(mockWouldRemoveLastSuperAdmin).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockResetAdminPassword.mockReset();
  });

  it("rechaza si no es SUPER_ADMIN", async () => {
    mockNotSuperAdmin();

    const result = await resetPassword("u1");

    expect(result.error).toBe("Solo un super administrador puede hacer esto.");
    expect(mockResetAdminPassword).not.toHaveBeenCalled();
  });

  it("devuelve la nueva contraseña temporal", async () => {
    mockSuperAdmin();
    mockResetAdminPassword.mockResolvedValue({ error: null, tempPassword: "LB-xyz789!Aa" });

    const result = await resetPassword("u1");

    expect(result).toEqual({ error: null, tempPassword: "LB-xyz789!Aa" });
  });
});

describe("updateUser", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockServiceFrom.mockReset();
  });

  it("actualiza nombre y rol", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation(() => chain({ error: null }));
    const formData = new FormData();
    formData.set("fullName", "Laura Actualizada");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await updateUser("u1", { error: null }, formData);

    expect(result.error).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run "app/admin/(protected)/usuarios/actions.test.ts"`
Expected: FAIL — `./actions` no existe.

- [ ] **Step 3: Implementar**

Create `app/admin/(protected)/usuarios/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { withSuperAdminAction } from "@/lib/auth/permissions";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";
import { createAdminUser, resetAdminPassword, wouldRemoveLastSuperAdmin } from "@/lib/admin/users";

export interface UserActionState {
  error: string | null;
  tempPassword?: string;
}

const FORBIDDEN_USER: UserActionState = { error: "Solo un super administrador puede hacer esto." };

export async function createUser(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    const parsed = createUserSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      roleId: formData.get("roleId"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const result = await createAdminUser(parsed.data);
    if (result.error) {
      return { error: result.error };
    }

    revalidatePath("/admin/usuarios");
    return { error: null, tempPassword: result.tempPassword };
  });
}

export async function updateUser(
  id: string,
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    const parsed = updateUserSchema.safeParse({
      fullName: formData.get("fullName"),
      roleId: formData.get("roleId"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const supabase = createServiceClient();

    const { error: profileError } = await supabase
      .from("admin_profiles")
      .update({ full_name: parsed.data.fullName })
      .eq("id", id);

    if (profileError) {
      console.error("updateUser: error updating admin_profile", profileError);
      return { error: "No pudimos guardar los cambios." };
    }

    const { error: deleteRoleError } = await supabase
      .from("admin_profile_roles")
      .delete()
      .eq("admin_profile_id", id);

    if (deleteRoleError) {
      console.error("updateUser: error clearing roles", deleteRoleError);
      return { error: "No pudimos guardar los cambios." };
    }

    const { error: insertRoleError } = await supabase
      .from("admin_profile_roles")
      .insert({ admin_profile_id: id, role_id: parsed.data.roleId });

    if (insertRoleError) {
      console.error("updateUser: error assigning role", insertRoleError);
      return { error: "No pudimos guardar los cambios." };
    }

    revalidatePath("/admin/usuarios");
    return { error: null };
  });
}

export async function toggleActive(id: string, nextIsActive: boolean): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    if (!nextIsActive) {
      const wouldRemove = await wouldRemoveLastSuperAdmin(id);
      if (wouldRemove) {
        return { error: "No podés dejar el sistema sin ningún SUPER_ADMIN activo." };
      }
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("admin_profiles")
      .update({ is_active: nextIsActive })
      .eq("id", id);

    if (error) {
      console.error("toggleActive: error updating admin_profile", error);
      return { error: "No pudimos actualizar el usuario." };
    }

    revalidatePath("/admin/usuarios");
    return { error: null };
  });
}

export async function resetPassword(id: string): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    const result = await resetAdminPassword(id);
    if (result.error) {
      return { error: result.error };
    }
    return { error: null, tempPassword: result.tempPassword };
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run "app/admin/(protected)/usuarios/actions.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validations/user.ts "app/admin/(protected)/usuarios/actions.ts" "app/admin/(protected)/usuarios/actions.test.ts"
git commit -m "feat: server actions de usuarios (crear, editar, activar, resetear password)"
```

---

### Task 4: `TempPasswordDialog`

**Files:**
- Create: `components/admin/temp-password-dialog.tsx`

**Interfaces:**
- Consumes: nada del proyecto además de shadcn/ui.
- Produces: `<TempPasswordDialog open email password onClose />` — usado
  por las Tareas 5 y 6.

- [ ] **Step 1: Implementar**

Create `components/admin/temp-password-dialog.tsx`:

```tsx
"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TempPasswordDialogProps {
  open: boolean;
  email: string;
  password: string;
  onClose: () => void;
}

export function TempPasswordDialog({ open, email, password, onClose }: TempPasswordDialogProps) {
  function handleCopy() {
    navigator.clipboard.writeText(password);
    toast.success("Contraseña copiada.");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contraseña temporal generada</DialogTitle>
          <DialogDescription>
            {`Copiá esta contraseña y pasásela a ${email}. No vas a poder volver a verla.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 rounded border bg-muted p-4">
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="font-mono text-lg">{password}</p>
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={handleCopy}>
            Copiar
          </Button>
          <Button type="button" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: sin errores nuevos relacionados a este archivo.

- [ ] **Step 3: Commit**

```bash
git add components/admin/temp-password-dialog.tsx
git commit -m "feat: diálogo de contraseña temporal (crear usuario y reset)"
```

---

### Task 5: `UserDialog`

**Files:**
- Create: `components/admin/user-dialog.tsx`

**Interfaces:**
- Consumes: `createUser`, `updateUser`, `UserActionState` (Task 3),
  `TempPasswordDialog` (Task 4).
- Produces: `<UserDialog trigger roles user? />`, tipos `RoleOption`,
  `UserDialogValue` — usados por las Tareas 6 y 7.

- [ ] **Step 1: Implementar**

Create `components/admin/user-dialog.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";
import {
  createUser,
  updateUser,
  type UserActionState,
} from "@/app/admin/(protected)/usuarios/actions";

export interface RoleOption {
  id: string;
  name: string;
}

export interface UserDialogValue {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
}

interface UserDialogProps {
  trigger: React.ReactNode;
  roles: RoleOption[];
  user?: UserDialogValue;
}

const initialState: UserActionState = { error: null };

export function UserDialog({ trigger, roles, user }: UserDialogProps) {
  const [open, setOpen] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const isEdit = Boolean(user);
  const submittedRef = useRef(false);
  const submittedEmailRef = useRef("");

  const action = isEdit ? updateUser.bind(null, user!.id) : createUser;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    submittedRef.current = false;
    if (state.error !== null) {
      setDisplayError(state.error);
      return;
    }
    setDisplayError(null);
    // Cerrar el diálogo de formulario es una reacción al resultado del
    // server action (state), que solo se conoce después de que se resuelve;
    // no hay un event handler síncrono desde el cual dispararlo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    if (state.tempPassword) {
      setRevealedPassword(state.tempPassword);
    } else {
      toast.success("Usuario guardado.");
    }
  }, [state, pending]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDisplayError(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar usuario" : "Crear usuario"}</DialogTitle>
          </DialogHeader>
          <form
            action={formAction}
            onSubmit={(event) => {
              submittedRef.current = true;
              submittedEmailRef.current = String(
                new FormData(event.currentTarget).get("email") ?? "",
              );
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Nombre</Label>
              <Input id="fullName" name="fullName" defaultValue={user?.fullName ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user?.email ?? ""}
                required
                readOnly={isEdit}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="roleId">Rol</Label>
              <Select name="roleId" defaultValue={user?.roleId} required>
                <SelectTrigger id="roleId">
                  <SelectValue placeholder="Elegí un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {displayError && <p className="text-sm text-destructive">{displayError}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar usuario"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {revealedPassword && (
        <TempPasswordDialog
          open
          email={user?.email ?? submittedEmailRef.current}
          password={revealedPassword}
          onClose={() => setRevealedPassword(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: sin errores nuevos relacionados a este archivo.

- [ ] **Step 3: Commit**

```bash
git add components/admin/user-dialog.tsx
git commit -m "feat: diálogo de crear/editar usuario"
```

---

### Task 6: `UserRowActions`

**Files:**
- Create: `components/admin/user-row-actions.tsx`

**Interfaces:**
- Consumes: `UserDialog`, `RoleOption`, `UserDialogValue` (Task 5),
  `TempPasswordDialog` (Task 4), `toggleActive`, `resetPassword` (Task 3).
- Produces: `<UserRowActions user roles />` — usado por la Tarea 7.

- [ ] **Step 1: Implementar**

Create `components/admin/user-row-actions.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserDialog, type RoleOption, type UserDialogValue } from "@/components/admin/user-dialog";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";
import { toggleActive, resetPassword } from "@/app/admin/(protected)/usuarios/actions";

interface UserRowActionsProps {
  user: UserDialogValue & { isActive: boolean };
  roles: RoleOption[];
}

export function UserRowActions({ user, roles }: UserRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  function handleToggleActive(nextIsActive: boolean) {
    startTransition(async () => {
      const result = await toggleActive(user.id, nextIsActive);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(nextIsActive ? "Usuario reactivado." : "Usuario desactivado.");
      }
    });
  }

  function handleResetPassword() {
    startTransition(async () => {
      const result = await resetPassword(user.id);
      if (result.error) {
        toast.error(result.error);
      } else if (result.tempPassword) {
        setRevealedPassword(result.tempPassword);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <UserDialog trigger={<Button variant="outline">Editar</Button>} roles={roles} user={user} />

      {user.isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Restablecer contraseña
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{`¿Restablecer la contraseña de ${user.fullName}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                Se va a generar una nueva contraseña temporal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPassword}>Restablecer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {user.isActive ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={isPending}>
              Desactivar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{`¿Desactivar a ${user.fullName}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                No va a poder iniciar sesión hasta que lo reactives.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleToggleActive(false)}>
                Sí, desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => handleToggleActive(true)}
        >
          Reactivar
        </Button>
      )}

      {revealedPassword && (
        <TempPasswordDialog
          open
          email={user.email}
          password={revealedPassword}
          onClose={() => setRevealedPassword(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: sin errores nuevos relacionados a este archivo.

- [ ] **Step 3: Commit**

```bash
git add components/admin/user-row-actions.tsx
git commit -m "feat: acciones por fila de usuario (editar, resetear, activar/desactivar)"
```

---

### Task 7: Página `/admin/usuarios`

**Files:**
- Create: `app/admin/(protected)/usuarios/page.tsx`

**Interfaces:**
- Consumes: `getCurrentAdmin()`, `UserDialog`, `UserRowActions` (Tasks 5, 6).
- Produces: la ruta `/admin/usuarios`.

**Nota importante de esta tarea:** a diferencia de cualquier otra página del
admin, esta SÍ necesita un chequeo de permiso explícito. El email de cada
usuario vive en `auth.users`, no en `admin_profiles`, y listar los emails de
otros usuarios requiere la Auth Admin API (`service_role`), que no pasa por
RLS. Como el `service_role` bypassea la RLS por completo, si esta página no
chequeara el permiso a mano, cualquier admin logueado (tenga o no
`usuarios:ver`) podría ver la lista completa de emails. El resto de las
páginas del admin no necesita este chequeo porque delegan en la RLS.

- [ ] **Step 1: Implementar**

Create `app/admin/(protected)/usuarios/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserDialog } from "@/components/admin/user-dialog";
import { UserRowActions } from "@/components/admin/user-row-actions";

export default async function UsersPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl">Usuarios</h1>
        <p className="text-destructive">No pudimos verificar tu sesión.</p>
      </main>
    );
  }

  const isSuperAdmin = admin.roles.includes("SUPER_ADMIN");
  const sessionClient = await createClient();
  const { data: canView } = await sessionClient.rpc("has_permission", {
    p_user_id: admin.id,
    p_module: "usuarios",
    p_action: "ver",
  });

  if (!canView && !isSuperAdmin) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl">Usuarios</h1>
        <p className="text-destructive">No tenés permiso para ver esta página.</p>
      </main>
    );
  }

  const serviceClient = createServiceClient();

  const [
    { data: profiles, error: profilesError },
    { data: roles, error: rolesError },
    { data: authUsers, error: authError },
  ] = await Promise.all([
    serviceClient
      .from("admin_profiles")
      .select("id, full_name, is_active, admin_profile_roles(roles(id, name))")
      .order("full_name", { ascending: true }),
    serviceClient
      .from("roles")
      .select("id, name")
      .eq("is_super_admin", false)
      .order("name", { ascending: true }),
    serviceClient.auth.admin.listUsers(),
  ]);

  if (profilesError) console.error("UsersPage: error fetching admin_profiles", profilesError);
  if (rolesError) console.error("UsersPage: error fetching roles", rolesError);
  if (authError) console.error("UsersPage: error listing auth users", authError);

  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const roleOptions = roles ?? [];

  const rows = (profiles ?? []).map((profile) => {
    const assignedRole = profile.admin_profile_roles[0]?.roles ?? null;
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: emailById.get(profile.id) ?? "",
      isActive: profile.is_active,
      roleId: assignedRole?.id ?? "",
      roleName: assignedRole?.name ?? "Sin rol",
    };
  });

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Usuarios</h1>
        {isSuperAdmin && (
          <UserDialog trigger={<Button>+ Crear usuario</Button>} roles={roleOptions} />
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Todavía no creaste usuarios administrativos.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              {isSuperAdmin && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.fullName}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.roleName}</TableCell>
                <TableCell>{row.isActive ? "Activa" : "Inactiva"}</TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <UserRowActions
                      user={{
                        id: row.id,
                        fullName: row.fullName,
                        email: row.email,
                        roleId: row.roleId,
                        isActive: row.isActive,
                      }}
                      roles={roleOptions}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
```

**Nota para quien implemente:** el tipo inferido de
`admin_profile_roles(roles(id, name))` a través de los tipos generados de
Supabase puede no resolver limpiamente por default. Correr
`pnpm tsc --noEmit` apenas se escribe este archivo; si TypeScript no infiere
bien la forma anidada, encadenar
`.returns<{ id: string; full_name: string; is_active: boolean; admin_profile_roles: { roles: { id: string; name: string } | null }[] }[]>()`
después del `.order(...)` de esa consulta para fijar el tipo explícitamente
(feature soportada por `@supabase/supabase-js` v2).

- [ ] **Step 2: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: sin errores (aplicar la nota de arriba si hace falta).

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/usuarios/page.tsx"
git commit -m "feat: página /admin/usuarios"
```

---

### Task 8: Server Actions de roles

**Files:**
- Create: `lib/validations/role.ts`
- Create: `app/admin/(protected)/usuarios/roles/actions.ts`
- Create: `app/admin/(protected)/usuarios/roles/actions.test.ts`

**Interfaces:**
- Consumes: `withSuperAdminAction`, `PERMISSION_MODULES`,
  `PERMISSION_ACTIONS` (Task 1), `createServiceClient()`.
- Produces: `createRole`, `updateRole`, `deleteRole`, tipo
  `RoleActionState` — usados por las Tareas 9 y 10.

- [ ] **Step 1: Escribir el test que falla**

Create `lib/validations/role.ts`:

```ts
import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().min(1, "Ingresá un nombre para el rol."),
});

export type RoleInput = z.infer<typeof roleSchema>;
```

Create `app/admin/(protected)/usuarios/roles/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockServiceFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function mockSuperAdmin() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Jessica", is_active: true, role_names: ["SUPER_ADMIN"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: true, error: null });
  });
}

function mockNotSuperAdmin() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u2", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: false, error: null });
  });
}

function chain(result: unknown) {
  const query: Record<string, unknown> = {
    select: () => query,
    eq: () => query,
    delete: () => query,
    update: () => query,
    insert: async () => result,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return query;
}

import { createRole, updateRole, deleteRole } from "./actions";

describe("createRole", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockServiceFrom.mockReset();
  });

  it("rechaza si no es SUPER_ADMIN", async () => {
    mockNotSuperAdmin();
    const formData = new FormData();
    formData.set("name", "Vendedora");

    const result = await createRole({ error: null }, formData);

    expect(result.error).toBe("Solo un super administrador puede hacer esto.");
  });

  it("crea el rol y sus permisos marcados", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "role-1" }, error: null });
      }
      if (table === "permissions") {
        return chain({
          data: [
            { id: "p1", module: "productos", action: "ver" },
            { id: "p2", module: "productos", action: "crear" },
          ],
          error: null,
        });
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "Vendedora");
    formData.set("perm_productos_ver", "on");

    const result = await createRole({ error: null }, formData);

    expect(result.error).toBeNull();
  });
});

describe("updateRole", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockServiceFrom.mockReset();
  });

  it("rechaza editar el rol SUPER_ADMIN", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: true }, error: null });
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "SUPER_ADMIN editado");

    const result = await updateRole("super-role-id", { error: null }, formData);

    expect(result.error).toBe("El rol SUPER_ADMIN no se puede editar desde acá.");
  });

  it("actualiza nombre y recalcula permisos", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      if (table === "permissions") {
        return chain({ data: [{ id: "p1", module: "stock", action: "ver" }], error: null });
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "Stock");
    formData.set("perm_stock_ver", "on");

    const result = await updateRole("role-1", { error: null }, formData);

    expect(result.error).toBeNull();
  });
});

describe("deleteRole", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockServiceFrom.mockReset();
  });

  it("rechaza borrar el rol SUPER_ADMIN", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: true }, error: null });
      }
      return chain({ count: 0, error: null });
    });

    const result = await deleteRole("super-role-id");

    expect(result.error).toBe("El rol SUPER_ADMIN no se puede borrar.");
  });

  it("rechaza borrar un rol con usuarios asignados", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      return chain({ count: 2, error: null });
    });

    const result = await deleteRole("role-1");

    expect(result.error).toBe("Este rol tiene 2 usuarios asignados. Reasignalos antes de borrarlo.");
  });

  it("borra el rol cuando no tiene usuarios asignados", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      return chain({ count: 0, error: null });
    });

    const result = await deleteRole("role-1");

    expect(result.error).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run "app/admin/(protected)/usuarios/roles/actions.test.ts"`
Expected: FAIL — `./actions` no existe.

- [ ] **Step 3: Implementar**

Create `app/admin/(protected)/usuarios/roles/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import {
  withSuperAdminAction,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
} from "@/lib/auth/permissions";
import { roleSchema } from "@/lib/validations/role";

export interface RoleActionState {
  error: string | null;
}

const FORBIDDEN_ROLE: RoleActionState = { error: "Solo un super administrador puede hacer esto." };

function parsePermissionKeys(formData: FormData): { module: string; action: string }[] {
  const keys: { module: string; action: string }[] = [];
  for (const module of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      if (formData.get(`perm_${module}_${action}`) === "on") {
        keys.push({ module, action });
      }
    }
  }
  return keys;
}

async function getPermissionIds(
  supabase: ReturnType<typeof createServiceClient>,
  keys: { module: string; action: string }[],
): Promise<string[]> {
  if (keys.length === 0) {
    return [];
  }
  const { data: permissions, error } = await supabase.from("permissions").select("id, module, action");
  if (error || !permissions) {
    console.error("getPermissionIds: error fetching permissions catalog", error);
    return [];
  }
  const lookup = new Map(permissions.map((p) => [`${p.module}:${p.action}`, p.id]));
  return keys
    .map((key) => lookup.get(`${key.module}:${key.action}`))
    .filter((id): id is string => Boolean(id));
}

export async function createRole(
  _prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  return withSuperAdminAction(FORBIDDEN_ROLE, async () => {
    const parsed = roleSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const supabase = createServiceClient();

    const { data: role, error: insertError } = await supabase
      .from("roles")
      .insert({ name: parsed.data.name, is_super_admin: false })
      .select("id")
      .single();

    if (insertError || !role) {
      console.error("createRole: error inserting role", insertError);
      return { error: "No pudimos crear el rol." };
    }

    const permissionIds = await getPermissionIds(supabase, parsePermissionKeys(formData));
    if (permissionIds.length > 0) {
      const { error: permError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId })));

      if (permError) {
        console.error("createRole: error inserting role_permissions", permError);
        return { error: "No pudimos guardar los permisos del rol." };
      }
    }

    revalidatePath("/admin/usuarios/roles");
    return { error: null };
  });
}

export async function updateRole(
  id: string,
  _prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  return withSuperAdminAction(FORBIDDEN_ROLE, async () => {
    const parsed = roleSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const supabase = createServiceClient();

    const { data: existingRole, error: fetchError } = await supabase
      .from("roles")
      .select("is_super_admin")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingRole) {
      console.error("updateRole: error fetching role", fetchError);
      return { error: "No pudimos guardar los cambios." };
    }

    if (existingRole.is_super_admin) {
      return { error: "El rol SUPER_ADMIN no se puede editar desde acá." };
    }

    const { error: updateError } = await supabase
      .from("roles")
      .update({ name: parsed.data.name })
      .eq("id", id);

    if (updateError) {
      console.error("updateRole: error updating role", updateError);
      return { error: "No pudimos guardar los cambios." };
    }

    const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", id);
    if (deleteError) {
      console.error("updateRole: error clearing role_permissions", deleteError);
      return { error: "No pudimos guardar los permisos del rol." };
    }

    const permissionIds = await getPermissionIds(supabase, parsePermissionKeys(formData));
    if (permissionIds.length > 0) {
      const { error: permError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: id, permission_id: permissionId })));

      if (permError) {
        console.error("updateRole: error inserting role_permissions", permError);
        return { error: "No pudimos guardar los permisos del rol." };
      }
    }

    revalidatePath("/admin/usuarios/roles");
    return { error: null };
  });
}

export async function deleteRole(id: string): Promise<RoleActionState> {
  return withSuperAdminAction(FORBIDDEN_ROLE, async () => {
    const supabase = createServiceClient();

    const { data: existingRole, error: fetchError } = await supabase
      .from("roles")
      .select("is_super_admin")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingRole) {
      console.error("deleteRole: error fetching role", fetchError);
      return { error: "No pudimos borrar el rol." };
    }

    if (existingRole.is_super_admin) {
      return { error: "El rol SUPER_ADMIN no se puede borrar." };
    }

    const { count, error: countError } = await supabase
      .from("admin_profile_roles")
      .select("admin_profile_id", { count: "exact", head: true })
      .eq("role_id", id);

    if (countError) {
      console.error("deleteRole: error counting assigned users", countError);
      return { error: "No pudimos borrar el rol." };
    }

    const assignedCount = count ?? 0;
    if (assignedCount > 0) {
      return {
        error: `Este rol tiene ${assignedCount} usuario${assignedCount === 1 ? "" : "s"} asignado${assignedCount === 1 ? "" : "s"}. Reasignalos antes de borrarlo.`,
      };
    }

    const { error: deleteError } = await supabase.from("roles").delete().eq("id", id);
    if (deleteError) {
      console.error("deleteRole: error deleting role", deleteError);
      return { error: "No pudimos borrar el rol." };
    }

    revalidatePath("/admin/usuarios/roles");
    return { error: null };
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run "app/admin/(protected)/usuarios/roles/actions.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validations/role.ts "app/admin/(protected)/usuarios/roles/actions.ts" "app/admin/(protected)/usuarios/roles/actions.test.ts"
git commit -m "feat: server actions de roles (crear, editar, borrar) con matriz de permisos"
```

---

### Task 9: `RoleForm`

**Files:**
- Create: `components/admin/role-form.tsx`

**Interfaces:**
- Consumes: `createRole`, `updateRole`, `RoleActionState` (Task 8),
  `PERMISSION_MODULES`, `PERMISSION_ACTIONS`, `PermissionModule`,
  `PermissionAction` (Task 1).
- Produces: `<RoleForm mode roleId? initialName? initialPermissions? />` —
  usado por la Tarea 10.

- [ ] **Step 1: Implementar**

Create `components/admin/role-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createRole,
  updateRole,
  type RoleActionState,
} from "@/app/admin/(protected)/usuarios/roles/actions";
import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  type PermissionModule,
  type PermissionAction,
} from "@/lib/auth/permissions";

const MODULE_LABELS: Record<PermissionModule, string> = {
  productos: "Productos",
  precios: "Precios",
  stock: "Stock",
  pedidos: "Pedidos",
  clientes: "Clientes",
  facturacion: "Facturación",
  usuarios: "Usuarios",
  configuracion: "Configuración",
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
};

interface RoleFormProps {
  mode: "create" | "edit";
  roleId?: string;
  initialName?: string;
  initialPermissions?: { module: PermissionModule; action: PermissionAction }[];
}

const initialState: RoleActionState = { error: null };

export function RoleForm({ mode, roleId, initialName, initialPermissions }: RoleFormProps) {
  const router = useRouter();
  const submittedRef = useRef(false);
  const checkedSet = new Set((initialPermissions ?? []).map((p) => `${p.module}_${p.action}`));

  const action = mode === "edit" ? updateRole.bind(null, roleId!) : createRole;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    submittedRef.current = false;
    if (state.error === null) {
      toast.success("Rol guardado.");
      router.push("/admin/usuarios/roles");
    }
  }, [state, pending, router]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="flex max-w-3xl flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre del rol</Label>
        <Input id="name" name="name" defaultValue={initialName ?? ""} required />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">¿Qué puede hacer?</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              {PERMISSION_ACTIONS.map((action) => (
                <TableHead key={action} className="text-center">
                  {ACTION_LABELS[action]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_MODULES.map((module) => (
              <TableRow key={module}>
                <TableCell>{MODULE_LABELS[module]}</TableCell>
                {PERMISSION_ACTIONS.map((action) => (
                  <TableCell key={action} className="text-center">
                    <Checkbox
                      name={`perm_${module}_${action}`}
                      defaultChecked={checkedSet.has(`${module}_${action}`)}
                      aria-label={`${MODULE_LABELS[module]} - ${ACTION_LABELS[action]}`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar rol"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: sin errores nuevos relacionados a este archivo.

- [ ] **Step 3: Commit**

```bash
git add components/admin/role-form.tsx
git commit -m "feat: formulario de rol con matriz visual de permisos"
```

---

### Task 10: Páginas de roles

**Files:**
- Create: `components/admin/delete-role-button.tsx`
- Create: `app/admin/(protected)/usuarios/roles/page.tsx`
- Create: `app/admin/(protected)/usuarios/roles/nueva/page.tsx`
- Create: `app/admin/(protected)/usuarios/roles/[id]/page.tsx`

**Interfaces:**
- Consumes: `RoleForm` (Task 9), `deleteRole` (Task 8), `getCurrentAdmin()`.
- Produces: las rutas `/admin/usuarios/roles`,
  `/admin/usuarios/roles/nueva`, `/admin/usuarios/roles/[id]`.

- [ ] **Step 1: Implementar**

Create `components/admin/delete-role-button.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteRole } from "@/app/admin/(protected)/usuarios/roles/actions";

interface DeleteRoleButtonProps {
  roleId: string;
  roleName: string;
}

export function DeleteRoleButton({ roleId, roleName }: DeleteRoleButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRole(roleId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Rol borrado.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={isPending}>
          Borrar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`¿Borrar el rol ${roleName}?`}</AlertDialogTitle>
          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Sí, borrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Create `app/admin/(protected)/usuarios/roles/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteRoleButton } from "@/components/admin/delete-role-button";

export default async function RolesPage() {
  const admin = await getCurrentAdmin();
  const isSuperAdmin = admin?.roles.includes("SUPER_ADMIN") ?? false;

  const supabase = await createClient();

  const [{ data: roles, error: rolesError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("roles")
        .select("id, name")
        .eq("is_super_admin", false)
        .order("name", { ascending: true }),
      supabase.from("admin_profile_roles").select("role_id"),
    ]);

  if (rolesError) console.error("RolesPage: error fetching roles", rolesError);
  if (assignmentsError) {
    console.error("RolesPage: error fetching admin_profile_roles", assignmentsError);
  }

  const countByRole = new Map<string, number>();
  for (const row of assignments ?? []) {
    countByRole.set(row.role_id, (countByRole.get(row.role_id) ?? 0) + 1);
  }

  const rows = roles ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Roles</h1>
        {isSuperAdmin && (
          <Button asChild>
            <Link href="/admin/usuarios/roles/nueva">+ Crear rol</Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Todavía no creaste roles.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Usuarios asignados</TableHead>
              {isSuperAdmin && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((role) => (
              <TableRow key={role.id}>
                <TableCell>{role.name}</TableCell>
                <TableCell>{countByRole.get(role.id) ?? 0}</TableCell>
                {isSuperAdmin && (
                  <TableCell className="flex gap-2">
                    <Button variant="outline" asChild>
                      <Link href={`/admin/usuarios/roles/${role.id}`}>Editar</Link>
                    </Button>
                    <DeleteRoleButton roleId={role.id} roleName={role.name} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
```

Create `app/admin/(protected)/usuarios/roles/nueva/page.tsx`:

```tsx
import { RoleForm } from "@/components/admin/role-form";

export default function NewRolePage() {
  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Crear rol</h1>
      <RoleForm mode="create" />
    </main>
  );
}
```

Create `app/admin/(protected)/usuarios/roles/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleForm } from "@/components/admin/role-form";
import type { PermissionModule, PermissionAction } from "@/lib/auth/permissions";

interface EditRolePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRolePage({ params }: EditRolePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: role } = await supabase
    .from("roles")
    .select("id, name, is_super_admin")
    .eq("id", id)
    .maybeSingle();

  if (!role || role.is_super_admin) {
    notFound();
  }

  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("permissions(module, action)")
    .eq("role_id", id);

  const initialPermissions = (rolePermissions ?? [])
    .map((row) => row.permissions)
    .filter((p): p is { module: PermissionModule; action: PermissionAction } => Boolean(p));

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Editar rol</h1>
      <RoleForm
        mode="edit"
        roleId={role.id}
        initialName={role.name}
        initialPermissions={initialPermissions}
      />
    </main>
  );
}
```

**Nota para quien implemente:** igual que en la Tarea 7, si
`role_permissions(select("permissions(module, action)"))` no infiere bien el
tipo anidado, fijarlo con `.returns<...>()`.

- [ ] **Step 2: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: sin errores (aplicar la nota de arriba si hace falta).

- [ ] **Step 3: Commit**

```bash
git add components/admin/delete-role-button.tsx "app/admin/(protected)/usuarios/roles/page.tsx" "app/admin/(protected)/usuarios/roles/nueva/page.tsx" "app/admin/(protected)/usuarios/roles/[id]/page.tsx"
git commit -m "feat: páginas de listado, alta y edición de roles"
```

---

### Task 11: Navegación

**Files:**
- Modify: `components/admin/sidebar.tsx`
- Modify: `components/admin/sidebar.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Agregar dentro del primer `it(...)` de `components/admin/sidebar.test.tsx`
(después de la aserción de "Categorías"), o como aserción nueva en ese mismo
bloque:

```ts
    expect(screen.getByRole("link", { name: "Usuarios y Roles" })).toHaveAttribute(
      "href",
      "/admin/usuarios",
    );
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/admin/sidebar.test.tsx`
Expected: FAIL — el link "Usuarios y Roles" no existe todavía.

- [ ] **Step 3: Implementar**

En `components/admin/sidebar.tsx`, agregar dentro de `NavLinks`, después del
link a "Configuración":

```tsx
      <Link
        href="/admin/usuarios"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Usuarios y Roles
      </Link>
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/admin/sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/admin/sidebar.tsx components/admin/sidebar.test.tsx
git commit -m "feat: link de navegación a Usuarios y Roles"
```

---

### Task 12: Verificación local y sincronización a producción

**Files:** ninguno (tarea de verificación, no de código).

- [ ] **Step 1: Verificación local completa**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: los cuatro comandos terminan sin errores.

- [ ] **Step 2: Confirmar con el usuario antes de tocar producción**

No hay migraciones nuevas que pushear (el esquema RBAC ya existe desde
Fase 1a) — este paso es solo un deploy de código. Preguntar explícitamente
antes de pushear a producción, seleccionar los 4 comandos usados en fases
anteriores:

```bash
git push origin nueva-ui
git push origin nueva-ui:main
```

- [ ] **Step 3: Verificar el deploy**

Confirmar que el deployment de producción quedó en estado `READY` (vía
Vercel MCP: `list_deployments`/`get_deployment` sobre el proyecto
`libreriablanco`), apuntando al commit del último push a `main`.

- [ ] **Step 4: Verificación interactiva**

Fuera del alcance de este plan de tareas automatizadas: el controller debe
verificar manualmente contra producción (vía Playwright, si está disponible)
un flujo real de punta a punta — crear un rol de prueba con un permiso
mínimo, crear un usuario de prueba con ese rol, confirmar que la contraseña
temporal generada permite loguearse, y luego limpiar (desactivar/borrar el
usuario y el rol de prueba, y borrar la cuenta de Supabase Auth creada) —
siguiendo el mismo cuidado de reversibilidad usado en Fase 6 para la subida
de logo de prueba.
