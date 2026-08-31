import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "./client";

describe("createClient (browser)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  it("devuelve un cliente de Supabase utilizable", () => {
    const supabase = createClient();
    expect(typeof supabase.from).toBe("function");
  });
});
