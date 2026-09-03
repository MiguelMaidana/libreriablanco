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
