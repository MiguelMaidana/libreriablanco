import { createClient } from "@/lib/supabase/server";

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

export interface AdminProfile {
  id: string;
  fullName: string;
  roles: string[];
}

export class ForbiddenError extends Error {
  constructor(module: PermissionModule, action: PermissionAction) {
    super(`No autorizado: ${module}:${action}`);
    this.name = "ForbiddenError";
  }
}

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_admin_profile").maybeSingle();

  if (error || !data || !data.is_active) {
    return null;
  }

  return {
    id: data.id,
    fullName: data.full_name,
    roles: data.role_names ?? [],
  };
}

export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<AdminProfile> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new ForbiddenError(module, action);
  }

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_user_id: admin.id,
    p_module: module,
    p_action: action,
  });

  if (!allowed) {
    throw new ForbiddenError(module, action);
  }

  return admin;
}
