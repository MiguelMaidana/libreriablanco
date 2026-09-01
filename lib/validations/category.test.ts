import { describe, it, expect } from "vitest";
import { categorySchema } from "./category";

describe("categorySchema", () => {
  it("acepta un nombre válido con flags booleanos", () => {
    const result = categorySchema.safeParse({
      name: "Papelería",
      isFeatured: true,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un nombre vacío", () => {
    const result = categorySchema.safeParse({
      name: "",
      isFeatured: false,
      isActive: true,
    });
    expect(result.success).toBe(false);
  });
});
