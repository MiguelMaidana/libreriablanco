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
    insert: () => query,
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
