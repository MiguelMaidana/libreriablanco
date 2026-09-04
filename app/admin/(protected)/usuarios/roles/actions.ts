"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import {
  withSuperAdminAction,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
} from "@/lib/auth/permissions";
import { roleSchema } from "@/lib/validations/role";

export interface RoleActionState {
  error: string | null;
}

const FORBIDDEN_ROLE: RoleActionState = { error: "Solo un super administrador puede hacer esto." };

function parsePermissionKeys(formData: FormData): { module: string; action: string }[] {
  const keys: { module: string; action: string }[] = [];
  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      if (formData.get(`perm_${mod}_${action}`) === "on") {
        keys.push({ module: mod, action });
      }
    }
  }
  return keys;
}

async function getPermissionIds(
  supabase: ReturnType<typeof createServiceClient>,
  keys: { module: string; action: string }[],
): Promise<string[]> {
  if (keys.length === 0) {
    return [];
  }
  const { data: permissions, error } = await supabase.from("permissions").select("id, module, action");
  if (error || !permissions) {
    console.error("getPermissionIds: error fetching permissions catalog", error);
    return [];
  }
  const lookup = new Map(permissions.map((p) => [`${p.module}:${p.action}`, p.id]));
  return keys
    .map((key) => lookup.get(`${key.module}:${key.action}`))
    .filter((id): id is string => Boolean(id));
}

export async function createRole(
  _prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  return withSuperAdminAction(FORBIDDEN_ROLE, async () => {
    const parsed = roleSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const supabase = createServiceClient();

    const { data: role, error: insertError } = await supabase
      .from("roles")
      .insert({ name: parsed.data.name, is_super_admin: false })
      .select("id")
      .single();

    if (insertError || !role) {
      console.error("createRole: error inserting role", insertError);
      return { error: "No pudimos crear el rol." };
    }

    const permissionIds = await getPermissionIds(supabase, parsePermissionKeys(formData));
    if (permissionIds.length > 0) {
      const { error: permError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId })));

      if (permError) {
        console.error("createRole: error inserting role_permissions", permError);
        return { error: "No pudimos guardar los permisos del rol." };
      }
    }

    revalidatePath("/admin/usuarios/roles");
    return { error: null };
  });
}

export async function updateRole(
  id: string,
  _prevState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  return withSuperAdminAction(FORBIDDEN_ROLE, async () => {
    const parsed = roleSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const supabase = createServiceClient();

    const { data: existingRole, error: fetchError } = await supabase
      .from("roles")
      .select("is_super_admin")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingRole) {
      console.error("updateRole: error fetching role", fetchError);
      return { error: "No pudimos guardar los cambios." };
    }

    if (existingRole.is_super_admin) {
      return { error: "El rol SUPER_ADMIN no se puede editar desde acá." };
    }

    const { error: updateError } = await supabase
      .from("roles")
      .update({ name: parsed.data.name })
      .eq("id", id);

    if (updateError) {
      console.error("updateRole: error updating role", updateError);
      return { error: "No pudimos guardar los cambios." };
    }

    const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", id);
    if (deleteError) {
      console.error("updateRole: error clearing role_permissions", deleteError);
      return { error: "No pudimos guardar los permisos del rol." };
    }

    const permissionIds = await getPermissionIds(supabase, parsePermissionKeys(formData));
    if (permissionIds.length > 0) {
      const { error: permError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: id, permission_id: permissionId })));

      if (permError) {
        console.error("updateRole: error inserting role_permissions", permError);
        return { error: "No pudimos guardar los permisos del rol." };
      }
    }

    revalidatePath("/admin/usuarios/roles");
    return { error: null };
  });
}

export async function deleteRole(id: string): Promise<RoleActionState> {
  return withSuperAdminAction(FORBIDDEN_ROLE, async () => {
    const supabase = createServiceClient();

    const { data: existingRole, error: fetchError } = await supabase
      .from("roles")
      .select("is_super_admin")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingRole) {
      console.error("deleteRole: error fetching role", fetchError);
      return { error: "No pudimos borrar el rol." };
    }

    if (existingRole.is_super_admin) {
      return { error: "El rol SUPER_ADMIN no se puede borrar." };
    }

    const { count, error: countError } = await supabase
      .from("admin_profile_roles")
      .select("admin_profile_id", { count: "exact", head: true })
      .eq("role_id", id);

    if (countError) {
      console.error("deleteRole: error counting assigned users", countError);
      return { error: "No pudimos borrar el rol." };
    }

    const assignedCount = count ?? 0;
    if (assignedCount > 0) {
      return {
        error: `Este rol tiene ${assignedCount} usuario${assignedCount === 1 ? "" : "s"} asignado${assignedCount === 1 ? "" : "s"}. Reasignalos antes de borrarlo.`,
      };
    }

    const { error: deleteError } = await supabase.from("roles").delete().eq("id", id);
    if (deleteError) {
      console.error("deleteRole: error deleting role", deleteError);
      return { error: "No pudimos borrar el rol." };
    }

    revalidatePath("/admin/usuarios/roles");
    return { error: null };
  });
}
