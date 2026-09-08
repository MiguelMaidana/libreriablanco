import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserDialog } from "@/components/admin/user-dialog";
import { UserRowActions } from "@/components/admin/user-row-actions";

export default async function UsersPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl">Usuarios</h1>
        <p className="text-destructive">No pudimos verificar tu sesión.</p>
      </main>
    );
  }

  const isSuperAdmin = admin.roles.includes("SUPER_ADMIN");
  const sessionClient = await createClient();
  const { data: canView } = await sessionClient.rpc("has_permission", {
    p_user_id: admin.id,
    p_module: "usuarios",
    p_action: "ver",
  });

  if (!canView && !isSuperAdmin) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl">Usuarios</h1>
        <p className="text-destructive">No tenés permiso para ver esta página.</p>
      </main>
    );
  }

  const serviceClient = createServiceClient();

  const [
    { data: profiles, error: profilesError },
    { data: roles, error: rolesError },
    { data: authUsers, error: authError },
  ] = await Promise.all([
    serviceClient
      .from("admin_profiles")
      .select("id, full_name, is_active, admin_profile_roles(roles(id, name))")
      .order("full_name", { ascending: true }),
    serviceClient
      .from("roles")
      .select("id, name")
      .eq("is_super_admin", false)
      .order("name", { ascending: true }),
    serviceClient.auth.admin.listUsers(),
  ]);

  if (profilesError) console.error("UsersPage: error fetching admin_profiles", profilesError);
  if (rolesError) console.error("UsersPage: error fetching roles", rolesError);
  if (authError) console.error("UsersPage: error listing auth users", authError);

  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const roleOptions = roles ?? [];
  // `roleOptions` excluye SUPER_ADMIN por diseño (la query de arriba filtra
  // `is_super_admin = false`). Si el roleId de una fila no aparece acá, es
  // SUPER_ADMIN (o no tiene rol asignado): en ambos casos el <Select> de
  // UserDialog quedaría roto, así que no le ofrecemos "Editar" a esa fila.
  const roleOptionIds = new Set(roleOptions.map((role) => role.id));

  const rows = (profiles ?? []).map((profile) => {
    const assignedRole = profile.admin_profile_roles[0]?.roles ?? null;
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: emailById.get(profile.id) ?? "",
      isActive: profile.is_active,
      roleId: assignedRole?.id ?? "",
      roleName: assignedRole?.name ?? "Sin rol",
    };
  });

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Usuarios y Roles</h1>

      <Tabs value="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios" asChild>
            <Link href="/admin/usuarios">Usuarios</Link>
          </TabsTrigger>
          <TabsTrigger value="roles" asChild>
            <Link href="/admin/usuarios/roles">Roles</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between">
        <h2 className="text-xl">Usuarios</h2>
        {isSuperAdmin && (
          <UserDialog trigger={<Button>+ Crear usuario</Button>} roles={roleOptions} />
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">Todavía no creaste usuarios administrativos.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              {isSuperAdmin && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.fullName}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.roleName}</TableCell>
                <TableCell>{row.isActive ? "Activa" : "Inactiva"}</TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <UserRowActions
                      user={{
                        id: row.id,
                        fullName: row.fullName,
                        email: row.email,
                        roleId: row.roleId,
                        isActive: row.isActive,
                      }}
                      roles={roleOptions}
                      canEditRole={roleOptionIds.has(row.roleId)}
                    />
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
