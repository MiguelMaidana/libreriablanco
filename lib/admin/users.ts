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
    if (createError?.message?.toLowerCase().includes("already been registered")) {
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
    await supabase.auth.admin.deleteUser(userId);
    return { error: "No pudimos crear el usuario." };
  }

  const { error: roleError } = await supabase
    .from("admin_profile_roles")
    .insert({ admin_profile_id: userId, role_id: roleId });

  if (roleError) {
    console.error("createAdminUser: error assigning role", roleError);
    await supabase.auth.admin.deleteUser(userId);
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

  const { data: superAdminRole } = await supabase
    .from("roles")
    .select("id")
    .eq("is_super_admin", true)
    .maybeSingle();

  if (!superAdminRole) {
    return false;
  }

  const { data: assignments } = await supabase
    .from("admin_profile_roles")
    .select("admin_profile_id")
    .eq("role_id", superAdminRole.id);

  const superAdminIds = (assignments ?? []).map((row) => row.admin_profile_id);
  if (!superAdminIds.includes(targetUserId)) {
    return false;
  }

  const { count } = await supabase
    .from("admin_profiles")
    .select("id", { count: "exact", head: true })
    .in("id", superAdminIds)
    .eq("is_active", true)
    .neq("id", targetUserId);

  return (count ?? 0) === 0;
}
