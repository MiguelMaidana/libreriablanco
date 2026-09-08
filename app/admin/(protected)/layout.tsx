import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, getViewPermissions } from "@/lib/auth/permissions";
import { AdminSidebar } from "@/components/admin/sidebar";

const SIDEBAR_MODULES = ["productos", "pedidos", "clientes", "configuracion", "usuarios"] as const;

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/unauthorized");
  }

  const viewPermissions = await getViewPermissions(admin, [...SIDEBAR_MODULES]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar adminName={admin.fullName} viewPermissions={viewPermissions} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
