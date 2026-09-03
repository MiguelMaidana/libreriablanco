# Fase 6 — Admin: Configuración del negocio — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por
> tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Construir la pantalla de admin para editar la fila única
de `settings` (librería, WhatsApp, transferencia, tienda), incluyendo
carga de logo e imagen del hero vía Supabase Storage — cerrando la
brecha real de datos vacíos en producción documentada desde Fase 3.

**Arquitectura:** Una sola ruta `/admin/configuracion` con un
formulario de texto (`SettingsForm`, Server Action `updateSettings`) y
dos widgets de carga de imagen independientes (`SettingsImageUpload`,
Server Actions `uploadLogo`/`uploadHeroImage`) — separados del
formulario principal porque HTML no permite anidar `<form>` dentro de
otro `<form>`. Bucket nuevo de Storage (`settings-images`) siguiendo
exactamente el mismo patrón de permisos que `product-images` de Fase 2.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind
v4 + shadcn/ui, Supabase (Postgres + Storage), Zod, Vitest + Testing
Library.

**Spec:** `docs/superpowers/specs/2026-09-03-fase6-configuracion-design.md`

## Global Constraints

- Ningún campo de texto es obligatorio — la tabla `settings` los
  define `nullable` y el formulario no exige ninguno. El único campo
  no nulo es `store_enabled` (`boolean not null default true`).
- "Categorías destacadas" no se agrega a esta pantalla — ya está
  cubierto por el toggle "Destacada" de la pantalla de Categorías
  (Fase 2).
- `legal_name`/`tax_id` (datos de facturación/ARCA) no se exponen en
  este formulario — son evolutivos, fuera del MVP.
- Todas las mutaciones (`updateSettings`, `uploadLogo`,
  `uploadHeroImage`) usan `withPermissionAction("configuracion", "editar", ...)`.
- El bucket `settings-images` usa los mismos límites que
  `product-images`: `image/jpeg`, `image/png`, `image/webp`,
  `image/avif`, máximo 5MB.
- La carga de logo/hero reemplaza el archivo (nombre único por subida)
  sin borrar el anterior en Storage — solo se actualiza la columna
  correspondiente de `settings`.
- La lectura de la página no tiene guard de permiso explícito — se
  apoya en la política RLS ya vigente de `settings` (lectura pública,
  escritura solo con `configuracion:editar`).
- Toda interpolación de `$` en JSX usa un template literal real, nunca
  `${valor}` como texto JSX plano.
- Componentes nuevos en `components/admin/`; validaciones nuevas en
  `lib/validations/` (junto a `product.ts`).

---

### Task 1: Migración — bucket de Storage `settings-images`

**Files:**
- Create: migración vía `supabase migration new settings_images_bucket`

- [ ] **Step 1: Crear la migración**

Run: `supabase migration new settings_images_bucket`

- [ ] **Step 2: Escribir el contenido de la migración**

```sql
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('settings-images', 'settings-images', true, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'], 5242880)
on conflict (id) do nothing;

create policy "public read settings images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'settings-images');

create policy "admins with configuracion editar manage settings image files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'settings-images'
  and public.has_permission(auth.uid(), 'configuracion', 'editar')
)
with check (
  bucket_id = 'settings-images'
  and public.has_permission(auth.uid(), 'configuracion', 'editar')
);
```

- [ ] **Step 3: Aplicar en local (si Docker está disponible) y verificar**

Run: `supabase db reset`
Expected: corre sin error junto con todas las migraciones anteriores.

Si Docker no está disponible en el entorno, documentarlo y aplicar
directamente contra producción recién en la Tarea 8, con confirmación
explícita del usuario antes de pushear (mismo criterio ya usado en
fases anteriores de este proyecto).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat: bucket de storage para imágenes de configuración (logo/hero)"
```

---

### Task 2: Validación de `settings` (Zod)

**Files:**
- Create: `lib/validations/settings.ts`
- Create: `lib/validations/settings.test.ts`

**Interfaces:**
- Produce: `settingsSchema` (Zod), `type SettingsInput = z.infer<typeof settingsSchema>`.
- Consumido por: Task 3 (`updateSettings`).

- [ ] **Step 1: Escribir el test**

```typescript
// lib/validations/settings.test.ts
import { describe, it, expect } from "vitest";
import { settingsSchema } from "./settings";

