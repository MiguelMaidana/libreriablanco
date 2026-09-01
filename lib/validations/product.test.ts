import { describe, it, expect } from "vitest";
import { productSchema } from "./product";

const validInput = {
  name: "Cuaderno Rivadavia A4",
  categoryId: "11111111-1111-1111-1111-111111111111",
  shortDescription: "",
  cost: "1000",
  price: "1500",
  available: true,
  isPublished: true,
  isFeatured: false,
  isNew: false,
  sku: "",
  isbn: "",
  barcode: "",
  brand: "",
  author: "",
  publisher: "",
  tags: "",
};

describe("productSchema", () => {
  it("acepta un producto mínimo válido", () => {
    const result = productSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rechaza si falta el nombre", () => {
    const result = productSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza si falta la categoría", () => {
    const result = productSchema.safeParse({ ...validInput, categoryId: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza costo negativo", () => {
    const result = productSchema.safeParse({ ...validInput, cost: "-10" });
    expect(result.success).toBe(false);
  });

  it("convierte cost y price de string a number", () => {
    const result = productSchema.parse(validInput);
    expect(result.cost).toBe(1000);
    expect(result.price).toBe(1500);
  });

  it("convierte tags separados por coma en un array recortado", () => {
    const result = productSchema.parse({ ...validInput, tags: "escolar, oficina ,  cuadernos" });
    expect(result.tags).toEqual(["escolar", "oficina", "cuadernos"]);
  });
});
