import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

import {
  getCurrentAdmin,
  getViewAccess,
  getViewPermissions,
  requirePermission,
  requireSuperAdmin,
  ForbiddenError,
  withPermission,
  withPermissionAction,
  withSuperAdminAction,
} from "./permissions";

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

describe("withPermissionAction", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("devuelve forbiddenState cuando el permiso es denegado sin ejecutar fn", async () => {
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

    const forbiddenState = { error: "No tenés permiso." };
    const result = await withPermissionAction("productos", "eliminar", forbiddenState, fn);

    expect(result).toEqual(forbiddenState);
    expect(fn).not.toHaveBeenCalled();
  });

  it("ejecuta fn y devuelve su resultado cuando el permiso está concedido", async () => {
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

    const forbiddenState = { error: "Sin permiso" };
    const result = await withPermissionAction(
      "productos",
      "crear",
      forbiddenState,
      async (_admin) => ({ error: null as string | null }),
    );

    expect(result).toEqual({ error: null });
  });
});

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("lanza ForbiddenError si no hay admin logueado", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    await expect(requireSuperAdmin()).rejects.toThrow(ForbiddenError);
  });

  it("lanza ForbiddenError si is_super_admin devuelve false", async () => {
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

    await expect(requireSuperAdmin()).rejects.toThrow(ForbiddenError);
  });

  it("devuelve el admin si is_super_admin devuelve true", async () => {
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

    const admin = await requireSuperAdmin();
    expect(admin.fullName).toBe("Jessica");
  });

  it("llama a is_super_admin con el user id exacto", async () => {
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

    await requireSuperAdmin();

    expect(mockRpc).toHaveBeenCalledWith("is_super_admin", { p_user_id: "u1" });
  });
});

describe("getViewAccess", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("devuelve allowed:false y admin:null si no hay admin logueado", async () => {
    mockRpc.mockReturnValue({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    const result = await getViewAccess("productos");
    expect(result).toEqual({ allowed: false, admin: null });
  });

  it("devuelve allowed:true sin llamar a has_permission si es SUPER_ADMIN", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Jessica", is_active: true, role_names: ["SUPER_ADMIN"] },
            error: null,
          }),
        };
      }
      throw new Error(`no debería llamarse a ${fn}`);
    });

    const result = await getViewAccess("clientes");
    expect(result.allowed).toBe(true);
    expect(result.admin?.fullName).toBe("Jessica");
  });

  it("consulta has_permission con acción 'ver' para roles no super admin", async () => {
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

    const result = await getViewAccess("pedidos");

    expect(result).toEqual({
      allowed: true,
      admin: { id: "u1", fullName: "Vendedora", roles: ["Vendedora"] },
    });
    expect(mockRpc).toHaveBeenCalledWith("has_permission", {
      p_user_id: "u1",
      p_module: "pedidos",
      p_action: "ver",
    });
  });

  it("devuelve allowed:false si has_permission devuelve false", async () => {
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

    const result = await getViewAccess("configuracion");
    expect(result.allowed).toBe(false);
  });
});

describe("getViewPermissions", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("devuelve true para todos los módulos pedidos si es SUPER_ADMIN, sin llamar a has_permission", async () => {
    const admin = { id: "u1", fullName: "Jessica", roles: ["SUPER_ADMIN"] };

    const result = await getViewPermissions(admin, ["productos", "pedidos", "clientes"]);

    expect(result).toEqual({ productos: true, pedidos: true, clientes: true });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("consulta has_permission por cada módulo pedido para roles no super admin", async () => {
    const admin = { id: "u1", fullName: "Vendedora", roles: ["Vendedora"] };
    mockRpc.mockImplementation((fn: string, args: { p_module: string }) => {
      expect(fn).toBe("has_permission");
      return Promise.resolve({ data: args.p_module === "pedidos", error: null });
    });

    const result = await getViewPermissions(admin, ["productos", "pedidos"]);

    expect(result).toEqual({ productos: false, pedidos: true });
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith("has_permission", {
      p_user_id: "u1",
      p_module: "productos",
      p_action: "ver",
    });
  });
});

describe("withSuperAdminAction", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("devuelve forbiddenState sin ejecutar fn cuando no es super admin", async () => {
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

    const forbiddenState = { error: "Solo un super administrador puede hacer esto." };
    const result = await withSuperAdminAction(forbiddenState, fn);

    expect(result).toEqual(forbiddenState);
    expect(fn).not.toHaveBeenCalled();
  });

  it("ejecuta fn y devuelve su resultado cuando es super admin", async () => {
    mockRpc.mockImplementation((rpcFn: string) => {
      if (rpcFn === "get_my_admin_profile") {
        return {
          maybeSingle: async () => ({
            data: { id: "u1", full_name: "Jessica", is_active: true, role_names: ["SUPER_ADMIN"] },
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: true, error: null });
    });

    const result = await withSuperAdminAction(
      { error: "no debería verse", who: "" },
      async (admin) => ({
        error: null as string | null,
        who: admin.fullName,
      }),
    );

    expect(result).toEqual({ error: null, who: "Jessica" });
  });
});
