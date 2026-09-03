import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc, from: mockFrom })),
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

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

import { updateSettings } from "./actions";

describe("updateSettings", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de permisos si el admin no tiene acceso", async () => {
    mockAdminForbidden();
    const result = await updateSettings({ error: null }, formData({ businessName: "Librería Blanco" }));
    expect(result.error).toBe("No tenés permiso para esta acción.");
  });

  it("actualiza la fila de settings con los campos mapeados a snake_case", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await updateSettings(
      { error: null },
      formData({
        businessName: "Librería Blanco",
        transferAlias: "libreria.blanco",
        storeEnabled: "on",
      }),
    );

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: "Librería Blanco",
        transfer_alias: "libreria.blanco",
        store_enabled: true,
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", 1);
  });

  it("interpreta storeEnabled ausente del form como false", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    await updateSettings({ error: null }, formData({ businessName: "Librería Blanco" }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ store_enabled: false }));
  });

  it("devuelve un error genérico si Supabase falla", async () => {
    mockAdminAllowed();
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await updateSettings({ error: null }, formData({ businessName: "Librería Blanco" }));

    expect(result.error).toBe("No pudimos guardar la configuración.");
  });
});
