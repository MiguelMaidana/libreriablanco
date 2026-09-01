import { describe, it, expect } from "vitest";
import { calculateMargin } from "./pricing";

describe("calculateMargin", () => {
  it("calcula ganancia y margen porcentual", () => {
    expect(calculateMargin(1000, 1500)).toEqual({ profit: 500, marginPercent: 33.33 });
  });

  it("devuelve margen 0 cuando el precio es 0", () => {
    expect(calculateMargin(100, 0)).toEqual({ profit: -100, marginPercent: 0 });
  });

  it("calcula ganancia negativa cuando el precio es menor al costo", () => {
    expect(calculateMargin(1000, 800)).toEqual({ profit: -200, marginPercent: -25 });
  });
});