const validInput = {
  businessName: "Librería Blanco",
  address: "Av. Siempre Viva 123",
  businessHours: "Lun a Vie 9 a 18",
  phone: "1122334455",
  email: "hola@libreriablanco.com",
  whatsappNumber: "5491122334455",
  whatsappGeneralMessage: "Hola! Quería hacer una consulta.",
  whatsappReceiptTemplate: "Hola! Te paso el comprobante.",
  whatsappShippingInquiryTemplate: "Hola! Necesito que me envíen el pedido.",
  transferAlias: "libreria.blanco",
  transferAccountHolder: "Librería Blanco SRL",
  transferCbuCvu: "0000003100012345678901",
  transferBankOrWallet: "Banco Nación",
  transferInstructions: "Enviar el comprobante por WhatsApp.",
  storeEnabled: true,
  heroTitle: "Todo para volver al cole",
  heroText: "Encontrá útiles, cuadernos y mucho más.",
  heroCtaText: "Ver productos",
  heroCtaLink: "/productos",
  pickupInstructionsText: "Retirá tu pedido de lunes a sábado.",
};

describe("settingsSchema", () => {
  it("acepta todos los campos completos", () => {
    const result = settingsSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBe("Librería Blanco");
      expect(result.data.storeEnabled).toBe(true);
    }
  });

  it("convierte campos de texto vacíos o solo espacios a null", () => {
    const result = settingsSchema.safeParse({
      ...validInput,
      businessName: "",
      transferAlias: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBeNull();
      expect(result.data.transferAlias).toBeNull();
    }
  });

  it("acepta todos los campos de texto ausentes", () => {
    const result = settingsSchema.safeParse({ storeEnabled: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBeNull();
      expect(result.data.storeEnabled).toBe(false);
    }
  });

  it("rechaza si storeEnabled no es un booleano", () => {
    const result = settingsSchema.safeParse({ ...validInput, storeEnabled: "true" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test lib/validations/settings.test.ts`
Expected: FAIL — `Cannot find module './settings'`.

- [ ] **Step 3: Implementar `lib/validations/settings.ts`**

```typescript
import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : null));

export const settingsSchema = z.object({
  businessName: optionalText,
  address: optionalText,
  businessHours: optionalText,
  phone: optionalText,
  email: optionalText,
  whatsappNumber: optionalText,
  whatsappGeneralMessage: optionalText,
  whatsappReceiptTemplate: optionalText,
  whatsappShippingInquiryTemplate: optionalText,
  transferAlias: optionalText,
  transferAccountHolder: optionalText,
  transferCbuCvu: optionalText,
  transferBankOrWallet: optionalText,
  transferInstructions: optionalText,
  storeEnabled: z.boolean(),
  heroTitle: optionalText,
  heroText: optionalText,
  heroCtaText: optionalText,
  heroCtaLink: optionalText,
  pickupInstructionsText: optionalText,
});

export type SettingsInput = z.infer<typeof settingsSchema>;
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test lib/validations/settings.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/settings.ts lib/validations/settings.test.ts
git commit -m "feat: validación de settings"
```

---

### Task 3: Server Action `updateSettings`

**Files:**
- Create: `app/admin/(protected)/configuracion/actions.ts`
- Create: `app/admin/(protected)/configuracion/actions.test.ts`

**Interfaces:**
- Consume: `settingsSchema` (Task 2), `withPermissionAction` (`lib/auth/permissions.ts`, ya existente).
- Produce: `interface SettingsActionState { error: string | null }`, `updateSettings(prevState: SettingsActionState, formData: FormData): Promise<SettingsActionState>`.
- Consumido por: Task 6 (`SettingsForm`).

- [ ] **Step 1: Escribir el test**

```typescript
// app/admin/(protected)/configuracion/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc, from: mockFrom })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

function mockAdminForbidden() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["VENDEDORA"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: false, error: null });
  });
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

import { updateSettings } from "./actions";

describe("updateSettings", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de permisos si el admin no tiene acceso", async () => {
    mockAdminForbidden();
    const result = await updateSettings({ error: null }, formData({ businessName: "Librería Blanco" }));
    expect(result.error).toBe("No tenés permiso para esta acción.");
  });

  it("actualiza la fila de settings con los campos mapeados a snake_case", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await updateSettings(
      { error: null },
      formData({
        businessName: "Librería Blanco",
        transferAlias: "libreria.blanco",
        storeEnabled: "on",
      }),
    );

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: "Librería Blanco",
        transfer_alias: "libreria.blanco",
        store_enabled: true,
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", 1);
  });

  it("interpreta storeEnabled ausente del form como false", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    await updateSettings({ error: null }, formData({ businessName: "Librería Blanco" }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ store_enabled: false }));
  });

  it("devuelve un error genérico si Supabase falla", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await updateSettings({ error: null }, formData({ businessName: "Librería Blanco" }));

    expect(result.error).toBe("No pudimos guardar la configuración.");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test "app/admin/(protected)/configuracion/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Implementar `app/admin/(protected)/configuracion/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";
import { settingsSchema } from "@/lib/validations/settings";

export interface SettingsActionState {
  error: string | null;
}

const FORBIDDEN: SettingsActionState = { error: "No tenés permiso para esta acción." };

function parseSettingsForm(formData: FormData) {
  const getValue = (key: string) => formData.get(key) ?? undefined;

  return settingsSchema.safeParse({
    businessName: getValue("businessName"),
    address: getValue("address"),
    businessHours: getValue("businessHours"),
    phone: getValue("phone"),
    email: getValue("email"),
    whatsappNumber: getValue("whatsappNumber"),
    whatsappGeneralMessage: getValue("whatsappGeneralMessage"),
    whatsappReceiptTemplate: getValue("whatsappReceiptTemplate"),
    whatsappShippingInquiryTemplate: getValue("whatsappShippingInquiryTemplate"),
    transferAlias: getValue("transferAlias"),
    transferAccountHolder: getValue("transferAccountHolder"),
    transferCbuCvu: getValue("transferCbuCvu"),
    transferBankOrWallet: getValue("transferBankOrWallet"),
    transferInstructions: getValue("transferInstructions"),
    storeEnabled: formData.get("storeEnabled") === "on",
    heroTitle: getValue("heroTitle"),
    heroText: getValue("heroText"),
    heroCtaText: getValue("heroCtaText"),
    heroCtaLink: getValue("heroCtaLink"),
    pickupInstructionsText: getValue("pickupInstructionsText"),
  });
}

function toRow(input: ReturnType<typeof settingsSchema.parse>) {
  return {
    business_name: input.businessName,
    address: input.address,
    business_hours: input.businessHours,
    phone: input.phone,
    email: input.email,
    whatsapp_number: input.whatsappNumber,
    whatsapp_general_message: input.whatsappGeneralMessage,
    whatsapp_receipt_template: input.whatsappReceiptTemplate,
    whatsapp_shipping_inquiry_template: input.whatsappShippingInquiryTemplate,
    transfer_alias: input.transferAlias,
    transfer_account_holder: input.transferAccountHolder,
    transfer_cbu_cvu: input.transferCbuCvu,
    transfer_bank_or_wallet: input.transferBankOrWallet,
    transfer_instructions: input.transferInstructions,
    store_enabled: input.storeEnabled,
    hero_title: input.heroTitle,
    hero_text: input.heroText,
    hero_cta_text: input.heroCtaText,
    hero_cta_link: input.heroCtaLink,
    pickup_instructions_text: input.pickupInstructionsText,
  };
}

export async function updateSettings(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return withPermissionAction("configuracion", "editar", FORBIDDEN, async () => {
    const parsed = parseSettingsForm(formData);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("settings").update(toRow(parsed.data)).eq("id", 1);

    if (error) {
      console.error("updateSettings: error updating settings", error);
      return { error: "No pudimos guardar la configuración." };
    }

    revalidatePath("/admin/configuracion");
    revalidatePath("/");
    return { error: null };
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test "app/admin/(protected)/configuracion/actions.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/configuracion/actions.ts" "app/admin/(protected)/configuracion/actions.test.ts"
git commit -m "feat: server action para actualizar la configuración del negocio"
```

---

### Task 4: Server Actions `uploadLogo` / `uploadHeroImage`

**Files:**
- Create: `app/admin/(protected)/configuracion/image-actions.ts`
- Create: `app/admin/(protected)/configuracion/image-actions.test.ts`

**Interfaces:**
- Consume: `withPermissionAction` (`lib/auth/permissions.ts`).
- Produce: `interface ImageActionState { error: string | null }`, `uploadLogo(prevState: ImageActionState, formData: FormData): Promise<ImageActionState>`, `uploadHeroImage(prevState: ImageActionState, formData: FormData): Promise<ImageActionState>`.
- Consumido por: Task 5 (`SettingsImageUpload`), Task 7 (página).

- [ ] **Step 1: Escribir el test**

```typescript
// app/admin/(protected)/configuracion/image-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockStorageUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

function mockAdminForbidden() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "get_my_admin_profile") {
      return {
        maybeSingle: async () => ({
          data: { id: "u1", full_name: "Admin", is_active: true, role_names: ["VENDEDORA"] },
          error: null,
        }),
      };
    }
    return Promise.resolve({ data: false, error: null });
  });
}

