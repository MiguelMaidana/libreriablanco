export const ORDER_STATUS_LABEL: Record<string, string> = {
  NEW: "Nuevo",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  NEW: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};

export type OrderFilter = "nuevos" | "finalizados" | "cancelados" | "todos";

export const STATUS_BY_FILTER: Record<Exclude<OrderFilter, "todos">, string> = {
  nuevos: "NEW",
  finalizados: "COMPLETED",
  cancelados: "CANCELLED",
};
