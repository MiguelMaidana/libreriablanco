import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

import { getCurrentAdmin, requirePermission, ForbiddenError, withPermission } from "./permissions";

describe("getCurrentAdmin", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("devuelve null si get_my_admin_profile no encuentra perfil", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    const admin = await getCurrentAdmin();
    expect(admin).toBeNull();
  });

  it("devuelve null si el perfil existe pero está inactivo", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({
        data: { id: "u1", full_name: "Inactiva", is_active: false, role_names: [] },
        error: null,
      }),
    });

    const admin = await getCurrentAdmin();
    expect(admin).toBeNull();
  });

  it("devuelve el perfil con roles cuando está activo", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({
        data: { id: "u1", full_name: "María", is_active: true, role_names: ["SUPER_ADMIN"] },
        error: null,
      }),
    });

    const admin = await getCurrentAdmin();
    expect(admin).toEqual({ id: "u1", fullName: "María", roles: ["SUPER_ADMIN"] });
  });

  it("devuelve null y loguea si get_my_admin_profile devuelve un error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: { message: "función no encontrada" } }),
    });

    const admin = await getCurrentAdmin();
    expect(admin).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("lanza ForbiddenError si no hay admin logueado", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    await expect(requirePermission("productos", "ver")).rejects.toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError si has_permission devuelve false", async () => {
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

    await expect(requirePermission("usuarios", "eliminar")).rejects.toThrow(ForbiddenError);
  });

  it("devuelve el admin si has_permission devuelve true", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    const admin = await requirePermission("pedidos", "ver");
    expect(admin.fullName).toBe("Vendedora");
  });

  it("llama a has_permission con el user id, módulo y acción exactos", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    await requirePermission("pedidos", "ver");

    expect(mockRpc).toHaveBeenCalledWith("has_permission", {
      p_user_id: "u1",
      p_module: "pedidos",
      p_action: "ver",
    });
  });
});

describe("withPermission", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("ejecuta la función cuando el permiso está concedido", async () => {
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

    const result = await withPermission("productos", "crear", async (admin) => {
      return `hola ${admin.fullName}`;
    });

    expect(result).toBe("hola Admin");
  });

  it("propaga ForbiddenError sin ejecutar la función cuando el permiso es denegado", async () => {
    const fn = vi.fn();
    mockRpc.mockImplementation((rpcFn: string) => {
      if (rpcFn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Vendedora", is_active: true, role_names: ["Vendedora"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: false, error: null });
    });

    await expect(withPermission("productos", "eliminar", fn)).rejects.toThrow(ForbiddenError);
    expect(fn).not.toHaveBeenCalled();
  });
});
