import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({
          data: { status: "ok" },
          error: null,
        }),
      }),
    }),
  })),
}));

import { GET } from "./route";

describe("GET /api/healthcheck", () => {
  it("responde 200 con el status de la tabla", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
