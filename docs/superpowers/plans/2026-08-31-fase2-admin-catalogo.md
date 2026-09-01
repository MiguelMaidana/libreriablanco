# Fase 2 — Admin: Catálogo — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por
> tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Construir el módulo de Catálogo del backoffice: layout de
admin con sidebar, CRUD completo de categorías, alta/edición de
productos con imágenes y cálculo de precio en vivo, y control de
disponibilidad/publicación/destacado — todo protegido por
`requirePermission`/`withPermission` en cada Server Action.

**Arquitectura:** Server Components para lectura (listas, formularios
en modo edición pre-poblados), Server Actions para toda mutación,
`useActionState` de React 19 para el estado de los formularios (mismo
patrón que el login de Fase 1b), Supabase Storage para imágenes. Sin
react-hook-form, sin librerías de drag-and-drop.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod v4,
Tailwind v4 + shadcn/ui (new-york), Supabase (Postgres + Storage),
Vitest + Testing Library, sonner (toasts).

**Spec:** `docs/superpowers/specs/2026-08-31-fase2-admin-catalogo-design.md`

## Global Constraints

- Toda Server Action que muta datos de catálogo llama
  `withPermission(module, action, fn)` como primera operación — nunca
  confiar solo en RLS.
- Ningún mensaje de error hacia la UI expone el texto crudo de
  Postgres/Supabase — siempre un mensaje de negocio en español
  (spec maestra §47, §99).
- Slugs de categoría se generan con `slugify()` propio (sin sumar una
  dependencia) y se verifica unicidad server-side antes de guardar.
- Máximo 4 imágenes por producto, validado server-side, no solo en la UI.
- No se agrega react-hook-form ni ninguna librería de drag-and-drop.
- Todo componente nuevo de shadcn/ui se agrega con
  `pnpm dlx shadcn@latest add <componente>` — nunca se escribe a mano
  un componente de `components/ui/`.
- Cada test usa el mismo patrón de mock que
  `lib/auth/permissions.test.ts`: `vi.mock("@/lib/supabase/server", ...)`
  con `vi.fn()` para `rpc`/`from`, nunca una base de datos real.
- Todas las tablas de esta fase (`categories`, `products`,
  `product_images`) y sus políticas RLS ya existen desde Fase 1a — este
  plan no crea tablas nuevas, solo el bucket de Storage.

---

### Task 1: Componentes de UI faltantes + utilidades compartidas

**Files:**
- Modify: `lib/utils.ts` (agrega `slugify`)
- Create: `lib/utils.test.ts`
- Modify: `lib/auth/permissions.ts` (agrega `withPermission`)
- Modify: `lib/auth/permissions.test.ts` (agrega casos de `withPermission`)
- Genera vía CLI: `components/ui/accordion.tsx`, `components/ui/alert-dialog.tsx`, `components/ui/textarea.tsx`, `components/ui/label.tsx`

**Interfaces:**
- Produce: `slugify(input: string): string` — usado por Tasks 3, 4.
- Produce: `withPermission<T>(module: PermissionModule, action: PermissionAction, fn: (admin: AdminProfile) => Promise<T>): Promise<T>` — usado por Tasks 3, 7, 9.
- Produce: componentes shadcn `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`, `AlertDialog` (+ subcomponentes estándar de shadcn), `Textarea`, `Label` — usados por Task 8.

- [ ] **Step 1: Escribir el test de `slugify`**

```typescript
// lib/utils.test.ts
import { describe, it, expect } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
  it("convierte a minúsculas y reemplaza espacios por guiones", () => {
    expect(slugify("Papelería Escolar")).toBe("papeleria-escolar");
  });

  it("elimina acentos y diacríticos", () => {
    expect(slugify("Artística")).toBe("artistica");
  });

  it("colapsa espacios múltiples y recorta guiones en los extremos", () => {
    expect(slugify("  Útiles   de Oficina  ")).toBe("utiles-de-oficina");
  });

  it("elimina caracteres que no son letras, números o guiones", () => {
    expect(slugify("Cuadernos & Carpetas (2026)")).toBe("cuadernos-carpetas-2026");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/utils.test.ts`
Expected: FAIL — `slugify` no existe todavía.

- [ ] **Step 3: Implementar `slugify` en `lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/utils.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir los tests de `withPermission`**

Agregar al final de `lib/auth/permissions.test.ts` (mismo archivo, mismo
mock de `@/lib/supabase/server` ya declarado arriba):

```typescript
describe("withPermission", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("ejecuta la función cuando el permiso está concedido", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["SUPER_ADMIN"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    const result = await withPermission("productos", "crear", async (admin) => {
      return `hola ${admin.fullName}`;
    });

    expect(result).toBe("hola Admin");
  });

  it("propaga ForbiddenError sin ejecutar la función cuando el permiso es denegado", async () => {
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

    await expect(withPermission("productos", "eliminar", fn)).rejects.toThrow(ForbiddenError);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/auth/permissions.test.ts`
Expected: FAIL — `withPermission` no existe todavía.

- [ ] **Step 7: Implementar `withPermission` en `lib/auth/permissions.ts`**

Agregar al final del archivo, después de `requirePermission`:

```typescript
export async function withPermission<T>(
  module: PermissionModule,
  action: PermissionAction,
  fn: (admin: AdminProfile) => Promise<T>,
): Promise<T> {
  const admin = await requirePermission(module, action);
  return fn(admin);
}
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/auth/permissions.test.ts`
Expected: PASS (todos los casos, incluidos los 2 nuevos)

- [ ] **Step 9: Agregar los componentes de shadcn/ui faltantes**

Run: `pnpm dlx shadcn@latest add accordion alert-dialog textarea label`

Esto crea `components/ui/accordion.tsx`, `components/ui/alert-dialog.tsx`,
`components/ui/textarea.tsx` y `components/ui/label.tsx` con el estilo
"new-york" ya configurado en `components.json`. No requiere test propio
(son componentes base de shadcn, igual que los ya existentes en el
proyecto).

- [ ] **Step 10: Verificar que el proyecto sigue compilando**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 11: Commit**

```bash
git add lib/utils.ts lib/utils.test.ts lib/auth/permissions.ts lib/auth/permissions.test.ts components/ui/accordion.tsx components/ui/alert-dialog.tsx components/ui/textarea.tsx components/ui/label.tsx package.json pnpm-lock.yaml
git commit -m "feat: slugify, withPermission y componentes de UI faltantes para Fase 2"
```

---

### Task 2: Bucket de Storage para imágenes de producto

**Files:**
- Create: migración vía `supabase migration new product_images_bucket`

**Interfaces:**
- Produce: bucket público `product-images` en Supabase Storage, con
  lectura pública y escritura restringida a `has_permission(auth.uid(), 'productos', 'editar')`.
  Usado por Task 9.

- [ ] **Step 1: Crear el archivo de migración**

Run: `supabase migration new product_images_bucket`

Esto imprime la ruta del archivo creado, ej.
`supabase/migrations/20260901000000_product_images_bucket.sql`. Usar
esa ruta exacta en los pasos siguientes.

- [ ] **Step 2: Escribir el contenido de la migración**

```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public read product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "admins with productos editar manage product image files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_permission(auth.uid(), 'productos', 'editar')
)
with check (
  bucket_id = 'product-images'
  and public.has_permission(auth.uid(), 'productos', 'editar')
);
```

- [ ] **Step 3: Aplicar la migración en local y verificar**

Run: `supabase db reset`
Expected: la migración corre sin error junto con todas las anteriores.

Verificar el bucket:

Run: `supabase db execute --sql "select id, public from storage.buckets where id = 'product-images';"`

Expected: una fila `product-images | t`.

- [ ] **Step 4: Regenerar tipos de TypeScript**

Run: `supabase gen types typescript --local > types/supabase.ts`

Expected: el diff no debería cambiar las tablas existentes (Storage no
forma parte del esquema `public` que exporta `gen types`); si el
comando no agrega nada nuevo al archivo, es el resultado esperado —
confirmar igual que el comando corrió sin error.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_product_images_bucket.sql types/supabase.ts
git commit -m "feat: bucket de Storage product-images con políticas de admin"
```

---

### Task 3: Validación y Server Actions de Categorías

**Files:**
- Create: `lib/validations/category.ts`
- Create: `lib/validations/category.test.ts`
- Create: `app/admin/(protected)/categorias/actions.ts`
- Create: `app/admin/(protected)/categorias/actions.test.ts`

**Interfaces:**
- Consumes: `withPermission` de `lib/auth/permissions.ts` (Task 1),
  `slugify` de `lib/utils.ts` (Task 1), `createClient` de
  `lib/supabase/server.ts` (ya existe).
- Produces: `categorySchema` (Zod), tipo `CategoryInput`; Server
  Actions `createCategory`, `updateCategory`, `toggleCategoryActive`,
  tipo `CategoryActionState`. Usadas por Task 4.

- [ ] **Step 1: Escribir el test de `categorySchema`**

```typescript
// lib/validations/category.test.ts
import { describe, it, expect } from "vitest";
import { categorySchema } from "./category";

describe("categorySchema", () => {
  it("acepta un nombre válido con flags booleanos", () => {
    const result = categorySchema.safeParse({
      name: "Papelería",
      isFeatured: true,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un nombre vacío", () => {
    const result = categorySchema.safeParse({
      name: "",
      isFeatured: false,
      isActive: true,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/validations/category.test.ts`
Expected: FAIL — el módulo `./category` no existe.

- [ ] **Step 3: Implementar `lib/validations/category.ts`**

```typescript
import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Ingresá un nombre."),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/validations/category.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Escribir los tests de las Server Actions de categoría**

```typescript
// app/admin/(protected)/categorias/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

function mockAdminAllowed() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["SUPER_ADMIN"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: true, error: null });
  });
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

