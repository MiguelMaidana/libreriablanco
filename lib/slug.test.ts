import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

import { uniqueSlug } from "./slug";

describe("uniqueSlug", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("devuelve el slug base si no choca con ninguno existente", async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    const result = await uniqueSlug({ from: mockFrom } as never, "products", "cuaderno-a4");

    expect(result).toBe("cuaderno-a4");
    expect(mockFrom).toHaveBeenCalledWith("products");
  });

  it("agrega un sufijo numérico si el slug base ya existe", async () => {
    let call = 0;
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => {
        call += 1;
        return call === 1 ? { data: { id: "existing" }, error: null } : { data: null, error: null };
      }),
    };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    const result = await uniqueSlug({ from: mockFrom } as never, "products", "cuaderno-a4");

    expect(result).toBe("cuaderno-a4-2");
  });

  it("excluye el propio registro cuando se pasa excludeId", async () => {
    const neq = vi.fn().mockReturnThis();
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      neq,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) });

    await uniqueSlug({ from: mockFrom } as never, "products", "cuaderno-a4", "prod-1");

    expect(neq).toHaveBeenCalledWith("id", "prod-1");
  });
});
