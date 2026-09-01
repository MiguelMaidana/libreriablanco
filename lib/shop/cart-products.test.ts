import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPublicProductsIn = vi.fn();
const mockPublicProductsSelect = vi.fn(() => ({ in: mockPublicProductsIn }));
const mockProductImagesEq = vi.fn().mockResolvedValue({ data: [], error: null });
const mockProductImagesIn = vi.fn(() => ({ eq: mockProductImagesEq }));
const mockProductImagesSelect = vi.fn(() => ({ in: mockProductImagesIn }));

const mockFrom = vi.fn((table: string) => {
  if (table === "public_products") {
    return { select: mockPublicProductsSelect };
  }
  if (table === "product_images") {
    return { select: mockProductImagesSelect };
  }
  return { select: vi.fn() };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { getCartProducts } from "./cart-products";

describe("getCartProducts", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockPublicProductsSelect.mockClear();
    mockPublicProductsIn.mockClear();
    mockProductImagesSelect.mockClear();
    mockProductImagesIn.mockClear();
    mockProductImagesEq.mockClear();
    mockProductImagesEq.mockResolvedValue({ data: [], error: null });
  });

  it("devuelve [] sin consultar la base si no hay ids", async () => {
    const result = await getCartProducts([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("consulta public_products filtrando por los ids recibidos", async () => {
    mockPublicProductsIn.mockResolvedValue({ data: [{ id: "p1", name: "Cuaderno", price: 1000 }], error: null });
    const result = await getCartProducts(["p1", "p2"]);
    expect(mockFrom).toHaveBeenCalledWith("public_products");
    expect(mockPublicProductsIn).toHaveBeenCalledWith("id", ["p1", "p2"]);
    expect(result[0]).toMatchObject({ id: "p1", name: "Cuaderno", price: 1000, imageUrl: null });
  });

  it("un id que ya no está publicado/disponible no aparece en el resultado", async () => {
    mockPublicProductsIn.mockResolvedValue({ data: [{ id: "p1", name: "Cuaderno", price: 1000 }], error: null });
    const result = await getCartProducts(["p1", "p-eliminado"]);
    expect(result.map((p) => p.id)).toEqual(["p1"]);
  });

  it("devuelve [] si Supabase devuelve error", async () => {
    mockPublicProductsIn.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await getCartProducts(["p1"]);
    expect(result).toEqual([]);
  });
});