import { createCategory, updateCategory, toggleCategoryActive } from "./actions";

describe("createCategory", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de validación si falta el nombre", async () => {
    mockAdminAllowed();

    const result = await createCategory(
      { error: null },
      formData({ name: "", isFeatured: "", isActive: "on" }),
    );

    expect(result.error).toBe("Revisá los datos ingresados.");
  });

  it("genera un slug único y crea la categoría", async () => {
    mockAdminAllowed();

    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      insert,
    });

    const result = await createCategory(
      { error: null },
      formData({ name: "Papelería", isFeatured: "on", isActive: "on" }),
    );

    expect(result.error).toBeNull();
    expect(insert).toHaveBeenCalledWith({
      name: "Papelería",
      slug: "papeleria",
      is_featured: true,
      is_active: true,
    });
  });

  it("agrega un sufijo numérico si el slug ya existe", async () => {
    mockAdminAllowed();

    let call = 0;
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => {
        call += 1;
        return call === 1 ? { data: { id: "existing" }, error: null } : { data: null, error: null };
      }),
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      insert,
    });

    await createCategory(
      { error: null },
      formData({ name: "Papelería", isFeatured: "", isActive: "on" }),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "papeleria-2" }),
    );
  });
});

describe("toggleCategoryActive", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("actualiza is_active con el valor recibido", async () => {
    mockAdminAllowed();

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await toggleCategoryActive("cat-1", false);

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ is_active: false });
    expect(eq).toHaveBeenCalledWith("id", "cat-1");
  });
});
```

Nota: `updateCategory` reutiliza exactamente la misma lógica que
`createCategory` (mismo schema, mismo generador de slug excluyendo el
propio id) — no lleva un test separado de generación de slug para no
duplicar el caso ya cubierto arriba; sí queda cubierta por la
verificación manual de Task 11 (editar una categoría y confirmar que
el slug se actualiza).

- [ ] **Step 6: Correr los tests y verificar que fallan**

Run: `pnpm vitest run "app/admin/(protected)/categorias/actions.test.ts"`
Expected: FAIL — `./actions` no existe.

- [ ] **Step 7: Implementar `app/admin/(protected)/categorias/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermission } from "@/lib/auth/permissions";
import { categorySchema } from "@/lib/validations/category";
import { slugify } from "@/lib/utils";

export interface CategoryActionState {
  error: string | null;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function uniqueSlug(
  supabase: SupabaseClient,
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (;;) {
    let query = supabase.from("categories").select("id").eq("slug", candidate);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data } = await query.maybeSingle();
    if (!data) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function parseCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    isFeatured: formData.get("isFeatured") === "on",
    isActive: formData.get("isActive") === "on",
  });
}

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  return withPermission("productos", "crear", async () => {
    const parsed = parseCategoryForm(formData);
    if (!parsed.success) {
      return { error: "Revisá los datos ingresados." };
    }

    const supabase = await createClient();
    const slug = await uniqueSlug(supabase, slugify(parsed.data.name));

    const { error } = await supabase.from("categories").insert({
      name: parsed.data.name,
      slug,
      is_featured: parsed.data.isFeatured,
      is_active: parsed.data.isActive,
    });

    if (error) {
      console.error("createCategory: error inserting category", error);
      return { error: "No pudimos guardar la categoría." };
    }

    revalidatePath("/admin/categorias");
    return { error: null };
  });
}

export async function updateCategory(
  id: string,
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  return withPermission("productos", "editar", async () => {
    const parsed = parseCategoryForm(formData);
    if (!parsed.success) {
      return { error: "Revisá los datos ingresados." };
    }

    const supabase = await createClient();
    const slug = await uniqueSlug(supabase, slugify(parsed.data.name), id);

    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        slug,
        is_featured: parsed.data.isFeatured,
        is_active: parsed.data.isActive,
      })
      .eq("id", id);

    if (error) {
      console.error("updateCategory: error updating category", error);
      return { error: "No pudimos guardar la categoría." };
    }

    revalidatePath("/admin/categorias");
    return { error: null };
  });
}

export async function toggleCategoryActive(
  id: string,
  nextIsActive: boolean,
): Promise<CategoryActionState> {
  return withPermission("productos", "editar", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("categories")
      .update({ is_active: nextIsActive })
      .eq("id", id);

    if (error) {
      console.error("toggleCategoryActive: error updating category", error);
      return { error: "No pudimos actualizar la categoría." };
    }

    revalidatePath("/admin/categorias");
    return { error: null };
  });
}
```

**Nota para quien implemente:** `uniqueSlug` excluye el propio registro
de la comprobación cuando se está editando aplicando `.neq("id", excludeId)`
a la query antes de `.maybeSingle()`. Ajustá el mock de `selectChain`
del Step 5 si hace falta: agregale `neq: vi.fn().mockReturnThis()` para
que también soporte encadenar `.neq` en los casos que pasan `excludeId`.

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `pnpm vitest run "app/admin/(protected)/categorias/actions.test.ts"`
Expected: PASS (todos los casos)

- [ ] **Step 9: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add lib/validations/category.ts lib/validations/category.test.ts "app/admin/(protected)/categorias/actions.ts" "app/admin/(protected)/categorias/actions.test.ts"
git commit -m "feat: validación y Server Actions de categorías"
```

---

### Task 4: UI de Categorías (lista + diálogo de alta/edición)

**Files:**
- Create: `app/admin/(protected)/categorias/page.tsx`
- Create: `components/admin/category-dialog.tsx`
- Create: `components/admin/category-dialog.test.tsx`

**Interfaces:**
- Consumes: `createCategory`, `updateCategory`, `toggleCategoryActive`
  de Task 3; componentes `Dialog`, `Switch`, `Table`, `Button`, `Input`,
  `Label` (existentes + Task 1).
- Produces: página `/admin/categorias`, componente `CategoryDialog`
  reutilizado por Task 5 (sidebar no lo usa, pero queda documentado
  para consistencia con la carpeta `components/admin/`).

- [ ] **Step 1: Escribir el test de `CategoryDialog`**

```tsx
// components/admin/category-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryDialog } from "./category-dialog";

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return { ...actual };
});

describe("CategoryDialog", () => {
  it("muestra 'Crear categoría' cuando no hay categoría inicial", async () => {
    const user = userEvent.setup();
    render(<CategoryDialog trigger={<button>Abrir</button>} />);

    await user.click(screen.getByText("Abrir"));

    expect(screen.getByText("Crear categoría")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
  });

  it("pre-popula el formulario cuando se pasa una categoría existente", async () => {
    const user = userEvent.setup();
    render(
      <CategoryDialog
        trigger={<button>Editar</button>}
        category={{ id: "cat-1", name: "Papelería", isFeatured: true, isActive: true }}
      />,
    );

    await user.click(screen.getByText("Editar"));

    expect(screen.getByText("Editar categoría")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Papelería");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/admin/category-dialog.test.tsx`
Expected: FAIL — el módulo `./category-dialog` no existe.

