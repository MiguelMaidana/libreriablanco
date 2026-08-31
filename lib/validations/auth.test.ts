import { describe, it, expect } from "vitest";
import { adminLoginSchema } from "./auth";

describe("adminLoginSchema", () => {
  it("acepta un email y password válidos", () => {
    const result = adminLoginSchema.safeParse({
      email: "admin@libreriablanco.com",
      password: "secreto123",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un email mal formado", () => {
    const result = adminLoginSchema.safeParse({
      email: "no-es-un-email",
      password: "secreto123",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un password vacío", () => {
    const result = adminLoginSchema.safeParse({
      email: "admin@libreriablanco.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
