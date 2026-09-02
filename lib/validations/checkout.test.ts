import { describe, it, expect } from "vitest";
import { checkoutSchema } from "./checkout";

const validItems = JSON.stringify([{ productId: "p1", quantity: 2 }]);

describe("checkoutSchema", () => {
  it("acepta datos válidos y parsea items a un array tipado", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "1122334455",
      items: validItems,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([{ productId: "p1", quantity: 2 }]);
      expect(result.data.phone).toBe("1122334455");
    }
  });

  it("phone vacío se convierte en null", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "",
      items: validItems,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
    }
  });

  it("rechaza un email inválido", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "no-es-un-email",
      items: validItems,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza items vacíos", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      items: JSON.stringify([]),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza items con JSON inválido", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      items: "esto no es json",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un item con quantity <= 0", () => {
    const result = checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      items: JSON.stringify([{ productId: "p1", quantity: 0 }]),
    });
    expect(result.success).toBe(false);
  });
});
