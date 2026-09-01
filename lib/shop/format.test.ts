import { describe, it, expect } from "vitest";
import { formatPrice } from "./format";

// Intl.NumberFormat("es-AR", { style: "currency" }) separa el simbolo del
// monto con un espacio de no separacion (U+00A0), no un espacio normal.
const NBSP = "\u00A0";

describe("formatPrice", () => {
  it("formatea un numero como moneda argentina sin decimales", () => {
    expect(formatPrice(12500)).toBe(`$${NBSP}12.500`);
  });

  it("devuelve un string vacio para null", () => {
    expect(formatPrice(null)).toBe("");
  });

  it("formatea numeros chicos correctamente", () => {
    expect(formatPrice(500)).toBe(`$${NBSP}500`);
  });
});
