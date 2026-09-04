import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export interface CreateAdminUserInput {
  fullName: string;
  email: string;
  roleId: string;
}

export interface AdminUserActionResult {
  error: string | null;
  tempPassword?: string;
}

export function generateTempPassword(): string {
  const token = randomBytes(6).toString("hex");
  return `LB-${token}!Aa`;
}

export async function createAdminUser({
  fullName,
  email,
  roleId,
}: CreateAdminUserInput): Promise<AdminUserActionResult> {
  const supabase = createServiceClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    console.error("createAdminUser: error creating auth user", createError);
    // Chequeo primario: GoTrue (auth-js@2.112.4) expone en AuthError.code valores
    // estructurados para este caso ("email_exists" y "user_already_exists" — ver
    // node_modules/@supabase/auth-js/dist/*/lib/error-codes.d.ts). La documentación
    // pública no especifica de forma inequívoca cuál de los dos usa el endpoint
    // admin.createUser vs signUp, así que chequeamos ambos.
    // Fallback: si `code` no viene poblado (versiones viejas de GoTrue self-hosted,
    // o errores que no llegan a completar el round-trip HTTP), caemos al substring
    // del mensaje en inglés como red de seguridad, documentando su fragilidad.
    const duplicateEmailCodes = new Set(["email_exists", "user_already_exists"]);
    const isDuplicateEmail =
      (createError && "code" in createError && duplicateEmailCodes.has((createError as { code?: string }).code ?? "")) ||
      createError?.message?.toLowerCase().includes("already been registered");
    if (isDuplicateEmail) {
      return { error: "Ya existe un usuario con ese email." };
    }
    return { error: "No pudimos crear el usuario." };
  }

  const userId = created.user.id;

  const { error: profileError } = await supabase
    .from("admin_profiles")
    .insert({ id: userId, full_name: fullName, is_active: true });

  if (profileError) {
    console.error("createAdminUser: error inserting admin_profile", profileError);
    const { error: deleteError } = (await supabase.auth.admin.deleteUser(userId)) ?? {};
    if (deleteError) {
      console.error(
        "createAdminUser: compensation deleteUser failed after admin_profile insert error",
        { userId, deleteError },
      );
    }
    return { error: "No pudimos crear el usuario." };
  }

  const { error: roleError } = await supabase
    .from("admin_profile_roles")
    .insert({ admin_profile_id: userId, role_id: roleId });

  if (roleError) {
    console.error("createAdminUser: error assigning role", roleError);
    const { error: deleteError } = (await supabase.auth.admin.deleteUser(userId)) ?? {};
    if (deleteError) {
      console.error(
        "createAdminUser: compensation deleteUser failed after admin_profile_roles insert error",
        { userId, deleteError },
      );
    }
    return { error: "No pudimos crear el usuario." };
  }

  return { error: null, tempPassword };
}

export async function resetAdminPassword(userId: string): Promise<AdminUserActionResult> {
  const supabase = createServiceClient();
  const tempPassword = generateTempPassword();

  const { error } = await supabase.auth.admin.updateUserById(userId, { password: tempPassword });

  if (error) {
    console.error("resetAdminPassword: error updating password", error);
    return { error: "No pudimos restablecer la contraseña." };
  }

  return { error: null, tempPassword };
}

export async function wouldRemoveLastSuperAdmin(targetUserId: string): Promise<boolean> {
  const supabase = createServiceClient();

  // Guard fail-closed: este chequeo existe para evitar quedarnos sin ningún
  // SUPER_ADMIN activo. Si cualquiera de las queries de abajo falla por un
  // error transitorio de la base, no sabemos si es seguro desactivar al
  // usuario — ante la duda, devolvemos `true` (bloqueamos la desactivación
  // en el llamador) en vez de asumir silenciosamente que es seguro.
  const { data: superAdminRole, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("is_super_admin", true)
    .maybeSingle();

  if (roleError) {
    console.error("wouldRemoveLastSuperAdmin: error consultando roles", roleError);
    return true;
  }

  if (!superAdminRole) {
    return false;
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("admin_profile_roles")
    .select("admin_profile_id")
    .eq("role_id", superAdminRole.id);

  if (assignmentsError) {
    console.error(
      "wouldRemoveLastSuperAdmin: error consultando admin_profile_roles",
      assignmentsError,
    );
    return true;
  }

  const superAdminIds = (assignments ?? []).map((row) => row.admin_profile_id);
  if (!superAdminIds.includes(targetUserId)) {
    return false;
  }

  const { count, error: countError } = await supabase
    .from("admin_profiles")
    .select("id", { count: "exact", head: true })
    .in("id", superAdminIds)
    .eq("is_active", true)
    .neq("id", targetUserId);

  if (countError) {
    console.error(
      "wouldRemoveLastSuperAdmin: error contando super admins activos restantes",
      countError,
    );
    return true;
  }

  return (count ?? 0) === 0;
}
