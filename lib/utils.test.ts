import { describe, it, expect } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
  it("convierte a minúsculas y reemplaza espacios por guiones", () => {
    expect(slugify("Papelería Escolar")).toBe("papeleria-escolar");
  });

  it("elimina acentos y diacríticos", () => {
    expect(slugify("Artística")).toBe("artistica");
  });

  it("colapsa espacios múltiples y recorta guiones en los extremos", () => {
    expect(slugify("  Útiles   de Oficina  ")).toBe("utiles-de-oficina");
  });

  it("elimina caracteres que no son letras, números o guiones", () => {
    expect(slugify("Cuadernos & Carpetas (2026)")).toBe("cuadernos-carpetas-2026");
  });
});
