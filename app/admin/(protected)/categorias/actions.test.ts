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

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

import { createCategory, toggleCategoryActive } from "./actions";

describe("createCategory", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("devuelve error de validación si falta el nombre", async () => {
    mockAdminAllowed();

    const result = await createCategory(
      { error: null },
      formData({ name: "", isFeatured: "", isActive: "on" }),
    );

    expect(result.error).toBe("Revisá los datos ingresados.");
  });

  it("genera un slug único y crea la categoría", async () => {
    mockAdminAllowed();

    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      insert,
    });

    const result = await createCategory(
      { error: null },
      formData({ name: "Papelería", isFeatured: "on", isActive: "on" }),
    );

    expect(result.error).toBeNull();
    expect(insert).toHaveBeenCalledWith({
      name: "Papelería",
      slug: "papeleria",
      is_featured: true,
      is_active: true,
    });
  });

  it("agrega un sufijo numérico si el slug ya existe", async () => {
    mockAdminAllowed();

    let call = 0;
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => {
        call += 1;
        return call === 1 ? { data: { id: "existing" }, error: null } : { data: null, error: null };
      }),
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      insert,
    });

    await createCategory(
      { error: null },
      formData({ name: "Papelería", isFeatured: "", isActive: "on" }),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "papeleria-2" }),
    );
  });
});

describe("toggleCategoryActive", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("actualiza is_active con el valor recibido", async () => {
    mockAdminAllowed();

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await toggleCategoryActive("cat-1", false);

    expect(result.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ is_active: false });
    expect(eq).toHaveBeenCalledWith("id", "cat-1");
  });
});
