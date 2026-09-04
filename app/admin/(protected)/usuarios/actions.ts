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

    const supabase = createServiceClient();

    // Chequeamos primero si el rol enviado es el que el usuario ya tiene
    // asignado. `updateUserSchema.roleId` es obligatorio en toda edición
    // (incluso si solo se cambia el nombre), así que esto es lo único que
    // nos dice si el rol realmente está cambiando o si es un reenvío del
    // rol actual.
    const { data: existingAssignment, error: existingAssignmentError } = await supabase
      .from("admin_profile_roles")
      .select("admin_profile_id")
      .eq("admin_profile_id", id)
      .eq("role_id", parsed.data.roleId)
      .maybeSingle();

    if (existingAssignmentError) {
      console.error(
        "updateUser: error checking existing role assignment",
        existingAssignmentError,
      );
      return { error: "No pudimos guardar los cambios." };
    }

    const roleIsChanging = !existingAssignment;

    if (roleIsChanging) {
      // Guard de auto-bloqueo: aunque la UI nunca ofrece SUPER_ADMIN como
      // opción de reasignación hoy, el server action no puede depender solo
      // de eso. Solo lo evaluamos cuando el rol realmente cambia: si el
      // usuario reenvía su mismo rol actual (p. ej. al editar solo el
      // nombre), esto nunca debe dispararse, ni siquiera para el único
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
    if (roleIsChanging) {
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