- [ ] **Step 3: Implementar `components/admin/category-dialog.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  createCategory,
  updateCategory,
  type CategoryActionState,
} from "@/app/admin/(protected)/categorias/actions";
import { toast } from "sonner";

export interface CategoryDialogValue {
  id: string;
  name: string;
  isFeatured: boolean;
  isActive: boolean;
}

interface CategoryDialogProps {
  trigger: React.ReactNode;
  category?: CategoryDialogValue;
}

const initialState: CategoryActionState = { error: null };

export function CategoryDialog({ trigger, category }: CategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(category);
  const submittedRef = useRef(false);

  const action = isEdit ? updateCategory.bind(null, category!.id) : createCategory;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    if (state.error === null) {
      toast.success(isEdit ? "Categoría guardada." : "Categoría creada.");
      setOpen(false);
      submittedRef.current = false;
    }
  }, [state, pending, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría" : "Crear categoría"}</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => {
            submittedRef.current = true;
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={category?.name ?? ""} required />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isFeatured">Destacada</Label>
            <Switch id="isFeatured" name="isFeatured" defaultChecked={category?.isFeatured ?? false} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Activa</Label>
            <Switch id="isActive" name="isActive" defaultChecked={category?.isActive ?? true} />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar categoría"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/admin/category-dialog.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Implementar la página `/admin/categorias`**

```tsx
// app/admin/(protected)/categorias/page.tsx
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { toggleCategoryActive } from "./actions";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, is_featured, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("CategoriesPage: error fetching categories", error);
  }

  const rows = categories ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Categorías</h1>
        <CategoryDialog trigger={<Button>+ Crear categoría</Button>} />
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no creaste categorías. Agregá la primera para poder cargar productos.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Destacada</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell>{category.is_featured ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <form
                    action={async () => {
                      "use server";
                      await toggleCategoryActive(category.id, !category.is_active);
                    }}
                  >
                    <Switch type="submit" checked={category.is_active} />
                  </form>
                </TableCell>
                <TableCell>
                  <CategoryDialog
                    trigger={<Button variant="outline">Editar</Button>}
                    category={{
                      id: category.id,
                      name: category.name,
                      isFeatured: category.is_featured,
                      isActive: category.is_active,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
```

**Nota para quien implemente:** un `<Switch>` de Radix no dispara un
submit de formulario al tocarlo (no es un `<button type="submit">`
real) — el `type="submit"` en `<Switch>` de arriba no tiene efecto.
Reemplazá esa celda por un botón explícito que llame al Server Action
con `useTransition` en un pequeño Client Component, ya que
`toggleCategoryActive` necesita reaccionar al click sin recargar la
tabla server-side. Creá `components/admin/category-active-toggle.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleCategoryActive } from "@/app/admin/(protected)/categorias/actions";
import { toast } from "sonner";

interface CategoryActiveToggleProps {
  categoryId: string;
  isActive: boolean;
}

export function CategoryActiveToggle({ categoryId, isActive }: CategoryActiveToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={isActive}
      disabled={isPending}
      onCheckedChange={(checked) => {
        startTransition(async () => {
          const result = await toggleCategoryActive(categoryId, checked);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success(checked ? "Categoría activada." : "Categoría desactivada.");
          }
        });
      }}
    />
  );
}
```

Y en `page.tsx`, reemplazá la celda de "Activa" por:

```tsx
<TableCell>
  <CategoryActiveToggle categoryId={category.id} isActive={category.is_active} />
</TableCell>
```

Eliminá el `<form action={...}>` con `"use server"` inline que tenía
antes esa celda — queda reemplazado por este componente.

- [ ] **Step 6: Verificación manual en local**

Con `pnpm dev` corriendo y logueado como admin, navegar a
`/admin/categorias`, crear una categoría, editarla, y desactivarla —
confirmar que el toast y el estado de la tabla se actualizan sin
recargar la página completa.

- [ ] **Step 7: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add "app/admin/(protected)/categorias/page.tsx" components/admin/category-dialog.tsx components/admin/category-dialog.test.tsx components/admin/category-active-toggle.tsx
git commit -m "feat: pantalla de categorías con alta, edición y activación"
```

---

### Task 5: Layout de Admin con Sidebar

**Files:**
- Modify: `app/admin/(protected)/layout.tsx`
- Create: `components/admin/sidebar.tsx`
- Create: `components/admin/sidebar.test.tsx`

**Interfaces:**
- Consumes: `getCurrentAdmin` (ya existe), componente `Sheet` (ya
  existe), `Button`.
- Produces: layout visual que envuelve todas las páginas de
  `/admin/(protected)/*` de aquí en adelante (Tasks 4, 8, 10 ya
  renderizan dentro de este layout sin cambios propios).

- [ ] **Step 1: Escribir el test de `AdminSidebar`**

```tsx
// components/admin/sidebar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminSidebar } from "./sidebar";

describe("AdminSidebar", () => {
  it("muestra el nombre del admin y el link a Productos", () => {
    render(<AdminSidebar adminName="Jessica Besse" />);

    expect(screen.getByText("Jessica Besse")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute(
      "href",
      "/admin/productos",
    );
    expect(screen.getByRole("link", { name: "Categorías" })).toHaveAttribute(
      "href",
      "/admin/categorias",
    );
  });

  it("no muestra ítems de módulos que todavía no existen", () => {
    render(<AdminSidebar adminName="Jessica Besse" />);

    expect(screen.queryByText("Pedidos")).not.toBeInTheDocument();
    expect(screen.queryByText("Clientes")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/admin/sidebar.test.tsx`
Expected: FAIL — el módulo `./sidebar` no existe.

- [ ] **Step 3: Implementar `components/admin/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AdminSidebarProps {
  adminName: string;
}

function NavLinks() {
  return (
    <nav className="flex flex-col gap-1">
      <Link href="/admin/productos" className="rounded px-3 py-2 text-sm hover:bg-accent">
        Productos
      </Link>
      <Link
        href="/admin/categorias"
        className="ml-3 rounded px-3 py-2 text-sm hover:bg-accent"
      >
        Categorías
      </Link>
    </nav>
  );
}

export function AdminSidebar({ adminName }: AdminSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-56 flex-col justify-between border-r p-4 md:flex">
        <div>
          <p className="mb-4 text-lg font-semibold">Librería Blanco</p>
          <NavLinks />
        </div>
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">{adminName}</p>
          <form action="/admin/logout" method="post">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b p-4 md:hidden">
        <p className="text-lg font-semibold">Librería Blanco</p>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menú">
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col justify-between p-4">
            <div>
              <NavLinks />
            </div>
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">{adminName}</p>
              <form action="/admin/logout" method="post">
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/admin/sidebar.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Extender el layout protegido para incluir el sidebar**

Reemplazar el contenido completo de
`app/admin/(protected)/layout.tsx` (el gate de auth existente se
conserva íntegro, solo se agrega el sidebar alrededor de `children`):

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/auth/permissions";
import { AdminSidebar } from "@/components/admin/sidebar";

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

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar adminName={admin.fullName} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Actualizar el test existente del layout si hace falta**

Leer `app/admin/(protected)/layout.test.tsx` (ya existe de Fase 1b).
Si mockea `getCurrentAdmin`/`createClient` y solo verifica
`redirect`/render de `children`, debería seguir pasando sin cambios
porque el gate no cambió. Si el test hace una aserción específica
sobre la estructura del DOM renderizado (por ejemplo, buscar
`children` como único hijo raíz), ajustala para tolerar el wrapper
nuevo (`getByText` en vez de comparar el árbol completo).

- [ ] **Step 7: Correr toda la suite de admin**

Run: `pnpm vitest run app/admin`
Expected: PASS, incluyendo el test de layout ya existente.

- [ ] **Step 8: Verificación manual en local**

Con `pnpm dev`, loguearse y confirmar visualmente el sidebar en
desktop (1440px) y el menú hamburguesa en mobile (360px y 390px, spec
maestra §101).

- [ ] **Step 9: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add "app/admin/(protected)/layout.tsx" components/admin/sidebar.tsx components/admin/sidebar.test.tsx
git commit -m "feat: sidebar de navegación del admin"
```

---

### Task 6: Validación de Producto y cálculo de margen

**Files:**
- Create: `lib/validations/product.ts`
- Create: `lib/validations/product.test.ts`
- Create: `lib/pricing.ts`
- Create: `lib/pricing.test.ts`

