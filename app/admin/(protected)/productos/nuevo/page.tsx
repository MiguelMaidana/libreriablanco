import { createClient } from "@/lib/supabase/server";
import { getViewAccess } from "@/lib/auth/permissions";
import { ProductForm } from "@/components/admin/product-form";
import { ViewGuardMessage } from "@/components/admin/view-guard-message";

export default async function NewProductPage() {
  const { allowed, admin } = await getViewAccess("productos");
  if (!admin) {
    return <ViewGuardMessage title="Agregar producto" message="No pudimos verificar tu sesión." />;
  }
  if (!allowed) {
    return (
      <ViewGuardMessage title="Agregar producto" message="No tenés permiso para ver esta página." />
    );
  }

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Agregar producto</h1>
      <ProductForm mode="create" categories={categories ?? []} />
    </main>
  );
}
