import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

import { attachPrimaryImages } from "./products";

describe("attachPrimaryImages", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("agrega imageUrl a cada producto según su imagen principal", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ product_id: "p1", url: "https://example.com/a.jpg" }],
      error: null,
    });
    const inFn = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ in: inFn }) });

    const result = await attachPrimaryImages(
      { from: mockFrom } as never,
      [{ id: "p1", name: "Producto 1" } as never, { id: "p2", name: "Producto 2" } as never],
    );

    expect(result[0]).toMatchObject({ id: "p1", imageUrl: "https://example.com/a.jpg" });
    expect(result[1]).toMatchObject({ id: "p2", imageUrl: null });
  });

  it("devuelve la lista con imageUrl null sin consultar la base si no hay productos", async () => {
    const result = await attachPrimaryImages({ from: mockFrom } as never, []);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