**Interfaces:**
- Produces: `productSchema` (Zod), tipo `ProductInput`;
  `calculateMargin(cost: number, price: number): { profit: number; marginPercent: number }`.
  Usadas por Tasks 7, 8.

- [ ] **Step 1: Escribir el test de `calculateMargin`**

```typescript
// lib/pricing.test.ts
import { describe, it, expect } from "vitest";
import { calculateMargin } from "./pricing";

describe("calculateMargin", () => {
  it("calcula ganancia y margen porcentual", () => {
    expect(calculateMargin(1000, 1500)).toEqual({ profit: 500, marginPercent: 33.33 });
  });

  it("devuelve margen 0 cuando el precio es 0", () => {
    expect(calculateMargin(100, 0)).toEqual({ profit: -100, marginPercent: 0 });
  });

  it("calcula ganancia negativa cuando el precio es menor al costo", () => {
    expect(calculateMargin(1000, 800)).toEqual({ profit: -200, marginPercent: -25 });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/pricing.test.ts`
Expected: FAIL — `./pricing` no existe.

- [ ] **Step 3: Implementar `lib/pricing.ts`**

```typescript
export interface MarginResult {
  profit: number;
  marginPercent: number;
}

export function calculateMargin(cost: number, price: number): MarginResult {
  const profit = Math.round((price - cost) * 100) / 100;

  if (price === 0) {
    return { profit, marginPercent: 0 };
  }

  const marginPercent = Math.round((profit / price) * 100 * 100) / 100;
  return { profit, marginPercent };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/pricing.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Escribir el test de `productSchema`**

```typescript
// lib/validations/product.test.ts
import { describe, it, expect } from "vitest";
import { productSchema } from "./product";

const validInput = {
  name: "Cuaderno Rivadavia A4",
  categoryId: "11111111-1111-1111-1111-111111111111",
  shortDescription: "",
  cost: "1000",
  price: "1500",
  available: true,
  isPublished: true,
  isFeatured: false,
  isNew: false,
  sku: "",
  isbn: "",
  barcode: "",
  brand: "",
  author: "",
  publisher: "",
  tags: "",
};