import { uploadLogo, uploadHeroImage } from "./image-actions";

describe("uploadLogo", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockStorageUpload.mockReset();
    mockGetPublicUrl.mockReset();
  });

  it("devuelve error de permisos si el admin no tiene acceso", async () => {
    mockAdminForbidden();
    const formData = new FormData();
    formData.set("file", new File(["x"], "logo.png", { type: "image/png" }));
    const result = await uploadLogo({ error: null }, formData);
    expect(result.error).toBe("No tenés permiso para esta acción.");
  });

  it("rechaza si no se eligió ningún archivo", async () => {
    mockAdminAllowed();
    const formData = new FormData();
    const result = await uploadLogo({ error: null }, formData);
    expect(result.error).toBe("Elegí una imagen para subir.");
  });

  it("rechaza tipos de archivo no permitidos", async () => {
    mockAdminAllowed();
    const formData = new FormData();
    formData.set("file", new File(["x"], "logo.gif", { type: "image/gif" }));
    const result = await uploadLogo({ error: null }, formData);
    expect(result.error).toBe("Solo se aceptan imágenes JPG, PNG, WEBP o AVIF.");
  });

  it("sube el logo y actualiza settings.logo_url", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/logo.png" } });

    const formData = new FormData();
    formData.set("file", new File(["x"], "logo.png", { type: "image/png" }));

    const result = await uploadLogo({ error: null }, formData);

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ logo_url: "https://example.com/logo.png" });
    expect(eq).toHaveBeenCalledWith("id", 1);
  });
});

