import { describe, it, expect } from "vitest";
import { getDateRangeForFilter } from "./date-ranges";

// "now" fijo: 2026-01-16T15:00:00Z = 2026-01-16 12:00 en Argentina (UTC-3),
// un viernes. Los rangos esperados se calculan a mano en zona Argentina.
const NOW = new Date("2026-01-16T15:00:00.000Z");

describe("getDateRangeForFilter", () => {
  it("devuelve null para 'todas' (sin filtro de fecha)", () => {
    expect(getDateRangeForFilter("todas", NOW)).toBeNull();
  });

  it("'hoy' devuelve el día en curso en horario de Argentina", () => {
    expect(getDateRangeForFilter("hoy", NOW)).toEqual({
      from: "2026-01-16T03:00:00.000Z",
      to: "2026-01-17T03:00:00.000Z",
    });
  });

  it("'ayer' devuelve el día anterior", () => {
    expect(getDateRangeForFilter("ayer", NOW)).toEqual({
      from: "2026-01-15T03:00:00.000Z",
      to: "2026-01-16T03:00:00.000Z",
    });
  });

  it("'esta-semana' va de lunes a la próxima medianoche del lunes siguiente", () => {
    expect(getDateRangeForFilter("esta-semana", NOW)).toEqual({
      from: "2026-01-12T03:00:00.000Z",
      to: "2026-01-19T03:00:00.000Z",
    });
  });

  it("'semana-pasada' es la semana lunes a lunes previa a la actual", () => {
    expect(getDateRangeForFilter("semana-pasada", NOW)).toEqual({
      from: "2026-01-05T03:00:00.000Z",
      to: "2026-01-12T03:00:00.000Z",
    });
  });

  it("'este-mes' va del día 1 del mes en curso al día 1 del mes siguiente", () => {
    expect(getDateRangeForFilter("este-mes", NOW)).toEqual({
      from: "2026-01-01T03:00:00.000Z",
      to: "2026-02-01T03:00:00.000Z",
    });
  });

  it("'mes-pasado' es el mes calendario anterior completo", () => {
    expect(getDateRangeForFilter("mes-pasado", NOW)).toEqual({
      from: "2025-12-01T03:00:00.000Z",
      to: "2026-01-01T03:00:00.000Z",
    });
  });

  it("usa Date.now() por defecto si no se pasa 'now'", () => {
    const range = getDateRangeForFilter("hoy");
    expect(range).not.toBeNull();
  });
});
