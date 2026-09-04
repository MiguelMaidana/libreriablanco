import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleForm } from "@/components/admin/role-form";
import type { PermissionModule, PermissionAction } from "@/lib/auth/permissions";

interface EditRolePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRolePage({ params }: EditRolePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: role } = await supabase
    .from("roles")
    .select("id, name, is_super_admin")
    .eq("id", id)
    .maybeSingle();

  if (!role || role.is_super_admin) {
    notFound();
  }

  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("permissions(module, action)")
    .eq("role_id", id);

  const initialPermissions = (rolePermissions ?? [])
    .map((row) => row.permissions)
    .filter((p): p is { module: PermissionModule; action: PermissionAction } => Boolean(p));

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Editar rol</h1>
      <RoleForm
        mode="edit"
        roleId={role.id}
        initialName={role.name}
        initialPermissions={initialPermissions}
      />
    </main>
  );
}
