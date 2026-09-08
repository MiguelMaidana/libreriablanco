// Argentina no tiene horario de verano desde 2009 — UTC-3 fijo, así que
// alcanza con un offset constante en vez de Intl/timeZone para hacer
// aritmética de fechas (ver también lib/shop/format.ts, que sí usa
// Intl porque solo formatea, no calcula límites de rango).
const ARGENTINA_OFFSET_HOURS = -3;
const HOUR_MS = 60 * 60 * 1000;

export type DateFilter =
  | "hoy"
  | "ayer"
  | "esta-semana"
  | "semana-pasada"
  | "este-mes"
  | "mes-pasado"
  | "todas";

export const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "todas", label: "Todas las fechas" },
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "esta-semana", label: "Esta semana" },
  { value: "semana-pasada", label: "Semana pasada" },
  { value: "este-mes", label: "Este mes" },
  { value: "mes-pasado", label: "Mes pasado" },
];

export interface DateRange {
  from: string;
  to: string;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

function argentinaLocalParts(date: Date): LocalDateParts {
  const shifted = new Date(date.getTime() + ARGENTINA_OFFSET_HOURS * HOUR_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

// Instante UTC real que corresponde a la medianoche en Argentina de ese
// año/mes/día (acepta día/mes fuera de rango — Date normaliza, por ej.
// day: 0 da el último día del mes anterior).
function argentinaMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - ARGENTINA_OFFSET_HOURS * HOUR_MS);
}

function toRange(from: Date, to: Date): DateRange {
  return { from: from.toISOString(), to: to.toISOString() };
}

export function getDateRangeForFilter(filter: DateFilter, now: Date = new Date()): DateRange | null {
  if (filter === "todas") {
    return null;
  }

  const { year, month, day, weekday } = argentinaLocalParts(now);

  if (filter === "hoy") {
    return toRange(argentinaMidnightUtc(year, month, day), argentinaMidnightUtc(year, month, day + 1));
  }

  if (filter === "ayer") {
    return toRange(argentinaMidnightUtc(year, month, day - 1), argentinaMidnightUtc(year, month, day));
  }

  if (filter === "esta-semana" || filter === "semana-pasada") {
    // Semana de lunes a domingo. weekday: 0=domingo..6=sábado.
    const daysSinceMonday = (weekday + 6) % 7;
    const mondayThisWeek = day - daysSinceMonday;
    const weeksBack = filter === "semana-pasada" ? 7 : 0;
    const from = argentinaMidnightUtc(year, month, mondayThisWeek - weeksBack);
    const to = argentinaMidnightUtc(year, month, mondayThisWeek - weeksBack + 7);
    return toRange(from, to);
  }

  // este-mes / mes-pasado
  const monthOffset = filter === "mes-pasado" ? -1 : 0;
  const from = argentinaMidnightUtc(year, month + monthOffset, 1);
  const to = argentinaMidnightUtc(year, month + monthOffset + 1, 1);
  return toRange(from, to);
}
