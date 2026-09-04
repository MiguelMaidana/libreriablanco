import { RoleForm } from "@/components/admin/role-form";

export default function NewRolePage() {
  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Crear rol</h1>
      <RoleForm mode="create" />
    </main>
  );
}
