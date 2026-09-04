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

function chain(result: unknown, overrides: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {
    select: () => query,
    eq: () => query,
    in: () => query,
    delete: () => query,
    update: () => query,
    insert: () => query,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
    ...overrides,
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

  it("Critical 2 / createRole: no crea el rol si falla el fetch del catálogo de permisos", async () => {
    mockSuperAdmin();
    const rolesInsertSpy = vi.fn(() => chain({ data: { id: "role-1" }, error: null }));
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "role-1" }, error: null }, { insert: rolesInsertSpy });
      }
      if (table === "permissions") {
        // Fallo real del fetch del catálogo (distinto de "no se marcó
        // ningún checkbox"): antes se confundía silenciosamente con `[]`.
        return chain({ data: null, error: { message: "boom" } });
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "Vendedora");
    formData.set("perm_productos_ver", "on");

    const result = await createRole({ error: null }, formData);

    expect(result.error).toBe("No pudimos guardar los permisos del rol.");
    expect(rolesInsertSpy).not.toHaveBeenCalled();
  });

  it("Important 6: si falla el insert de role_permissions, borra el rol recién creado (evita huérfanos)", async () => {
    mockSuperAdmin();
    const roleDeleteSpy = vi.fn(() => chain({ error: null }));
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "role-1" }, error: null }, { delete: roleDeleteSpy });
      }
      if (table === "permissions") {
        return chain({ data: [{ id: "p1", module: "productos", action: "ver" }], error: null });
      }
      if (table === "role_permissions") {
        return chain({ error: { message: "insert failed" } });
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "Vendedora");
    formData.set("perm_productos_ver", "on");

    const result = await createRole({ error: null }, formData);

    expect(result.error).toBe("No pudimos guardar los permisos del rol.");
    expect(roleDeleteSpy).toHaveBeenCalled();
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

  it("Critical 2: propaga el error si falla el fetch del catálogo de permisos, sin tocar role_permissions", async () => {
    mockSuperAdmin();
    const rolePermissionsDeleteSpy = vi.fn(() => chain({ error: null }));
    const rolePermissionsInsertSpy = vi.fn(() => chain({ error: null }));
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      if (table === "permissions") {
        return chain({ data: null, error: { message: "boom" } });
      }
      if (table === "role_permissions") {
        return chain(
          { data: [{ permission_id: "p1" }], error: null },
          { delete: rolePermissionsDeleteSpy, insert: rolePermissionsInsertSpy },
        );
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "Stock");
    formData.set("perm_stock_ver", "on");

    const result = await updateRole("role-1", { error: null }, formData);

    expect(result.error).toBe("No pudimos guardar los permisos del rol.");
    expect(rolePermissionsDeleteSpy).not.toHaveBeenCalled();
    expect(rolePermissionsInsertSpy).not.toHaveBeenCalled();
  });

  it("Critical 2: si falla el insert de permisos nuevos, no borra los permisos existentes (nunca queda el rol en cero)", async () => {
    mockSuperAdmin();
    const rolePermissionsDeleteSpy = vi.fn(() => chain({ error: null }));
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      if (table === "permissions") {
        return chain({
          data: [
            { id: "p1", module: "stock", action: "ver" },
            { id: "p2", module: "stock", action: "crear" },
          ],
          error: null,
        });
      }
      if (table === "role_permissions") {
        // El rol ya tiene p1 y p3 asignados. El formulario marca p1 y p2
        // (se agrega p2, se desmarca p3), pero el insert del nuevo (p2)
        // falla. El delete de p3 NUNCA debería ejecutarse: los permisos
        // viejos tienen que seguir intactos.
        return chain(
          { data: [{ permission_id: "p1" }, { permission_id: "p3" }], error: null },
          {
            insert: () => chain({ error: { message: "insert failed" } }),
            delete: rolePermissionsDeleteSpy,
          },
        );
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "Stock");
    formData.set("perm_stock_ver", "on");
    formData.set("perm_stock_crear", "on");

    const result = await updateRole("role-1", { error: null }, formData);

    expect(result.error).toBe("No pudimos guardar los permisos del rol.");
    expect(rolePermissionsDeleteSpy).not.toHaveBeenCalled();
  });

  it("agrega los permisos nuevos y borra solo los desmarcados", async () => {
    mockSuperAdmin();
    const insertSpy = vi.fn(() => chain({ error: null }));
    const deleteSpy = vi.fn(() => chain({ error: null }));
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      if (table === "permissions") {
        return chain({
          data: [
            { id: "p1", module: "stock", action: "ver" },
            { id: "p2", module: "stock", action: "crear" },
          ],
          error: null,
        });
      }
      if (table === "role_permissions") {
        // Actualmente tiene p1 y p3. El formulario marca p1 y p2: hay que
        // agregar p2 y borrar p3.
        return chain(
          { data: [{ permission_id: "p1" }, { permission_id: "p3" }], error: null },
          { insert: insertSpy, delete: deleteSpy },
        );
      }
      return chain({ error: null });
    });

    const formData = new FormData();
    formData.set("name", "Stock");
    formData.set("perm_stock_ver", "on");
    formData.set("perm_stock_crear", "on");

    const result = await updateRole("role-1", { error: null }, formData);

    expect(result.error).toBeNull();
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
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
