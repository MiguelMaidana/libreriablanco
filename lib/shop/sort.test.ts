import { describe, it, expect } from "vitest";
import { resolveSortOption } from "./sort";

describe("resolveSortOption", () => {
  it("devuelve precio_asc cuando el valor es válido", () => {
    expect(resolveSortOption("precio_asc")).toBe("precio_asc");
  });

  it("devuelve precio_desc cuando el valor es válido", () => {
    expect(resolveSortOption("precio_desc")).toBe("precio_desc");
  });

  it("devuelve relevancia para undefined", () => {
    expect(resolveSortOption(undefined)).toBe("relevancia");
  });

  it("devuelve relevancia para un valor desconocido (no confía en el query param)", () => {
    expect(resolveSortOption("cualquiercosa")).toBe("relevancia");
  });
});
