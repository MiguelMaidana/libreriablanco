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

function mockUpdateChain(result: { data: { id: string } | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eqStatus = vi.fn().mockReturnValue({ select });
  const eqId = vi.fn().mockReturnValue({ eq: eqStatus });
  const update = vi.fn().mockReturnValue({ eq: eqId });
  mockFrom.mockReturnValue({ update });
  return { update, eqId, eqStatus };
}

import { finalizeOrder, cancelOrder } from "./actions";

describe("finalizeOrder", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de permisos si el admin no tiene acceso", async () => {
    mockAdminForbidden();
    const result = await finalizeOrder("order-1");
    expect(result.error).toBe("No tenés permiso para esta acción.");
  });

  it("pasa el pedido a COMPLETED y setea payment_confirmed_at", async () => {
    mockAdminAllowed();
    const { update, eqId, eqStatus } = mockUpdateChain({ data: { id: "order-1" }, error: null });

    const result = await finalizeOrder("order-1");

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED", payment_confirmed_at: expect.any(String) }),
    );
    expect(eqId).toHaveBeenCalledWith("id", "order-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "NEW");
  });

  it("devuelve error si el pedido ya no está en estado Nuevo", async () => {
    mockAdminAllowed();
    mockUpdateChain({ data: null, error: null });

    const result = await finalizeOrder("order-1");

    expect(result.error).toBe("Este pedido ya no está en estado Nuevo.");
  });
});

describe("cancelOrder", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de permisos si el admin no tiene acceso", async () => {
    mockAdminForbidden();
    const result = await cancelOrder("order-1");
    expect(result.error).toBe("No tenés permiso para esta acción.");
  });

  it("pasa el pedido a CANCELLED", async () => {
    mockAdminAllowed();
    const { update } = mockUpdateChain({ data: { id: "order-1" }, error: null });

    const result = await cancelOrder("order-1");

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ status: "CANCELLED" });
  });

  it("devuelve error si el pedido ya no está en estado Nuevo", async () => {
    mockAdminAllowed();
    mockUpdateChain({ data: null, error: null });

    const result = await cancelOrder("order-1");

    expect(result.error).toBe("Este pedido ya no está en estado Nuevo.");
  });
});
