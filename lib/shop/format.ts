export function formatPrice(value: number | null): string {
  if (value === null) {
    return "";
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("es-AR", { timeZone: ARGENTINA_TIMEZONE });
}
