import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { getSettings } from "./settings";

describe("getSettings", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("devuelve la fila de settings", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1, hero_title: "Hola" }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    });

    const result = await getSettings();

    expect(result).toEqual({ id: 1, hero_title: "Hola" });
  });

  it("devuelve null y loguea si hay un error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    });

    const result = await getSettings();

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
