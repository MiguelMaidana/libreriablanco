import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/product-form";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Editar producto</h1>
      <ProductForm
        mode="edit"
        categories={categories ?? []}
        initialValues={{
          id: product.id,
          name: product.name,
          categoryId: product.category_id,
          shortDescription: product.short_description ?? undefined,
          cost: product.cost,
          price: product.price,
          available: product.available,
          isPublished: product.is_published,
          isFeatured: product.is_featured,
          isNew: product.is_new,
          sku: product.sku ?? undefined,
          isbn: product.isbn ?? undefined,
          barcode: product.barcode ?? undefined,
          brand: product.brand ?? undefined,
          author: product.author ?? undefined,
          publisher: product.publisher ?? undefined,
          tags: product.tags ?? undefined,
        }}
      />
    </main>
  );
}
