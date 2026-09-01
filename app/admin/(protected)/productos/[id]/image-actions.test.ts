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

  it("rechaza archivos con un tipo MIME no permitido", async () => {
    mockAdminAllowed();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    });

    const formData = new FormData();
    formData.set("file", new File(["x"], "foto.pdf", { type: "application/pdf" }));

    const result = await uploadProductImage("prod-1", { error: null }, formData);

    expect(result.error).toBe("Solo se aceptan imágenes JPG, PNG, WEBP o AVIF.");
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("rechaza archivos que superan los 5MB", async () => {
    mockAdminAllowed();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    });

    const bigContent = new Uint8Array(5 * 1024 * 1024 + 1);
    const formData = new FormData();
    formData.set("file", new File([bigContent], "foto.jpg", { type: "image/jpeg" }));

    const result = await uploadProductImage("prod-1", { error: null }, formData);

    expect(result.error).toBe("La imagen no puede pesar más de 5MB.");
    expect(mockStorageUpload).not.toHaveBeenCalled();
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
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({ eq: deleteEq }),
    });

    const result = await deleteProductImage("img-1", "prod-1");

    expect(result.error).toBeNull();
    expect(deleteEq).toHaveBeenCalledWith("id", "img-1");
  });

  it("promueve la primera imagen restante a principal y recompone posiciones al borrar la principal", async () => {
    mockAdminAllowed();

    const updateCalls: Array<{ payload: Record<string, unknown>; id: string }> = [];

    mockFrom.mockImplementation(() => ({
      select: (fields: string) => {
        if (fields === "url") {
          return {
            eq: () => ({
              single: async () => ({
                data: {
                  url: "https://example.com/storage/v1/object/public/product-images/prod-1/a.jpg",
                },
                error: null,
              }),
            }),
          };
        }
        return {
          eq: () => ({
            order: async () => ({
              data: [{ id: "img-2", is_primary: false }],
              error: null,
            }),
          }),
        };
      },
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async (_column: string, id: string) => {
          updateCalls.push({ payload, id });
          return { error: null };
        },
      }),
    }));

    const result = await deleteProductImage("img-1", "prod-1");

    expect(result.error).toBeNull();
    expect(updateCalls).toContainEqual({
      payload: { position: 0, is_primary: true },
      id: "img-2",
    });
  });
});
