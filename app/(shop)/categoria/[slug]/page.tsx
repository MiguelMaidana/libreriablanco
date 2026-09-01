import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages } from "@/lib/shop/products";
import { ProductCard } from "@/components/shop/product-card";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

// cache() deduplica la consulta dentro del mismo request: generateMetadata
// y el componente de página llaman a getCategory con el mismo slug, y sin
// esto correrían la misma query dos veces.
const getCategory = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id, name")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return category;
});

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  return {
    title: category ? `${category.name} — Librería Blanco` : "Categoría no encontrada — Librería Blanco",
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    notFound();
  }

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("public_products")
    .select("*")
    .eq("category_id", category.id)
    .order("created_at", { ascending: false });

  const productsWithImages = await attachPrimaryImages(supabase, products ?? []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{category.name}</h1>
      {productsWithImages.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay productos en esta categoría.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {productsWithImages.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
