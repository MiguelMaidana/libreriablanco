import { createClient } from "@/lib/supabase/server";
import type { PermissionModule, PermissionAction } from "./permission-catalog";

export type { PermissionModule, PermissionAction };
export { PERMISSION_MODULES, PERMISSION_ACTIONS } from "./permission-catalog";

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

  if (error) {
    console.error("getCurrentAdmin: error calling get_my_admin_profile", error);
    return null;
  }

  if (!data || !data.is_active) {
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
  const { data: allowed, error } = await supabase.rpc("has_permission", {
    p_user_id: admin.id,
    p_module: module,
    p_action: action,
  });

  if (error) {
    console.error("requirePermission: error calling has_permission", error);
  }

  if (!allowed) {
    throw new ForbiddenError(module, action);
  }

  return admin;
}

export async function withPermission<T>(
  module: PermissionModule,
  action: PermissionAction,
  fn: (admin: AdminProfile) => Promise<T>,
): Promise<T> {
  const admin = await requirePermission(module, action);
  return fn(admin);
}

export async function withPermissionAction<S extends { error: string | null }>(
  module: PermissionModule,
  action: PermissionAction,
  forbiddenState: S,
  fn: (admin: AdminProfile) => Promise<S>,
): Promise<S> {
  try {
    return await withPermission(module, action, fn);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return forbiddenState;
    }
    throw error;
  }
}

export async function requireSuperAdmin(): Promise<AdminProfile> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    // No hay un module:action único para "no sos SUPER_ADMIN" — se reusa
    // ForbiddenError solo como señal interna para el catch de
    // withSuperAdminAction; su mensaje nunca llega al usuario.
    throw new ForbiddenError("usuarios", "eliminar");
  }

  const supabase = await createClient();
  const { data: isSuperAdmin, error } = await supabase.rpc("is_super_admin", {
    p_user_id: admin.id,
  });

  if (error) {
    console.error("requireSuperAdmin: error calling is_super_admin", error);
  }

  if (!isSuperAdmin) {
    throw new ForbiddenError("usuarios", "eliminar");
  }

  return admin;
}

export async function withSuperAdminAction<S extends { error: string | null }>(
  forbiddenState: S,
  fn: (admin: AdminProfile) => Promise<S>,
): Promise<S> {
  try {
    const admin = await requireSuperAdmin();
    return await fn(admin);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return forbiddenState;
    }
    throw error;
  }
}
