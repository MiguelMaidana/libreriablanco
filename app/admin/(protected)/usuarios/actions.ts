"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { withSuperAdminAction } from "@/lib/auth/permissions";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";
import { createAdminUser, resetAdminPassword, wouldRemoveLastSuperAdmin } from "@/lib/admin/users";

export interface UserActionState {
  error: string | null;
  tempPassword?: string;
}

const FORBIDDEN_USER: UserActionState = { error: "Solo un super administrador puede hacer esto." };

// Defensa en profundidad compartida por createUser/updateUser: el diseño
// exige que `roleId` sea un uuid existente en `roles` con
// `is_super_admin = false`. Zod solo valida el formato uuid, así que acá
// chequeamos contra la base que el rol exista y no sea SUPER_ADMIN.
async function validateAssignableRole(roleId: string): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  const { data: targetRole, error } = await supabase
    .from("roles")
    .select("is_super_admin")
    .eq("id", roleId)
    .maybeSingle();

  if (error) {
    console.error("validateAssignableRole: error fetching role", error);
    return { error: "Elegí un rol válido." };
  }

  if (!targetRole || targetRole.is_super_admin) {
    return { error: "Elegí un rol válido." };
  }

  return { error: null };
}

export async function createUser(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    const parsed = createUserSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      roleId: formData.get("roleId"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    // Defensa en profundidad: Zod solo valida que `roleId` tenga formato
    // uuid. `updateRole`/`deleteRole` ya rechazan explícitamente al rol
    // SUPER_ADMIN; acá cerramos la misma asimetría para que no se pueda
    // asignar SUPER_ADMIN a un usuario nuevo saltando la UI.
    const roleValidation = await validateAssignableRole(parsed.data.roleId);
    if (roleValidation.error) {
      return { error: roleValidation.error };
    }

    const result = await createAdminUser(parsed.data);
    if (result.error) {
      return { error: result.error };
    }

    revalidatePath("/admin/usuarios");
    return { error: null, tempPassword: result.tempPassword };
  });
}

export async function updateUser(
  id: string,
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    const parsed = updateUserSchema.safeParse({
      fullName: formData.get("fullName"),
      roleId: formData.get("roleId"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    // Defensa en profundidad (ver validateAssignableRole): el roleId
    // recibido debe ser un rol existente y no-SUPER_ADMIN.
    const roleValidation = await validateAssignableRole(parsed.data.roleId);
    if (roleValidation.error) {
      return { error: roleValidation.error };
    }

    const supabase = createServiceClient();

    // Traemos TODOS los roles que el usuario tiene asignados hoy. El
    // esquema es many-to-many (aunque esta UI normalmente asigna uno solo),
    // así que no alcanza con chequear si el roleId enviado ya está entre
    // ellos: si el usuario tiene, por ejemplo, [SUPER_ADMIN, Vendedora] y se
    // reasigna a "Vendedora" (que ya tenía), el conjunto SÍ cambia — se va a
    // borrar SUPER_ADMIN más abajo — y el guard de auto-bloqueo debe
    // evaluarse igual.
    const { data: currentAssignments, error: currentAssignmentsError } = await supabase
      .from("admin_profile_roles")
      .select("role_id")
      .eq("admin_profile_id", id);

    if (currentAssignmentsError) {
      console.error(
        "updateUser: error fetching current role assignments",
        currentAssignmentsError,
      );
      return { error: "No pudimos guardar los cambios." };
    }

    const currentRoleIds = (currentAssignments ?? []).map((row) => row.role_id);
    const isOnlyCurrentRole =
      currentRoleIds.length === 1 && currentRoleIds[0] === parsed.data.roleId;
    // El rol "está cambiando" (y por lo tanto hay que evaluar el guard) en
    // cualquier caso salvo que el roleId enviado sea el único rol que el
    // usuario ya tiene — eso cubre tanto "tiene un rol distinto" como
    // "tiene más de un rol, aunque uno de ellos sea el nuevo".
    const roleIsChanging = !isOnlyCurrentRole;
    // Optimización aparte, solo para no chocar contra la primary key
    // compuesta al insertar: si el roleId puntual ya está en el conjunto
    // actual, no hace falta reinsertarlo.
    const needsInsert = !currentRoleIds.includes(parsed.data.roleId);

    if (roleIsChanging) {
      // Guard de auto-bloqueo: aunque la UI nunca ofrece SUPER_ADMIN como
      // opción de reasignación hoy, el server action no puede depender solo
      // de eso. Solo lo evaluamos cuando el rol realmente cambia: si el
      // usuario reenvía su mismo (único) rol actual (p. ej. al editar solo
      // el nombre), esto nunca debe dispararse, ni siquiera para el único
      // SUPER_ADMIN activo.
      const wouldRemove = await wouldRemoveLastSuperAdmin(id);
      if (wouldRemove) {
        return { error: "No podés dejar el sistema sin ningún SUPER_ADMIN activo." };
      }
    }

    const { error: profileError } = await supabase
      .from("admin_profiles")
      .update({ full_name: parsed.data.fullName })
      .eq("id", id);

    if (profileError) {
      console.error("updateUser: error updating admin_profile", profileError);
      return { error: "No pudimos guardar los cambios." };
    }

    // Insertamos el rol nuevo ANTES de borrar los viejos: si algo falla a
    // mitad de camino, el peor caso es que el usuario quede con un rol de
    // más temporalmente (sobre-permiso), nunca con cero roles asignados.
    if (needsInsert) {
      const { error: insertRoleError } = await supabase
        .from("admin_profile_roles")
        .insert({ admin_profile_id: id, role_id: parsed.data.roleId });

      if (insertRoleError) {
        console.error("updateUser: error assigning role", insertRoleError);
        return { error: "No pudimos guardar los cambios." };
      }
    }

    const { error: deleteRoleError } = await supabase
      .from("admin_profile_roles")
      .delete()
      .eq("admin_profile_id", id)
      .neq("role_id", parsed.data.roleId);

    if (deleteRoleError) {
      console.error("updateUser: error clearing old roles", deleteRoleError);
      return { error: "No pudimos guardar los cambios." };
    }

    revalidatePath("/admin/usuarios");
    return { error: null };
  });
}

export async function toggleActive(id: string, nextIsActive: boolean): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    if (!nextIsActive) {
      const wouldRemove = await wouldRemoveLastSuperAdmin(id);
      if (wouldRemove) {
        return { error: "No podés dejar el sistema sin ningún SUPER_ADMIN activo." };
      }
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("admin_profiles")
      .update({ is_active: nextIsActive })
      .eq("id", id);

    if (error) {
      console.error("toggleActive: error updating admin_profile", error);
      return { error: "No pudimos actualizar el usuario." };
    }

    revalidatePath("/admin/usuarios");
    return { error: null };
  });
}

export async function resetPassword(id: string): Promise<UserActionState> {
  return withSuperAdminAction(FORBIDDEN_USER, async () => {
    const result = await resetAdminPassword(id);
    if (result.error) {
      return { error: result.error };
    }
    return { error: null, tempPassword: result.tempPassword };
  });
}
