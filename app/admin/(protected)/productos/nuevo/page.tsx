import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
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
