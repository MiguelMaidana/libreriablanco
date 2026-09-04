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

interface PermissionIdsResult {
  permissionIds: string[];
  error: string | null;
}

// Distingue explícitamente "no se marcó ningún checkbox" (formulario vacío
// legítimo: `{ permissionIds: [], error: null }`) de "falló el fetch del
// catálogo de permisos" (`{ permissionIds: [], error: "..." }`). Antes esta
// función devolvía `[]` en ambos casos, lo que dejaba que un fallo
// transitorio de la query se confundiera silenciosamente con "sin permisos".
async function getPermissionIds(
  supabase: ReturnType<typeof createServiceClient>,
  keys: { module: string; action: string }[],
): Promise<PermissionIdsResult> {
  if (keys.length === 0) {
    return { permissionIds: [], error: null };
  }
  const { data: permissions, error } = await supabase.from("permissions").select("id, module, action");
  if (error || !permissions) {
    console.error("getPermissionIds: error fetching permissions catalog", error);
    return { permissionIds: [], error: "No pudimos leer el catálogo de permisos." };
  }
  const lookup = new Map(permissions.map((p) => [`${p.module}:${p.action}`, p.id]));
  const permissionIds = keys
    .map((key) => lookup.get(`${key.module}:${key.action}`))
    .filter((id): id is string => Boolean(id));
  return { permissionIds, error: null };
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

    // Resolvemos los permisos ANTES de crear el rol: si el catálogo falla,
    // no queremos terminar con un rol creado y sin ningún permiso.
    const { permissionIds, error: permissionIdsError } = await getPermissionIds(
      supabase,
      parsePermissionKeys(formData),
    );
    if (permissionIdsError) {
      console.error("createRole: error resolving permission ids", permissionIdsError);
      return { error: "No pudimos guardar los permisos del rol." };
    }

    const { data: role, error: insertError } = await supabase
      .from("roles")
      .insert({ name: parsed.data.name, is_super_admin: false })
      .select("id")
      .single();

    if (insertError || !role) {
      console.error("createRole: error inserting role", insertError);
      return { error: "No pudimos crear el rol." };
    }

    if (permissionIds.length > 0) {
      const { error: permError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId })));

      if (permError) {
        console.error("createRole: error inserting role_permissions", permError);
        // Compensación: el rol ya se creó pero quedó sin permisos. Como
        // `roles.name` tiene unique constraint, dejarlo huérfano hace que un
        // reintento con el mismo nombre choque contra esa constraint sin
        // explicación — mismo patrón que createAdminUser en lib/admin/users.ts.
        const { error: rollbackError } = await supabase.from("roles").delete().eq("id", role.id);
        if (rollbackError) {
          console.error(
            "createRole: compensation delete failed after role_permissions insert error",
            { roleId: role.id, rollbackError },
          );
        }
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

    // 1. Resolvemos los permisos nuevos ANTES de tocar `role_permissions` en
    // absoluto. Si el catálogo falla acá, salimos sin haber borrado nada.
    const { permissionIds: newPermissionIds, error: permissionIdsError } = await getPermissionIds(
      supabase,
      parsePermissionKeys(formData),
    );
    if (permissionIdsError) {
      console.error("updateRole: error resolving permission ids", permissionIdsError);
      return { error: "No pudimos guardar los permisos del rol." };
    }

    const { error: updateError } = await supabase
      .from("roles")
      .update({ name: parsed.data.name })
      .eq("id", id);

    if (updateError) {
      console.error("updateRole: error updating role", updateError);
      return { error: "No pudimos guardar los cambios." };
    }

    // 2. Traemos los permisos que el rol YA tiene asignados hoy.
    const { data: currentPermissionRows, error: currentPermissionsError } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", id);

    if (currentPermissionsError) {
      console.error("updateRole: error fetching current role_permissions", currentPermissionsError);
      return { error: "No pudimos guardar los permisos del rol." };
    }

    const currentPermissionIds = (currentPermissionRows ?? []).map((row) => row.permission_id);
    const currentSet = new Set(currentPermissionIds);
    const newSet = new Set(newPermissionIds);
    // 3. Calculamos qué se agrega y qué se quita comparando ambos conjuntos.
    const toAdd = newPermissionIds.filter((permissionId) => !currentSet.has(permissionId));
    const toRemove = currentPermissionIds.filter((permissionId) => !newSet.has(permissionId));

    // 4. Insertamos los nuevos primero: si esto falla, los permisos viejos
    // siguen intactos — el rol nunca queda con cero permisos por un fallo acá.
    if (toAdd.length > 0) {
      const { error: insertPermError } = await supabase
        .from("role_permissions")
        .insert(toAdd.map((permissionId) => ({ role_id: id, permission_id: permissionId })));

      if (insertPermError) {
        console.error("updateRole: error inserting new role_permissions", insertPermError);
        return { error: "No pudimos guardar los permisos del rol." };
      }
    }

    // 5. Recién ahora borramos los que se desmarcaron, filtrando por id
    // puntual (nunca un delete-todo). En el peor caso, si esto falla,
    // quedan permisos de más — nunca de menos.
    if (toRemove.length > 0) {
      const { error: deletePermError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", id)
        .in("permission_id", toRemove);

      if (deletePermError) {
        console.error("updateRole: error removing role_permissions", deletePermError);
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