describe("uploadHeroImage", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockStorageUpload.mockReset();
    mockGetPublicUrl.mockReset();
  });

  it("sube la imagen del hero y actualiza settings.hero_image_url", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/hero.jpg" } });

    const formData = new FormData();
    formData.set("file", new File(["x"], "hero.jpg", { type: "image/jpeg" }));

    const result = await uploadHeroImage({ error: null }, formData);

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ hero_image_url: "https://example.com/hero.jpg" });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test "app/admin/(protected)/configuracion/image-actions.test.ts"`
Expected: FAIL — `Cannot find module './image-actions'`.

- [ ] **Step 3: Implementar `app/admin/(protected)/configuracion/image-actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";

const SETTINGS_IMAGE_BUCKET = "settings-images";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export interface ImageActionState {
  error: string | null;
}

const FORBIDDEN_IMAGE: ImageActionState = { error: "No tenés permiso para esta acción." };

async function uploadSettingsImage(
  field: "logo_url" | "hero_image_url",
  formData: FormData,
): Promise<ImageActionState> {
  return withPermissionAction("configuracion", "editar", FORBIDDEN_IMAGE, async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Elegí una imagen para subir." };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: "Solo se aceptan imágenes JPG, PNG, WEBP o AVIF." };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: "La imagen no puede pesar más de 5MB." };
    }

    const supabase = await createClient();
    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${field}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(SETTINGS_IMAGE_BUCKET).upload(path, file);

    if (uploadError) {
      console.error("uploadSettingsImage: error uploading file", uploadError);
      return { error: "No pudimos subir la imagen." };
    }

    const { data: publicUrlData } = supabase.storage.from(SETTINGS_IMAGE_BUCKET).getPublicUrl(path);

    const updatePayload =
      field === "logo_url"
        ? { logo_url: publicUrlData.publicUrl }
        : { hero_image_url: publicUrlData.publicUrl };

    const { error: updateError } = await supabase.from("settings").update(updatePayload).eq("id", 1);

    if (updateError) {
      console.error("uploadSettingsImage: error updating settings row", updateError);
      return { error: "No pudimos guardar la imagen." };
    }

    revalidatePath("/admin/configuracion");
    revalidatePath("/");
    return { error: null };
  });
}

export async function uploadLogo(
  _prevState: ImageActionState,
  formData: FormData,
): Promise<ImageActionState> {
  return uploadSettingsImage("logo_url", formData);
}

