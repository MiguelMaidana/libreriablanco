import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockUpdateUserById = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        updateUserById: mockUpdateUserById,
      },
    },
    from: mockFrom,
  })),
}));

import { createAdminUser, resetAdminPassword, wouldRemoveLastSuperAdmin } from "./users";

function chain(result: unknown) {
  const query: Record<string, unknown> = {
    select: () => query,
    eq: () => query,
    in: () => query,
    neq: () => query,
    insert: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return query;
}

describe("createAdminUser", () => {
  beforeEach(() => {
    mockCreateUser.mockReset();
    mockDeleteUser.mockReset();
    mockFrom.mockReset();
  });

  it("crea el usuario, el admin_profile y la asignación de rol", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockFrom.mockImplementation(() => chain({ error: null }));

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBeNull();
    expect(result.tempPassword).toMatch(/^LB-.+!Aa$/);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "laura@test.com", email_confirm: true }),
    );
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("devuelve error de email duplicado sin tocar admin_profiles", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBe("Ya existe un usuario con ese email.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("compensa borrando el auth user si falla el insert de admin_profiles", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "admin_profiles") {
        return chain({ error: { message: "fail" } });
      }
      return chain({ error: null });
    });

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBe("No pudimos crear el usuario.");
    expect(mockDeleteUser).toHaveBeenCalledWith("u1");
  });

  it("compensa borrando el auth user si falla la asignación de rol", async () => {
    mockCreateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "admin_profile_roles") {
        return chain({ error: { message: "fail" } });
      }
      return chain({ error: null });
    });

    const result = await createAdminUser({ fullName: "Laura", email: "laura@test.com", roleId: "r1" });

    expect(result.error).toBe("No pudimos crear el usuario.");
    expect(mockDeleteUser).toHaveBeenCalledWith("u1");
  });
});

describe("resetAdminPassword", () => {
  beforeEach(() => {
    mockUpdateUserById.mockReset();
  });

  it("genera y devuelve una contraseña temporal nueva", async () => {
    mockUpdateUserById.mockResolvedValue({ error: null });

    const result = await resetAdminPassword("u1");

    expect(result.error).toBeNull();
    expect(result.tempPassword).toMatch(/^LB-.+!Aa$/);
    expect(mockUpdateUserById).toHaveBeenCalledWith("u1", {
      password: result.tempPassword,
    });
  });

  it("devuelve error si falla la actualización", async () => {
    mockUpdateUserById.mockResolvedValue({ error: { message: "fail" } });

    const result = await resetAdminPassword("u1");

    expect(result.error).toBe("No pudimos restablecer la contraseña.");
  });
});

describe("wouldRemoveLastSuperAdmin", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("devuelve false si el usuario no tiene rol SUPER_ADMIN", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "super-role" }, error: null });
      }
      if (table === "admin_profile_roles") {
        return chain({ data: [{ admin_profile_id: "otro-user" }], error: null });
      }
      return chain({ count: 0, error: null });
    });

    const result = await wouldRemoveLastSuperAdmin("u1");
    expect(result).toBe(false);
  });

  it("devuelve true si es el único SUPER_ADMIN activo", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "super-role" }, error: null });
      }
      if (table === "admin_profile_roles") {
        return chain({ data: [{ admin_profile_id: "u1" }], error: null });
      }
      return chain({ count: 0, error: null });
    });

    const result = await wouldRemoveLastSuperAdmin("u1");
    expect(result).toBe(true);
  });

  it("devuelve false si es SUPER_ADMIN pero quedan otros activos", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "roles") {
        return chain({ data: { id: "super-role" }, error: null });
      }
      if (table === "admin_profile_roles") {
        return chain({ data: [{ admin_profile_id: "u1" }, { admin_profile_id: "u2" }], error: null });
      }
      return chain({ count: 1, error: null });
    });

    const result = await wouldRemoveLastSuperAdmin("u1");
    expect(result).toBe(false);
  });
});
