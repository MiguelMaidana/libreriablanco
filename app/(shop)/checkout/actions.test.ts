import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAnonIn = vi.fn();
const mockAnonSelect = vi.fn(() => ({ in: mockAnonIn }));
const mockAnonFrom = vi.fn(() => ({ select: mockAnonSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockAnonFrom })),
}));

const mockServiceIn = vi.fn();
const mockServiceSelect = vi.fn(() => ({ in: mockServiceIn }));
const mockServiceFrom = vi.fn(() => ({ select: mockServiceSelect }));
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom, rpc: mockRpc })),
}));

import { createOrder } from "./actions";

function buildFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("firstName", overrides.firstName ?? "Ana");
  formData.set("lastName", overrides.lastName ?? "Pérez");
  formData.set("email", overrides.email ?? "ana@example.com");
  formData.set("phone", overrides.phone ?? "");
  formData.set(
    "items",
    overrides.items ?? JSON.stringify([{ productId: "p1", quantity: 2 }]),
  );
  return formData;
}

describe("createOrder", () => {
  beforeEach(() => {
    mockAnonFrom.mockClear();
    mockAnonSelect.mockClear();
    mockAnonIn.mockReset();
    mockServiceFrom.mockClear();
    mockServiceSelect.mockClear();
    mockServiceIn.mockReset();
    mockRpc.mockReset();
  });

  it("devuelve error de validación si falta el email", async () => {
    const result = await createOrder(
      { error: null, orderNumber: null },
      buildFormData({ email: "no-valido" }),
    );
    expect(result.error).toBeTruthy();
    expect(result.orderNumber).toBeNull();
    expect(mockAnonFrom).not.toHaveBeenCalled();
  });

  it("falla si algún producto ya no está publicado/disponible", async () => {
    mockAnonIn.mockResolvedValue({ data: [], error: null });
    const result = await createOrder({ error: null, orderNumber: null }, buildFormData());
    expect(result.error).toMatch(/ya no están disponibles/i);
    expect(result.orderNumber).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("recalcula el precio desde la base, ignorando cualquier precio del cliente", async () => {
    mockAnonIn.mockResolvedValue({ data: [{ id: "p1", price: 999 }], error: null });
    mockServiceIn.mockResolvedValue({
      data: [{ id: "p1", name: "Cuaderno A4", sku: "CUA-001", cost: 500 }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ order_number: "LB-1000" }], error: null });

    // El cliente intenta "colar" su propio precio (price/unit_price) junto
    // con el item — cartItemSchema descarta las claves desconocidas y el
    // servidor debe usar igual el precio de la base (999), nunca el 1
    // que manda el formulario.
    await createOrder(
      { error: null, orderNumber: null },
      buildFormData({
        items: JSON.stringify([{ productId: "p1", quantity: 2, price: 1, unit_price: 1 }]),
      }),
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "create_guest_order",
      expect.objectContaining({
        p_items: [
          expect.objectContaining({
            product_id: "p1",
            unit_price: 999,
            unit_cost: 500,
            quantity: 2,
          }),
        ],
      }),
    );
  });

  it("devuelve el orderNumber en éxito", async () => {
    mockAnonIn.mockResolvedValue({ data: [{ id: "p1", price: 999 }], error: null });
    mockServiceIn.mockResolvedValue({
      data: [{ id: "p1", name: "Cuaderno A4", sku: "CUA-001", cost: 500 }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ order_number: "LB-1000" }], error: null });

    const result = await createOrder({ error: null, orderNumber: null }, buildFormData());

    expect(result).toEqual({ error: null, orderNumber: "LB-1000" });
  });

  it("devuelve un error genérico si la función RPC falla", async () => {
    mockAnonIn.mockResolvedValue({ data: [{ id: "p1", price: 999 }], error: null });
    mockServiceIn.mockResolvedValue({
      data: [{ id: "p1", name: "Cuaderno A4", sku: "CUA-001", cost: 500 }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await createOrder({ error: null, orderNumber: null }, buildFormData());

    expect(result.error).toBeTruthy();
    expect(result.orderNumber).toBeNull();
  });
});