describe("productSchema", () => {
  it("acepta un producto mínimo válido", () => {
    const result = productSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rechaza si falta el nombre", () => {
    const result = productSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza si falta la categoría", () => {
    const result = productSchema.safeParse({ ...validInput, categoryId: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza costo negativo", () => {
    const result = productSchema.safeParse({ ...validInput, cost: "-10" });
    expect(result.success).toBe(false);
  });

  it("convierte cost y price de string a number", () => {
    const result = productSchema.parse(validInput);
    expect(result.cost).toBe(1000);
    expect(result.price).toBe(1500);
  });

  it("convierte tags separados por coma en un array recortado", () => {
    const result = productSchema.parse({ ...validInput, tags: "escolar, oficina ,  cuadernos" });
    expect(result.tags).toEqual(["escolar", "oficina", "cuadernos"]);
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `pnpm vitest run lib/validations/product.test.ts`
Expected: FAIL — `./product` no existe.

- [ ] **Step 7: Implementar `lib/validations/product.ts`**

```typescript
import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : null));

export const productSchema = z.object({
  name: z.string().min(1, "Ingresá un nombre."),
  categoryId: z.string().min(1, "Elegí una categoría."),
  shortDescription: optionalText,
  cost: z.coerce.number().nonnegative("El costo no puede ser negativo."),
  price: z.coerce.number().nonnegative("El precio no puede ser negativo."),
  available: z.boolean(),
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  sku: optionalText,
  isbn: optionalText,
  barcode: optionalText,
  brand: optionalText,
  author: optionalText,
  publisher: optionalText,
  tags: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
});

export type ProductInput = z.infer<typeof productSchema>;
```

`products.sale_price` no forma parte de este schema ni del formulario
de esta fase (el diseño §4.3 no incluye un campo de precio
promocional) — la columna queda en su default `null` a nivel de base,
sin que ningún código de esta fase la toque.

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `pnpm vitest run lib/validations/product.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 9: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add lib/validations/product.ts lib/validations/product.test.ts lib/pricing.ts lib/pricing.test.ts
git commit -m "feat: validación de producto y cálculo de margen/ganancia"
```

---

### Task 7: Server Actions de Producto

**Files:**
- Create: `app/admin/(protected)/productos/actions.ts`
- Create: `app/admin/(protected)/productos/actions.test.ts`

**Interfaces:**
- Consumes: `productSchema` (Task 6), `withPermission` (Task 1).
- Produces: `createProduct`, `updateProduct`,
  `toggleProductAvailability`, `toggleProductPublished`,
  `toggleProductFeatured`, tipo `ProductActionState`. Usadas por
  Tasks 8, 10.

- [ ] **Step 1: Escribir los tests de las Server Actions de producto**

```typescript
// app/admin/(protected)/productos/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

function mockAdminAllowed() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["SUPER_ADMIN"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: true, error: null });
  });
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const validFields = {
  name: "Cuaderno Rivadavia A4",
  categoryId: "11111111-1111-1111-1111-111111111111",
  cost: "1000",
  price: "1500",
};

import {
  createProduct,
  toggleProductAvailability,
  toggleProductPublished,
  toggleProductFeatured,
} from "./actions";

describe("createProduct", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de validación si falta la categoría", async () => {
    mockAdminAllowed();

    const result = await createProduct(
      { error: null, productId: null },
      formData({ ...validFields, categoryId: "" }),
    );

    expect(result.error).toBe("Revisá los datos ingresados.");
    expect(result.productId).toBeNull();
  });

  it("inserta el producto con los campos mapeados a snake_case", async () => {
    mockAdminAllowed();

    const single = vi.fn().mockResolvedValue({ data: { id: "prod-1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const result = await createProduct({ error: null, productId: null }, formData(validFields));

    expect(result.error).toBeNull();
    expect(result.productId).toBe("prod-1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cuaderno Rivadavia A4",
        category_id: "11111111-1111-1111-1111-111111111111",
        cost: 1000,
        price: 1500,
      }),
    );
  });
});

describe("toggles de producto", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("toggleProductAvailability actualiza available", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await toggleProductAvailability("prod-1", false);

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ available: false });
  });

  it("toggleProductPublished actualiza is_published", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await toggleProductPublished("prod-1", true);

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ is_published: true });
  });

  it("toggleProductFeatured actualiza is_featured", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await toggleProductFeatured("prod-1", true);

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ is_featured: true });
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm vitest run "app/admin/(protected)/productos/actions.test.ts"`
Expected: FAIL — `./actions` no existe.

- [ ] **Step 3: Implementar `app/admin/(protected)/productos/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermission } from "@/lib/auth/permissions";
import { productSchema } from "@/lib/validations/product";

export interface ProductActionState {
  error: string | null;
  productId: string | null;
}

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    shortDescription: formData.get("shortDescription"),
    cost: formData.get("cost"),
    price: formData.get("price"),
    available: formData.get("available") === "on",
    isPublished: formData.get("isPublished") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    isNew: formData.get("isNew") === "on",
    sku: formData.get("sku"),
    isbn: formData.get("isbn"),
    barcode: formData.get("barcode"),
    brand: formData.get("brand"),
    author: formData.get("author"),
    publisher: formData.get("publisher"),
    tags: formData.get("tags"),
  });
}

function toRow(input: ReturnType<typeof productSchema.parse>) {
  return {
    name: input.name,
    category_id: input.categoryId,
    short_description: input.shortDescription,
    cost: input.cost,
    price: input.price,
    available: input.available,
    is_published: input.isPublished,
    is_featured: input.isFeatured,
    is_new: input.isNew,
    sku: input.sku,
    isbn: input.isbn,
    barcode: input.barcode,
    brand: input.brand,
    author: input.author,
    publisher: input.publisher,
    tags: input.tags,
  };
}

export async function createProduct(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  return withPermission("productos", "crear", async (admin) => {
    const parsed = parseProductForm(formData);
    if (!parsed.success) {
      return { error: "Revisá los datos ingresados.", productId: null };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .insert({ ...toRow(parsed.data), updated_by: admin.id })
      .select("id")
      .single();

    if (error || !data) {
      console.error("createProduct: error inserting product", error);
      return { error: "No pudimos guardar el producto.", productId: null };
    }

    revalidatePath("/admin/productos");
    return { error: null, productId: data.id };
  });
}

export async function updateProduct(
  id: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  return withPermission("productos", "editar", async (admin) => {
    const parsed = parseProductForm(formData);
    if (!parsed.success) {
      return { error: "Revisá los datos ingresados.", productId: id };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ ...toRow(parsed.data), updated_by: admin.id })
      .eq("id", id);

    if (error) {
      console.error("updateProduct: error updating product", error);
      return { error: "No pudimos guardar el producto.", productId: id };
    }

    revalidatePath("/admin/productos");
    revalidatePath(`/admin/productos/${id}`);
    return { error: null, productId: id };
  });
}

interface ToggleResult {
  error: string | null;
}

export async function toggleProductAvailability(
  id: string,
  nextAvailable: boolean,
): Promise<ToggleResult> {
  return withPermission("productos", "editar", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ available: nextAvailable })
      .eq("id", id);

    if (error) {
      console.error("toggleProductAvailability: error updating product", error);
      return { error: "No pudimos actualizar la disponibilidad." };
    }

    revalidatePath("/admin/productos");
    return { error: null };
  });
}

export async function toggleProductPublished(
  id: string,
  nextPublished: boolean,
): Promise<ToggleResult> {
  return withPermission("productos", "editar", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_published: nextPublished })
      .eq("id", id);

    if (error) {
      console.error("toggleProductPublished: error updating product", error);
      return { error: "No pudimos actualizar la publicación." };
    }

    revalidatePath("/admin/productos");
    return { error: null };
  });
}

export async function toggleProductFeatured(
  id: string,
  nextFeatured: boolean,
): Promise<ToggleResult> {
  return withPermission("productos", "editar", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_featured: nextFeatured })
      .eq("id", id);

    if (error) {
      console.error("toggleProductFeatured: error updating product", error);
      return { error: "No pudimos actualizar el destacado." };
    }

    revalidatePath("/admin/productos");
    return { error: null };
  });
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm vitest run "app/admin/(protected)/productos/actions.test.ts"`
Expected: PASS (todos los casos)

- [ ] **Step 5: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(protected)/productos/actions.ts" "app/admin/(protected)/productos/actions.test.ts"
git commit -m "feat: Server Actions de producto (alta, edición y toggles)"
```

---

### Task 8: Formulario de Producto + páginas de alta/edición

**Files:**
- Create: `components/admin/product-form.tsx`
- Create: `components/admin/product-form.test.tsx`
- Create: `components/admin/price-warning-dialog.tsx`
- Create: `app/admin/(protected)/productos/nuevo/page.tsx`
- Create: `app/admin/(protected)/productos/[id]/page.tsx`

**Interfaces:**
- Consumes: `createProduct`, `updateProduct` (Task 7),
  `calculateMargin` (Task 6), `productSchema` (Task 6), componentes
  `Accordion`, `Textarea`, `Label`, `Switch`, `Select` (Task 1 +
  existentes).
- Produces: `ProductForm` (Client Component), usado por las dos
  páginas de esta tarea. `product-image-manager` de Task 9 se integra
  dentro de `[id]/page.tsx`, no dentro de `ProductForm`.

- [ ] **Step 1: Escribir el test de `ProductForm`**

```tsx
// components/admin/product-form.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductForm } from "./product-form";

const categories = [{ id: "cat-1", name: "Papelería" }];

describe("ProductForm", () => {
  it("muestra el CTA 'Guardar producto' y los campos principales", () => {
    render(<ProductForm mode="create" categories={categories} />);

    expect(screen.getByLabelText("Nombre del producto")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoría")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar producto" })).toBeInTheDocument();
  });

  it("calcula ganancia y margen en vivo al tipear costo y precio", async () => {
    const user = userEvent.setup();
    render(<ProductForm mode="create" categories={categories} />);

    await user.type(screen.getByLabelText("¿Cuánto te cuesta?"), "1000");
    await user.type(screen.getByLabelText("¿A cuánto lo vendés?"), "1500");

    expect(screen.getByText("$500")).toBeInTheDocument();
    expect(screen.getByText("33.33%")).toBeInTheDocument();
  });

  it("pre-popula los valores cuando mode es edit", () => {
    render(
      <ProductForm
        mode="edit"
        categories={categories}
        initialValues={{
          id: "prod-1",
          name: "Cuaderno Rivadavia A4",
          categoryId: "cat-1",
          cost: 1000,
          price: 1500,
        }}
      />,
    );

    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Cuaderno Rivadavia A4");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/admin/product-form.test.tsx`
Expected: FAIL — el módulo `./product-form` no existe.

- [ ] **Step 3: Implementar `components/admin/price-warning-dialog.tsx`**

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PriceWarningDialogProps {
  open: boolean;
  lossPerUnit: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PriceWarningDialog({
  open,
  lossPerUnit,
  onConfirm,
  onCancel,
}: PriceWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>El precio de venta es menor al costo</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a perder ${Math.abs(lossPerUnit).toFixed(0)} por unidad. ¿Querés guardar igualmente?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Revisar precio</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Guardar igual</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Implementar `components/admin/product-form.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { calculateMargin } from "@/lib/pricing";
import { PriceWarningDialog } from "./price-warning-dialog";
import {
  createProduct,
  updateProduct,
  type ProductActionState,
} from "@/app/admin/(protected)/productos/actions";

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductFormValues {
  id?: string;
  name?: string;
  categoryId?: string;
  shortDescription?: string;
  cost?: number;
  price?: number;
  available?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  sku?: string;
  isbn?: string;
  barcode?: string;
  brand?: string;
  author?: string;
  publisher?: string;
  tags?: string[];
}

interface ProductFormProps {
  mode: "create" | "edit";
  categories: CategoryOption[];
  initialValues?: ProductFormValues;
}

const initialState: ProductActionState = { error: null, productId: null };

export function ProductForm({ mode, categories, initialValues }: ProductFormProps) {
  const router = useRouter();
  const [cost, setCost] = useState(String(initialValues?.cost ?? ""));
  const [price, setPrice] = useState(String(initialValues?.price ?? ""));
  const [pendingSubmit, setPendingSubmit] = useState<FormData | null>(null);
  const submittedRef = useRef(false);

  const action = mode === "edit" ? updateProduct.bind(null, initialValues!.id!) : createProduct;
  const [state, formAction, pending] = useActionState(action, initialState);

  const margin = useMemo(() => {
    const costNumber = Number(cost) || 0;
    const priceNumber = Number(price) || 0;
    return calculateMargin(costNumber, priceNumber);
  }, [cost, price]);

  const showsPriceWarning = pendingSubmit !== null;

  useEffect(() => {
    if (!submittedRef.current || pending || state.error !== null || !state.productId) {
      return;
    }
    submittedRef.current = false;
    if (mode === "create") {
      router.push(`/admin/productos/${state.productId}?created=1`);
    } else {
      toast.success("Producto guardado.");
    }
  }, [state, pending, mode, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    submittedRef.current = true;
    if (margin.profit < 0 && pendingSubmit === null) {
      event.preventDefault();
      submittedRef.current = false;
      setPendingSubmit(new FormData(event.currentTarget));
    }
  }

  async function confirmSubmit() {
    if (!pendingSubmit) return;
    submittedRef.current = true;
    await formAction(pendingSubmit);
    setPendingSubmit(null);
  }

  return (
    <>
      <form action={formAction} onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre del producto</Label>
            <Input id="name" name="name" defaultValue={initialValues?.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoryId">Categoría</Label>
            <Select name="categoryId" defaultValue={initialValues?.categoryId}>
              <SelectTrigger id="categoryId">
                <SelectValue placeholder="Elegí una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shortDescription">Descripción</Label>
            <Textarea
              id="shortDescription"
              name="shortDescription"
              defaultValue={initialValues?.shortDescription}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cost">¿Cuánto te cuesta?</Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">¿A cuánto lo vendés?</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Ganás por unidad: <span className="font-medium text-foreground">${margin.profit}</span>
            {" — "}Eso representa:{" "}
            <span className="font-medium text-foreground">{margin.marginPercent}%</span> del precio
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="available">Disponible en la tienda</Label>
            <Switch id="available" name="available" defaultChecked={initialValues?.available ?? true} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isPublished">Mostrar en la tienda</Label>
            <Switch
              id="isPublished"
              name="isPublished"
              defaultChecked={initialValues?.isPublished ?? false}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isFeatured">Destacar en la página principal</Label>
            <Switch
              id="isFeatured"
              name="isFeatured"
              defaultChecked={initialValues?.isFeatured ?? false}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isNew">Mostrar como novedad</Label>
            <Switch id="isNew" name="isNew" defaultChecked={initialValues?.isNew ?? false} />
          </div>
        </section>

        <Accordion type="single" collapsible>
          <AccordionItem value="mas-datos">
            <AccordionTrigger>Más datos</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" defaultValue={initialValues?.sku} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="isbn">ISBN</Label>
                <Input id="isbn" name="isbn" defaultValue={initialValues?.isbn} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input id="barcode" name="barcode" defaultValue={initialValues?.barcode} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" name="brand" defaultValue={initialValues?.brand} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="author">Autor</Label>
                <Input id="author" name="author" defaultValue={initialValues?.author} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="publisher">Editorial</Label>
                <Input id="publisher" name="publisher" defaultValue={initialValues?.publisher} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tags">Tags (separados por coma)</Label>
                <Input id="tags" name="tags" defaultValue={initialValues?.tags?.join(", ")} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar producto"}
        </Button>
      </form>

      <PriceWarningDialog
        open={showsPriceWarning}
        lossPerUnit={margin.profit}
        onConfirm={confirmSubmit}
        onCancel={() => setPendingSubmit(null)}
      />
    </>
  );
}
```

**Nota para quien implemente:** `new FormData(event.currentTarget)`
dentro de `handleSubmit` captura los valores del formulario en el
momento del submit — funciona para este caso porque el `<Select>` de
Radix sincroniza un input oculto antes de que el evento de submit se
dispare. Verificalo manualmente en el Step 8 de esta tarea (el
`Select` de categoría debe viajar correctamente en el segundo submit,
tras confirmar el diálogo de advertencia de precio).

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/admin/product-form.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Implementar la página de alta**

```tsx
// app/admin/(protected)/productos/nuevo/page.tsx
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Agregar producto</h1>
      <ProductForm mode="create" categories={categories ?? []} />
    </main>
  );
}
```

- [ ] **Step 7: Implementar la página de edición (sin imágenes todavía — Task 9 la completa)**

```tsx
// app/admin/(protected)/productos/[id]/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Editar producto</h1>
      <ProductForm
        mode="edit"
        categories={categories ?? []}
        initialValues={{
          id: product.id,
          name: product.name,
          categoryId: product.category_id,
          shortDescription: product.short_description ?? undefined,
          cost: product.cost,
          price: product.price,
          available: product.available,
          isPublished: product.is_published,
          isFeatured: product.is_featured,
          isNew: product.is_new,
          sku: product.sku ?? undefined,
          isbn: product.isbn ?? undefined,
          barcode: product.barcode ?? undefined,
          brand: product.brand ?? undefined,
          author: product.author ?? undefined,
          publisher: product.publisher ?? undefined,
          tags: product.tags ?? undefined,
        }}
      />
    </main>
  );
}
```

- [ ] **Step 8: Verificación manual en local**

Con `pnpm dev`: crear un producto completo, confirmar que redirige a
`/admin/productos/[id]?created=1`; poner un precio menor al costo y
confirmar que aparece el `AlertDialog` con el texto exacto de spec
maestra §100 y que "Guardar igual" efectivamente guarda; editar un
producto existente y confirmar que todos los campos (incluidos los de
"Más datos") se pre-populan correctamente.

- [ ] **Step 9: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add components/admin/product-form.tsx components/admin/product-form.test.tsx components/admin/price-warning-dialog.tsx "app/admin/(protected)/productos/nuevo/page.tsx" "app/admin/(protected)/productos/[id]/page.tsx"
git commit -m "feat: formulario de producto con cálculo de margen y advertencia de precio"
```

---

### Task 9: Gestión de imágenes de producto

**Files:**
- Create: `app/admin/(protected)/productos/[id]/image-actions.ts`
- Create: `app/admin/(protected)/productos/[id]/image-actions.test.ts`
- Create: `components/admin/product-image-manager.tsx`
- Create: `components/admin/product-image-manager.test.tsx`
- Modify: `app/admin/(protected)/productos/[id]/page.tsx` (integra el manager)

**Interfaces:**
- Consumes: bucket `product-images` (Task 2), `withPermission` (Task 1).
- Produces: `uploadProductImage`, `deleteProductImage`,
  `setPrimaryProductImage`, `reorderProductImage`. Consumidas
  únicamente por `ProductImageManager` en esta misma tarea.

- [ ] **Step 1: Escribir los tests de las Server Actions de imágenes**

```typescript
// app/admin/(protected)/productos/[id]/image-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  })),
}));

function mockAdminAllowed() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["SUPER_ADMIN"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: true, error: null });
  });
}

import { uploadProductImage, deleteProductImage } from "./image-actions";

describe("uploadProductImage", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockStorageUpload.mockReset();
    mockGetPublicUrl.mockReset();
  });

  it("rechaza cuando ya existen 4 imágenes", async () => {
    mockAdminAllowed();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
      }),
    });

    const formData = new FormData();
    formData.set("file", new File(["x"], "foto.jpg", { type: "image/jpeg" }));

    const result = await uploadProductImage("prod-1", { error: null }, formData);

    expect(result.error).toBe("Ya tenés el máximo de 4 imágenes para este producto.");
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("sube el archivo e inserta la fila cuando hay lugar", async () => {
    mockAdminAllowed();
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
      insert,
    });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/foto.jpg" } });

    const formData = new FormData();
    formData.set("file", new File(["x"], "foto.jpg", { type: "image/jpeg" }));

    const result = await uploadProductImage("prod-1", { error: null }, formData);

    expect(result.error).toBeNull();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: "prod-1",
        url: "https://example.com/foto.jpg",
        is_primary: true,
      }),
    );
  });
});