export async function uploadHeroImage(
  _prevState: ImageActionState,
  formData: FormData,
): Promise<ImageActionState> {
  return uploadSettingsImage("hero_image_url", formData);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test "app/admin/(protected)/configuracion/image-actions.test.ts"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/configuracion/image-actions.ts" "app/admin/(protected)/configuracion/image-actions.test.ts"
git commit -m "feat: server actions para subir logo e imagen del hero"
```

---

### Task 5: Componente `SettingsImageUpload`

**Files:**
- Create: `components/admin/settings-image-upload.tsx`
- Create: `components/admin/settings-image-upload.test.tsx`

**Interfaces:**
- Consume: `ImageActionState` (Task 4).
- Produce: `SettingsImageUpload({ label: string; currentUrl: string | null; uploadAction: (prevState: ImageActionState, formData: FormData) => Promise<ImageActionState> })`.
- Consumido por: Task 7 (página).

- [ ] **Step 1: Escribir el test**

```tsx
// components/admin/settings-image-upload.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsImageUpload } from "./settings-image-upload";

describe("SettingsImageUpload", () => {
  const mockUploadAction = vi.fn();

  beforeEach(() => {
    mockUploadAction.mockReset();
  });

  it("muestra la imagen actual cuando currentUrl está definido", () => {
    render(
      <SettingsImageUpload
        label="Logo"
        currentUrl="https://example.com/logo.png"
        uploadAction={mockUploadAction}
      />,
    );
    expect(screen.getByAltText("Logo")).toBeInTheDocument();
  });

  it("no muestra ninguna imagen cuando currentUrl es null", () => {
    render(<SettingsImageUpload label="Logo" currentUrl={null} uploadAction={mockUploadAction} />);
    expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
  });

  it("llama a uploadAction al subir un archivo", async () => {
    mockUploadAction.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SettingsImageUpload label="Logo" currentUrl={null} uploadAction={mockUploadAction} />);

    const file = new File(["x"], "logo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Subir logo"), file);
    await user.click(screen.getByRole("button", { name: "Subir" }));

    expect(mockUploadAction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test components/admin/settings-image-upload.test.tsx`
Expected: FAIL — `Cannot find module './settings-image-upload'`.

- [ ] **Step 3: Implementar `SettingsImageUpload`**

```tsx
"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ImageActionState } from "@/app/admin/(protected)/configuracion/image-actions";

interface SettingsImageUploadProps {
  label: string;
  currentUrl: string | null;
  uploadAction: (prevState: ImageActionState, formData: FormData) => Promise<ImageActionState>;
}

export function SettingsImageUpload({ label, currentUrl, uploadAction }: SettingsImageUploadProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadAction({ error: null }, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${label} actualizado.`);
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {currentUrl && (
        <Image
          src={currentUrl}
          alt={label}
          width={128}
          height={128}
          className="aspect-square rounded object-cover"
        />
      )}
      <form ref={formRef} action={handleUpload} className="flex flex-col gap-2">
        <input
          name="file"
          type="file"
          accept="image/*"
          required
          aria-label={`Subir ${label.toLowerCase()}`}
        />
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "Subiendo..." : "Subir"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test components/admin/settings-image-upload.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/admin/settings-image-upload.tsx components/admin/settings-image-upload.test.tsx
git commit -m "feat: componente de carga de logo/imagen del hero"
```

---

### Task 6: Componente `SettingsForm`

**Files:**
- Create: `components/admin/settings-form.tsx`

Sin test de componente dedicado (decisión de la spec: es un formulario
largo pero mecánico, sin lógica de negocio propia como cálculo de
margen o advertencias condicionales — a diferencia de `ProductForm` —
que amerite un test de UI específico; su comportamiento de guardado ya
está cubierto por los tests de `updateSettings`, Task 3).

**Interfaces:**
- Consume: `updateSettings`, `SettingsActionState` (Task 3), `Settings` (tipo de `lib/shop/settings.ts`, ya existente desde Fase 3).
- Produce: `SettingsForm({ settings: Settings | null })`.
- Consumido por: Task 7 (página).

- [ ] **Step 1: Implementar `SettingsForm`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateSettings, type SettingsActionState } from "@/app/admin/(protected)/configuracion/actions";
import type { Settings } from "@/lib/shop/settings";

interface SettingsFormProps {
  settings: Settings | null;
}

const initialState: SettingsActionState = { error: null };

export function SettingsForm({ settings }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    submittedRef.current = false;
    if (state.error === null) {
      toast.success("Configuración guardada.");
    }
  }, [state, pending]);

  function handleSubmit() {
    submittedRef.current = true;
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Librería</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="businessName">Nombre</Label>
          <Input id="businessName" name="businessName" defaultValue={settings?.business_name ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" name="address" defaultValue={settings?.address ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="businessHours">Horarios</Label>
          <Input id="businessHours" name="businessHours" defaultValue={settings?.business_hours ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={settings?.phone ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={settings?.email ?? ""} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">WhatsApp</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappNumber">Número</Label>
          <Input id="whatsappNumber" name="whatsappNumber" defaultValue={settings?.whatsapp_number ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappGeneralMessage">Mensaje general</Label>
          <Textarea
            id="whatsappGeneralMessage"
            name="whatsappGeneralMessage"
            defaultValue={settings?.whatsapp_general_message ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappReceiptTemplate">Mensaje para comprobante</Label>
          <Textarea
            id="whatsappReceiptTemplate"
            name="whatsappReceiptTemplate"
            defaultValue={settings?.whatsapp_receipt_template ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappShippingInquiryTemplate">Mensaje para consulta de envío</Label>
          <Textarea
            id="whatsappShippingInquiryTemplate"
            name="whatsappShippingInquiryTemplate"
            defaultValue={settings?.whatsapp_shipping_inquiry_template ?? ""}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Transferencia</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferAlias">Alias</Label>
          <Input id="transferAlias" name="transferAlias" defaultValue={settings?.transfer_alias ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferAccountHolder">Titular</Label>
          <Input
            id="transferAccountHolder"
            name="transferAccountHolder"
            defaultValue={settings?.transfer_account_holder ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferCbuCvu">CBU/CVU</Label>
          <Input id="transferCbuCvu" name="transferCbuCvu" defaultValue={settings?.transfer_cbu_cvu ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferBankOrWallet">Banco/billetera</Label>
          <Input
            id="transferBankOrWallet"
            name="transferBankOrWallet"
            defaultValue={settings?.transfer_bank_or_wallet ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferInstructions">Instrucciones</Label>
          <Textarea
            id="transferInstructions"
            name="transferInstructions"
            defaultValue={settings?.transfer_instructions ?? ""}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Tienda</h2>
        <div className="flex items-center justify-between">
          <Label htmlFor="storeEnabled">Tienda habilitada</Label>
          <Switch id="storeEnabled" name="storeEnabled" defaultChecked={settings?.store_enabled ?? true} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroTitle">Título de Home</Label>
          <Input id="heroTitle" name="heroTitle" defaultValue={settings?.hero_title ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroText">Texto del Hero</Label>
          <Textarea id="heroText" name="heroText" defaultValue={settings?.hero_text ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroCtaText">Texto del botón del Hero</Label>
          <Input id="heroCtaText" name="heroCtaText" defaultValue={settings?.hero_cta_text ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroCtaLink">Link del botón del Hero</Label>
          <Input id="heroCtaLink" name="heroCtaLink" defaultValue={settings?.hero_cta_link ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pickupInstructionsText">Instrucciones de retiro</Label>
          <Textarea
            id="pickupInstructionsText"
            name="pickupInstructionsText"
            defaultValue={settings?.pickup_instructions_text ?? ""}
          />
        </div>
      </section>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Correr toda la suite**

Run: `pnpm test`
Expected: PASS (este componente no tiene test propio, per la nota de arriba).

- [ ] **Step 3: Commit**

```bash
git add components/admin/settings-form.tsx
git commit -m "feat: formulario de configuración del negocio"
```

---

### Task 7: Página `/admin/configuracion` y nav de la sidebar

**Files:**
- Create: `app/admin/(protected)/configuracion/page.tsx`
- Modify: `components/admin/sidebar.tsx` (agrega el link "Configuración")

**Interfaces:**
- Consume: `getSettings` (`lib/shop/settings.ts`, ya existente), `SettingsForm` (Task 6), `SettingsImageUpload` (Task 5), `uploadLogo`/`uploadHeroImage` (Task 4).

- [ ] **Step 1: Implementar la página**

Nota importante: los widgets de imagen se renderizan **fuera** del
`<form>` principal (`SettingsForm` ya cierra su propio `<form>` antes
de esta sección) porque HTML no permite anidar un `<form>` dentro de
otro — cada widget de `SettingsImageUpload` tiene su propio `<form>`
independiente.

```tsx
// app/admin/(protected)/configuracion/page.tsx
import { getSettings } from "@/lib/shop/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { SettingsImageUpload } from "@/components/admin/settings-image-upload";
import { uploadLogo, uploadHeroImage } from "./image-actions";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl">Configuración</h1>
      <SettingsForm settings={settings} />
      <section className="flex max-w-2xl flex-col gap-6 border-t pt-6">
        <h2 className="text-lg font-medium">Imágenes</h2>
        <SettingsImageUpload
          label="Logo"
          currentUrl={settings?.logo_url ?? null}
          uploadAction={uploadLogo}
        />
        <SettingsImageUpload
          label="Imagen del Hero"
          currentUrl={settings?.hero_image_url ?? null}
          uploadAction={uploadHeroImage}
        />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Agregar el link de Configuración a la sidebar**

Modificar únicamente la función `NavLinks` dentro de
`components/admin/sidebar.tsx` — el resto del archivo queda igual.
Agregar esta línea junto a los links ya existentes (Productos,
Categorías, Pedidos, Clientes):

```tsx
      <Link
        href="/admin/configuracion"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Configuración
      </Link>
```

- [ ] **Step 3: Correr toda la suite, lint y typecheck**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: todo verde.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(protected)/configuracion/page.tsx" components/admin/sidebar.tsx
git commit -m "feat: página /admin/configuracion y navegación"
```

---

### Task 8: Sync a producción y verificación manual end-to-end

**Files:** ninguno nuevo — tarea de despliegue y verificación.

- [ ] **Step 1: Correr la suite completa localmente**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm exec next build`
Expected: todo verde, build sin errores. Si `pnpm test` tropieza con
timeouts transitorios del worker-pool de vitest (ya visto varias veces
en este proyecto por el directorio sincronizado con OneDrive),
reintentar una vez antes de investigar más.

- [ ] **Step 2: Push de la migración al proyecto real**

Confirmar primero con el usuario (acción sobre producción). Si la
Tarea 1 no pudo verificarse localmente por falta de Docker, este es el
primer punto en que la migración toca una base real.

Run: `supabase db push`
Expected: aplica la migración del bucket `settings-images`.

- [ ] **Step 3: Deploy a producción**

Este proyecto usa `main` (no `nueva-ui`) como Production Branch en
Vercel — un push a `nueva-ui` sola solo genera un preview deployment.

```bash
git push origin nueva-ui
git push origin nueva-ui:main
```

Confirmar con las herramientas de Vercel que el deployment sobre
`main` queda en estado `READY`.

- [ ] **Step 4: Cargar datos reales desde el admin**

Con sesión de administradora real contra producción: entrar a
`/admin/configuracion` y cargar los datos reales de la librería
(WhatsApp, transferencia, hero, logo) — esto cierra definitivamente la
brecha de datos vacíos documentada desde Fase 3.

- [ ] **Step 5: Verificación manual end-to-end en producción**

1. `/admin/configuracion` carga los valores actuales de `settings`
   (los recién cargados en el Step 4, o vacíos si es la primera vez).
2. Editar un campo de texto (ej. "Mensaje para comprobante") y guardar
   — confirmar el toast de éxito y que el valor persiste al recargar
   la página.
3. Subir un logo y una imagen de hero — confirmar que cada upload es
   independiente del guardado del resto del formulario (no hace falta
   tocar "Guardar cambios" para que la imagen quede subida).
4. Verificar en `/` (Home público) que el hero ahora muestra la imagen
   y el texto configurados.
5. Verificar en `/compra-exitosa/<algún pedido real>` que los datos de
   transferencia recién cargados aparecen correctamente (cierra el gap
   documentado en el cierre de Fase 4).
6. Verificar que el botón de WhatsApp del header/catálogo usa el
   número recién configurado.
7. Responsive en 360px/768px/1440px (spec maestra §101).

Si no hay acceso a un navegador real (Playwright u otro) en el momento
de cerrar esta fase, documentar explícitamente qué quedó verificado
por HTTP/consulta directa a la base y qué queda pendiente de una
verificación visual manual — mismo criterio ya usado en fases
anteriores.

- [ ] **Step 6: Limpiar cualquier archivo temporal de la verificación**

Confirmar `git status` limpio (sin contar archivos preexistentes no
relacionados con esta fase) antes de cerrar.
