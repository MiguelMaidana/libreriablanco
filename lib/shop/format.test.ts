import { describe, it, expect } from "vitest";
import { formatPrice, formatDate } from "./format";

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

describe("formatDate", () => {
  it("formatea la fecha en la zona horaria de Argentina, no en UTC", () => {
    // "2026-01-16T01:30:00.000Z" son las 01:30 UTC del 16/1, pero en
    // Argentina (UTC-3) son las 22:30 del día anterior, 15/1. Un
    // formateador que use la zona horaria del servidor (UTC en
    // producción) mostraría 16/1 en lugar de 15/1.
    expect(formatDate("2026-01-16T01:30:00.000Z")).toBe("15/1/2026");
  });
});
