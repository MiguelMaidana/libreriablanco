import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockServiceFrom = vi.fn();
const { mockCreateAdminUser, mockResetAdminPassword, mockWouldRemoveLastSuperAdmin } = vi.hoisted(
  () => ({
    mockCreateAdminUser: vi.fn(),
    mockResetAdminPassword: vi.fn(),
    mockWouldRemoveLastSuperAdmin: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockServiceFrom })),
}));

vi.mock("@/lib/admin/users", () => ({
  createAdminUser: mockCreateAdminUser,
  resetAdminPassword: mockResetAdminPassword,
  wouldRemoveLastSuperAdmin: mockWouldRemoveLastSuperAdmin,
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
    delete: () => query,
    update: () => query,
    select: () => query,
    eq: () => query,
    neq: () => query,
    insert: async () => result,
    // Por defecto no hay una asignación previa de ese rol: el flujo normal
    // de reasignación pasa por el branch de insert.
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
    ...overrides,
  };
  return query;
}

import { createUser, updateUser, toggleActive, resetPassword } from "./actions";

describe("createUser", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockCreateAdminUser.mockReset();
    mockWouldRemoveLastSuperAdmin.mockReset();
  });

  it("rechaza si no es SUPER_ADMIN", async () => {
    mockNotSuperAdmin();
    const formData = new FormData();
    formData.set("fullName", "Laura");
    formData.set("email", "laura@test.com");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await createUser({ error: null }, formData);

    expect(result.error).toBe("Solo un super administrador puede hacer esto.");
    expect(mockCreateAdminUser).not.toHaveBeenCalled();
  });

  it("valida el email antes de llamar a createAdminUser", async () => {
    mockSuperAdmin();
    const formData = new FormData();
    formData.set("fullName", "Laura");
    formData.set("email", "no-es-un-email");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await createUser({ error: null }, formData);

    expect(result.error).toBe("Ingresá un email válido.");
    expect(mockCreateAdminUser).not.toHaveBeenCalled();
  });

  it("crea el usuario y devuelve la contraseña temporal", async () => {
    mockSuperAdmin();
    mockCreateAdminUser.mockResolvedValue({ error: null, tempPassword: "LB-abc123!Aa" });
    const formData = new FormData();
    formData.set("fullName", "Laura");
    formData.set("email", "laura@test.com");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await createUser({ error: null }, formData);

    expect(result).toEqual({ error: null, tempPassword: "LB-abc123!Aa" });
  });

  it("nunca invoca el guard de auto-bloqueo (no aplica al alta de usuarios)", async () => {
    mockSuperAdmin();
    mockCreateAdminUser.mockResolvedValue({ error: null, tempPassword: "LB-abc123!Aa" });
    const formData = new FormData();
    formData.set("fullName", "Laura");
    formData.set("email", "laura@test.com");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    await createUser({ error: null }, formData);

    expect(mockWouldRemoveLastSuperAdmin).not.toHaveBeenCalled();
  });
});

describe("toggleActive", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockServiceFrom.mockReset();
    mockWouldRemoveLastSuperAdmin.mockReset();
  });

  it("rechaza desactivar al último SUPER_ADMIN", async () => {
    mockSuperAdmin();
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(true);

    const result = await toggleActive("u1", false);

    expect(result.error).toBe("No podés dejar el sistema sin ningún SUPER_ADMIN activo.");
  });

  it("desactiva cuando el guard lo permite", async () => {
    mockSuperAdmin();
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(false);
    mockServiceFrom.mockImplementation(() => chain({ error: null }));

    const result = await toggleActive("u1", false);

    expect(result.error).toBeNull();
  });

  it("reactivar no llama al guard de auto-bloqueo", async () => {
    mockSuperAdmin();
    mockServiceFrom.mockImplementation(() => chain({ error: null }));

    const result = await toggleActive("u1", true);

    expect(result.error).toBeNull();
    expect(mockWouldRemoveLastSuperAdmin).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockResetAdminPassword.mockReset();
  });

  it("rechaza si no es SUPER_ADMIN", async () => {
    mockNotSuperAdmin();

    const result = await resetPassword("u1");

    expect(result.error).toBe("Solo un super administrador puede hacer esto.");
    expect(mockResetAdminPassword).not.toHaveBeenCalled();
  });

  it("devuelve la nueva contraseña temporal", async () => {
    mockSuperAdmin();
    mockResetAdminPassword.mockResolvedValue({ error: null, tempPassword: "LB-xyz789!Aa" });

    const result = await resetPassword("u1");

    expect(result).toEqual({ error: null, tempPassword: "LB-xyz789!Aa" });
  });
});

describe("updateUser", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockServiceFrom.mockReset();
    mockWouldRemoveLastSuperAdmin.mockReset();
  });

  it("actualiza nombre y rol", async () => {
    mockSuperAdmin();
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(false);
    mockServiceFrom.mockImplementation(() => chain({ error: null }));
    const formData = new FormData();
    formData.set("fullName", "Laura Actualizada");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await updateUser("u1", { error: null }, formData);

    expect(result.error).toBeNull();
  });

  it("si el rol ya está asignado, no lo vuelve a insertar", async () => {
    mockSuperAdmin();
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(false);
    const insertSpy = vi.fn(async () => ({ error: null }));
    mockServiceFrom.mockImplementation(() =>
      chain(
        { error: null },
        {
          insert: insertSpy,
          // Ya existe la asignación (admin_profile_id, role_id): el insert
          // debería saltearse para no chocar contra la primary key compuesta.
          maybeSingle: async () => ({ data: { admin_profile_id: "u1" }, error: null }),
        },
      ),
    );
    const formData = new FormData();
    formData.set("fullName", "Laura Actualizada");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await updateUser("u1", { error: null }, formData);

    expect(result.error).toBeNull();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rechaza reasignar el rol si dejaría al sistema sin SUPER_ADMIN activo", async () => {
    mockSuperAdmin();
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(true);
    // El chain por defecto no tiene una asignación previa de ese rol, así
    // que este es un cambio de rol real y el guard debe evaluarse.
    mockServiceFrom.mockImplementation(() => chain({ error: null }));
    const formData = new FormData();
    formData.set("fullName", "Laura Actualizada");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await updateUser("u1", { error: null }, formData);

    expect(result.error).toBe("No podés dejar el sistema sin ningún SUPER_ADMIN activo.");
    expect(mockWouldRemoveLastSuperAdmin).toHaveBeenCalledWith("u1");
  });

  it("edición de solo nombre reenviando el mismo roleId: no rechaza ni llama al guard, ni siquiera para el único SUPER_ADMIN activo", async () => {
    mockSuperAdmin();
    // Si el guard llegara a invocarse acá, la re-revisión anterior ya
    // demostró que dispara falso positivo: lo hacemos devolver `true` a
    // propósito para probar que ni siquiera se llama.
    mockWouldRemoveLastSuperAdmin.mockResolvedValue(true);
    mockServiceFrom.mockImplementation(() =>
      chain(
        { error: null },
        {
          // El usuario ya tiene asignado exactamente ese roleId: el rol no
          // está cambiando, solo el nombre.
          maybeSingle: async () => ({ data: { admin_profile_id: "u1" }, error: null }),
        },
      ),
    );
    const formData = new FormData();
    formData.set("fullName", "Jessica Renombrada");
    formData.set("roleId", "550e8400-e29b-41d4-a716-446655440000");

    const result = await updateUser("u1", { error: null }, formData);

    expect(result.error).toBeNull();
    expect(mockWouldRemoveLastSuperAdmin).not.toHaveBeenCalled();
  });
});
