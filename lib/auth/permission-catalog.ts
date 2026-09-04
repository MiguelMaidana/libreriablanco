export type PermissionModule =
  | "productos"
  | "precios"
  | "stock"
  | "pedidos"
  | "clientes"
  | "facturacion"
  | "usuarios"
  | "configuracion";

export type PermissionAction = "ver" | "crear" | "editar" | "eliminar";

export const PERMISSION_MODULES: PermissionModule[] = [
  "productos",
  "precios",
  "stock",
  "pedidos",
  "clientes",
  "facturacion",
  "usuarios",
  "configuracion",
];

export const PERMISSION_ACTIONS: PermissionAction[] = ["ver", "crear", "editar", "eliminar"];
