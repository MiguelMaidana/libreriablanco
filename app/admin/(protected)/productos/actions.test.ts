import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
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

  it("devuelve un error de negocio (no lanza) cuando el permiso es denegado", async () => {
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

    const result = await toggleProductAvailability("prod-1", false);

    expect(result.error).toBe("No tenés permiso para esta acción.");
  });
});