describe("deleteProductImage", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockStorageRemove.mockReset();
  });

  it("elimina la fila de la base", async () => {
    mockAdminAllowed();
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { url: "https://example.com/storage/v1/object/public/product-images/prod-1/a.jpg" },
            error: null,
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({ eq: deleteEq }),
    });

    const result = await deleteProductImage("img-1", "prod-1");

    expect(result.error).toBeNull();
    expect(deleteEq).toHaveBeenCalledWith("id", "img-1");
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm vitest run "app/admin/(protected)/productos/[id]/image-actions.test.ts"`
Expected: FAIL — `./image-actions` no existe.

- [ ] **Step 3: Implementar `app/admin/(protected)/productos/[id]/image-actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermission } from "@/lib/auth/permissions";

const MAX_IMAGES_PER_PRODUCT = 4;
const BUCKET = "product-images";

export interface ImageActionState {
  error: string | null;
}

export async function uploadProductImage(
  productId: string,
  _prevState: ImageActionState,
  formData: FormData,
): Promise<ImageActionState> {
  return withPermission("productos", "editar", async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Elegí una imagen para subir." };
    }

    const supabase = await createClient();

    const { count, error: countError } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    if (countError) {
      console.error("uploadProductImage: error counting images", countError);
      return { error: "No pudimos subir la imagen." };
    }

    const currentCount = count ?? 0;
    if (currentCount >= MAX_IMAGES_PER_PRODUCT) {
      return { error: `Ya tenés el máximo de ${MAX_IMAGES_PER_PRODUCT} imágenes para este producto.` };
    }

    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);

    if (uploadError) {
      console.error("uploadProductImage: error uploading file", uploadError);
      return { error: "No pudimos subir la imagen." };
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: insertError } = await supabase.from("product_images").insert({
      product_id: productId,
      url: publicUrlData.publicUrl,
      position: currentCount,
      is_primary: currentCount === 0,
    });

    if (insertError) {
      console.error("uploadProductImage: error inserting row", insertError);
      return { error: "No pudimos guardar la imagen." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}

export async function deleteProductImage(
  imageId: string,
  productId: string,
): Promise<ImageActionState> {
  return withPermission("productos", "editar", async () => {
    const supabase = await createClient();

    const { data: image, error: fetchError } = await supabase
      .from("product_images")
      .select("url")
      .eq("id", imageId)
      .single();

    if (fetchError || !image) {
      console.error("deleteProductImage: error fetching image", fetchError);
      return { error: "No pudimos eliminar la imagen." };
    }

    const marker = `/${BUCKET}/`;
    const markerIndex = image.url.indexOf(marker);
    const storagePath = markerIndex >= 0 ? image.url.slice(markerIndex + marker.length) : null;

    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }

    const { error: deleteError } = await supabase.from("product_images").delete().eq("id", imageId);

    if (deleteError) {
      console.error("deleteProductImage: error deleting row", deleteError);
      return { error: "No pudimos eliminar la imagen." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}

export async function setPrimaryProductImage(
  productId: string,
  imageId: string,
): Promise<ImageActionState> {
  return withPermission("productos", "editar", async () => {
    const supabase = await createClient();

    const { error: clearError } = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);

    if (clearError) {
      console.error("setPrimaryProductImage: error clearing primary", clearError);
      return { error: "No pudimos actualizar la imagen principal." };
    }

    const { error: setError } = await supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", imageId);

    if (setError) {
      console.error("setPrimaryProductImage: error setting primary", setError);
      return { error: "No pudimos actualizar la imagen principal." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}

export async function reorderProductImage(
  productId: string,
  imageId: string,
  direction: "up" | "down",
): Promise<ImageActionState> {
  return withPermission("productos", "editar", async () => {
    const supabase = await createClient();

    const { data: images, error } = await supabase
      .from("product_images")
      .select("id, position")
      .eq("product_id", productId)
      .order("position", { ascending: true });

    if (error || !images) {
      console.error("reorderProductImage: error fetching images", error);
      return { error: "No pudimos reordenar las imágenes." };
    }

    const index = images.findIndex((img) => img.id === imageId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    if (index === -1 || swapIndex < 0 || swapIndex >= images.length) {
      return { error: null };
    }

    const current = images[index];
    const swap = images[swapIndex];

    const { error: firstError } = await supabase
      .from("product_images")
      .update({ position: swap.position })
      .eq("id", current.id);
    const { error: secondError } = await supabase
      .from("product_images")
      .update({ position: current.position })
      .eq("id", swap.id);

    if (firstError || secondError) {
      console.error("reorderProductImage: error swapping positions", firstError ?? secondError);
      return { error: "No pudimos reordenar las imágenes." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm vitest run "app/admin/(protected)/productos/[id]/image-actions.test.ts"`
Expected: PASS (todos los casos)

- [ ] **Step 5: Escribir el test de `ProductImageManager`**

```tsx
// components/admin/product-image-manager.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductImageManager } from "./product-image-manager";

describe("ProductImageManager", () => {
  it("muestra las imágenes existentes con la principal marcada", () => {
    render(
      <ProductImageManager
        productId="prod-1"
        images={[
          { id: "img-1", url: "https://example.com/a.jpg", position: 0, isPrimary: true },
          { id: "img-2", url: "https://example.com/b.jpg", position: 1, isPrimary: false },
        ]}
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("Principal")).toBeInTheDocument();
  });

  it("muestra el input de carga solo si hay menos de 4 imágenes", () => {
    const fourImages = Array.from({ length: 4 }, (_, i) => ({
      id: `img-${i}`,
      url: `https://example.com/${i}.jpg`,
      position: i,
      isPrimary: i === 0,
    }));

    render(<ProductImageManager productId="prod-1" images={fourImages} />);

    expect(screen.queryByLabelText("Subir imagen")).not.toBeInTheDocument();
    expect(screen.getByText("Llegaste al máximo de 4 imágenes.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `pnpm vitest run components/admin/product-image-manager.test.tsx`
Expected: FAIL — el módulo `./product-image-manager` no existe.

- [ ] **Step 7: Implementar `components/admin/product-image-manager.tsx`**

```tsx
"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  reorderProductImage,
} from "@/app/admin/(protected)/productos/[id]/image-actions";

export interface ProductImage {
  id: string;
  url: string;
  position: number;
  isPrimary: boolean;
}

interface ProductImageManagerProps {
  productId: string;
  images: ProductImage[];
}

const MAX_IMAGES = 4;

export function ProductImageManager({ productId, images }: ProductImageManagerProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const sorted = [...images].sort((a, b) => a.position - b.position);

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadProductImage(productId, { error: null }, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Imagen subida.");
        formRef.current?.reset();
      }
    });
  }

  function handleDelete(imageId: string) {
    startTransition(async () => {
      const result = await deleteProductImage(imageId, productId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Imagen eliminada.");
      }
    });
  }

  function handleSetPrimary(imageId: string) {
    startTransition(async () => {
      const result = await setPrimaryProductImage(productId, imageId);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function handleReorder(imageId: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await reorderProductImage(productId, imageId, direction);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Fotos</h2>
      <div className="flex flex-wrap gap-4">
        {sorted.map((image, index) => (
          <div key={image.id} className="flex w-32 flex-col gap-1">
            <Image
              src={image.url}
              alt=""
              width={128}
              height={128}
              className="aspect-square rounded object-cover"
            />
            {image.isPrimary && <span className="text-xs font-medium">Principal</span>}
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || index === 0}
                onClick={() => handleReorder(image.id, "up")}
              >
                ▲
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || index === sorted.length - 1}
                onClick={() => handleReorder(image.id, "down")}
              >
                ▼
              </Button>
            </div>
            {!image.isPrimary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleSetPrimary(image.id)}
              >
                Marcar principal
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => handleDelete(image.id)}
            >
              Eliminar
            </Button>
          </div>
        ))}
      </div>

      {sorted.length < MAX_IMAGES ? (
        <form ref={formRef} action={handleUpload} className="flex flex-col gap-2">
          <Label htmlFor="file">Subir imagen</Label>
          <input id="file" name="file" type="file" accept="image/*" required />
          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? "Subiendo..." : "Subir"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Llegaste al máximo de {MAX_IMAGES} imágenes.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/admin/product-image-manager.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Configurar `next.config` para el dominio de imágenes de Supabase Storage**

Leer `next.config.ts` (o `.mjs`, según exista). Agregar el hostname del
proyecto de Supabase a `images.remotePatterns` para que
`next/image` pueda optimizar imágenes servidas desde Storage:

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};
```

Si el archivo ya tiene otra configuración, agregar `images` sin
eliminar las claves existentes.

- [ ] **Step 10: Integrar `ProductImageManager` en la página de edición**

Modificar `app/admin/(protected)/productos/[id]/page.tsx` (creada en
Task 8) agregando, después de `<ProductForm ... />`, la carga de
imágenes y el componente:

```tsx
// agregar al import existente:
import { ProductImageManager } from "@/components/admin/product-image-manager";

// dentro de EditProductPage, junto a la query de categorías:
const { data: images } = await supabase
  .from("product_images")
  .select("id, url, position, is_primary")
  .eq("product_id", id)
  .order("position", { ascending: true });

// en el JSX, después de <ProductForm ... />:
<ProductImageManager
  productId={product.id}
  images={(images ?? []).map((img) => ({
    id: img.id,
    url: img.url,
    position: img.position,
    isPrimary: img.is_primary,
  }))}
/>
```

- [ ] **Step 11: Verificación manual en local**

Con `pnpm dev`: en un producto ya creado, subir una imagen, confirmar
que aparece marcada "Principal"; subir una segunda y marcarla como
principal; reordenar con las flechas; subir hasta 4 y confirmar que el
formulario de carga desaparece y aparece el mensaje de máximo
alcanzado; eliminar una imagen y confirmar que desaparece de la lista.

- [ ] **Step 12: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 13: Commit**

```bash
git add "app/admin/(protected)/productos/[id]/image-actions.ts" "app/admin/(protected)/productos/[id]/image-actions.test.ts" components/admin/product-image-manager.tsx components/admin/product-image-manager.test.tsx "app/admin/(protected)/productos/[id]/page.tsx" next.config.ts
git commit -m "feat: carga, reordenamiento y borrado de imágenes de producto"
```

---

### Task 10: Lista de Productos (filtros, búsqueda, acciones rápidas)

**Files:**
- Create: `app/admin/(protected)/productos/page.tsx`
- Create: `components/admin/product-quick-actions.tsx`
- Create: `components/admin/product-quick-actions.test.tsx`

**Interfaces:**
- Consumes: `toggleProductAvailability`, `toggleProductPublished`,
  `toggleProductFeatured` (Task 7).
- Produces: página `/admin/productos`, componente
  `ProductQuickActions`.

- [ ] **Step 1: Escribir el test de `ProductQuickActions`**

```tsx
// components/admin/product-quick-actions.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToggleAvailability = vi.fn().mockResolvedValue({ error: null });
const mockTogglePublished = vi.fn().mockResolvedValue({ error: null });
const mockToggleFeatured = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/app/admin/(protected)/productos/actions", () => ({
  toggleProductAvailability: (...args: unknown[]) => mockToggleAvailability(...args),
  toggleProductPublished: (...args: unknown[]) => mockTogglePublished(...args),
  toggleProductFeatured: (...args: unknown[]) => mockToggleFeatured(...args),
}));

import { ProductQuickActions } from "./product-quick-actions";

describe("ProductQuickActions", () => {
  it("llama a toggleProductAvailability al tocar el switch de disponible", async () => {
    const user = userEvent.setup();
    render(
      <ProductQuickActions
        productId="prod-1"
        available={true}
        isPublished={false}
        isFeatured={false}
      />,
    );

    await user.click(screen.getByLabelText("Disponible"));

    expect(mockToggleAvailability).toHaveBeenCalledWith("prod-1", false);
  });

  it("llama a toggleProductFeatured al tocar 'Destacar'", async () => {
    const user = userEvent.setup();
    render(
      <ProductQuickActions
        productId="prod-1"
        available={true}
        isPublished={true}
        isFeatured={false}
      />,
    );

    await user.click(screen.getByText("Destacar"));

    expect(mockToggleFeatured).toHaveBeenCalledWith("prod-1", true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run components/admin/product-quick-actions.test.tsx`
Expected: FAIL — el módulo `./product-quick-actions` no existe.

- [ ] **Step 3: Implementar `components/admin/product-quick-actions.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  toggleProductAvailability,
  toggleProductPublished,
  toggleProductFeatured,
} from "@/app/admin/(protected)/productos/actions";

interface ProductQuickActionsProps {
  productId: string;
  available: boolean;
  isPublished: boolean;
  isFeatured: boolean;
}

export function ProductQuickActions({
  productId,
  available,
  isPublished,
  isFeatured,
}: ProductQuickActionsProps) {
  const [isPending, startTransition] = useTransition();

  function run(promise: Promise<{ error: string | null }>, successMessage: string) {
    startTransition(async () => {
      const result = await promise;
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          aria-label="Disponible"
          checked={available}
          disabled={isPending}
          onCheckedChange={(checked) =>
            run(toggleProductAvailability(productId, checked), "Disponibilidad actualizada.")
          }
        />
        Disponible
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          run(
            toggleProductPublished(productId, !isPublished),
            isPublished ? "Producto despublicado." : "Producto publicado.",
          )
        }
      >
        {isPublished ? "Despublicar" : "Publicar"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          run(
            toggleProductFeatured(productId, !isFeatured),
            isFeatured ? "Producto ya no está destacado." : "Producto destacado.",
          )
        }
      >
        {isFeatured ? "Quitar destacado" : "Destacar"}
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/productos/${productId}`}>Editar</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run components/admin/product-quick-actions.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Implementar la página `/admin/productos`**

```tsx
// app/admin/(protected)/productos/page.tsx
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductQuickActions } from "@/components/admin/product-quick-actions";

type FilterKey = "todos" | "publicados" | "no-disponibles" | "destacados";

interface ProductsPageProps {
  searchParams: Promise<{ filtro?: string; q?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { filtro, q } = await searchParams;
  const filter = (filtro as FilterKey) ?? "todos";

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, price, available, is_published, is_featured, product_images(url, is_primary)")
    .order("created_at", { ascending: false });

  if (filter === "publicados") {
    query = query.eq("is_published", true);
  } else if (filter === "no-disponibles") {
    query = query.eq("available", false);
  } else if (filter === "destacados") {
    query = query.eq("is_featured", true);
  }

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error("ProductsPage: error fetching products", error);
  }

  const rows = products ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Productos</h1>
        <Button asChild>
          <Link href="/admin/productos/nuevo">+ Agregar producto</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/admin/productos">
        <input type="hidden" name="filtro" value={filter} />
        <Input name="q" placeholder="Buscar producto..." defaultValue={q} />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <Tabs value={filter}>
        <TabsList>
          <TabsTrigger value="todos" asChild>
            <Link href="/admin/productos?filtro=todos">Todos</Link>
          </TabsTrigger>
          <TabsTrigger value="publicados" asChild>
            <Link href="/admin/productos?filtro=publicados">Publicados</Link>
          </TabsTrigger>
          <TabsTrigger value="no-disponibles" asChild>
            <Link href="/admin/productos?filtro=no-disponibles">No disponibles</Link>
          </TabsTrigger>
          <TabsTrigger value="destacados" asChild>
            <Link href="/admin/productos?filtro=destacados">Destacados</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no cargaste productos. Agregá el primero para empezar a armar tu tienda.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foto</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((product) => {
              const primaryImage = product.product_images?.find((img) => img.is_primary)?.url;
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    {primaryImage ? (
                      <Image
                        src={primaryImage}
                        alt=""
                        width={48}
                        height={48}
                        className="aspect-square rounded object-cover"
                      />
                    ) : (
                      <div className="size-12 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>${product.price}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_published ? "default" : "secondary"}>
                      {product.is_published ? "Publicado" : "Borrador"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ProductQuickActions
                      productId={product.id}
                      available={product.available}
                      isPublished={product.is_published}
                      isFeatured={product.is_featured}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Verificación manual en local**

Con `pnpm dev`: cargar varios productos, filtrar por cada tab,
buscar por nombre, cambiar disponible/publicado/destacado desde la
lista sin abrir el producto, confirmar responsive en 360px (tabla
debería scrollear horizontalmente o mostrarse legible — si no se ve
bien en mobile, envolver la `Table` en un contenedor con
`overflow-x-auto`, ya que la spec no pide un rediseño completo a
cards para esta fase si el scroll horizontal es legible).

- [ ] **Step 7: Verificar tipos, lint y tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add "app/admin/(protected)/productos/page.tsx" components/admin/product-quick-actions.tsx components/admin/product-quick-actions.test.tsx
git commit -m "feat: lista de productos con filtros, búsqueda y acciones rápidas"
```

---

### Task 11: Sync a producción y verificación manual end-to-end

**Files:** ninguno nuevo — tarea de despliegue y verificación.

- [ ] **Step 1: Correr la suite completa localmente**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm exec next build`
Expected: todo verde, build sin errores.

- [ ] **Step 2: Push de la migración de Storage al proyecto real**

Run: `supabase db push`
Expected: aplica la migración de Task 2 (bucket + políticas) contra el
proyecto de producción. Confirmar en el dashboard de Supabase
(Storage) que el bucket `product-images` existe y está marcado
público.

- [ ] **Step 3: Regenerar tipos contra producción y confirmar que no hay diffs inesperados**

Run: `supabase gen types typescript --project-id <project-id> > types/supabase.ts`

Expected: sin cambios respecto al archivo actual (Storage no forma
parte del tipo generado); si hay cambios, revisar que sean solo de
formato antes de commitear.

- [ ] **Step 4: Deploy a Vercel**

Verificar que el push a `nueva-ui`/`main` dispara el deploy (mismo
flujo que Fase 1b). Confirmar con las herramientas de Vercel
(`list_deployments`/`get_deployment`) que el deployment queda en
estado `READY`.

- [ ] **Step 5: Verificación manual end-to-end en producción**

Con Playwright contra `https://libreriablanco.vercel.app`, logueado
como Jessica Besse:

1. Crear una categoría real.
2. Crear un producto real completo, con al menos una imagen.
3. Confirmar que la imagen se ve (URL pública de Storage carga
   correctamente).
4. Publicar el producto y confirmar el cambio de estado en la lista.
5. Confirmar que ningún paso mostró un error crudo de Supabase/Postgres.

- [ ] **Step 6: Limpiar cualquier archivo temporal de la verificación**

Si se generaron scripts o capturas temporales para la verificación de
Playwright, eliminarlos y confirmar `git status` limpio antes de cerrar
la fase.

- [ ] **Step 7: Commit final si hubo cambios de tipos**

```bash
git add types/supabase.ts
git commit -m "chore: sync de tipos tras Fase 2" --allow-empty-message -m "Fase 2: catálogo verificado en producción"
```

(Si `git status` no muestra cambios, este paso no aplica — no crear un
commit vacío.)
