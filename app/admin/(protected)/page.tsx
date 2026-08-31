import { getCurrentAdmin } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl">Hola, {admin?.fullName ?? "administradora"}</h1>
      <p className="text-muted-foreground">
        Tu rol: {admin && admin.roles.length > 0 ? admin.roles.join(", ") : "sin rol asignado"}
      </p>
      <form action="/admin/logout" method="post">
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
