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
