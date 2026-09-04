import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteRoleButton } from "@/components/admin/delete-role-button";

export default async function RolesPage() {
  const admin = await getCurrentAdmin();
  const isSuperAdmin = admin?.roles.includes("SUPER_ADMIN") ?? false;

  const supabase = await createClient();

  const [{ data: roles, error: rolesError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("roles")
        .select("id, name")
        .eq("is_super_admin", false)
        .order("name", { ascending: true }),
      supabase.from("admin_profile_roles").select("role_id"),
    ]);

  if (rolesError) console.error("RolesPage: error fetching roles", rolesError);
  if (assignmentsError) {
    console.error("RolesPage: error fetching admin_profile_roles", assignmentsError);
  }

  const countByRole = new Map<string, number>();
  for (const row of assignments ?? []) {
    countByRole.set(row.role_id, (countByRole.get(row.role_id) ?? 0) + 1);
  }

  const rows = roles ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Roles</h1>
        {isSuperAdmin && (
          <Button asChild>
            <Link href="/admin/usuarios/roles/nueva">+ Crear rol</Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Todavía no creaste roles.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Usuarios asignados</TableHead>
              {isSuperAdmin && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((role) => (
              <TableRow key={role.id}>
                <TableCell>{role.name}</TableCell>
                <TableCell>{countByRole.get(role.id) ?? 0}</TableCell>
                {isSuperAdmin && (
                  <TableCell className="flex gap-2">
                    <Button variant="outline" asChild>
                      <Link href={`/admin/usuarios/roles/${role.id}`}>Editar</Link>
                    </Button>
                    <DeleteRoleButton roleId={role.id} roleName={role.name} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
