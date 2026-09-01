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
