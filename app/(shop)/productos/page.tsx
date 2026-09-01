import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages } from "@/lib/shop/products";
import { resolveSortOption } from "@/lib/shop/sort";
import { ProductCard } from "@/components/shop/product-card";
import { ProductFilters } from "@/components/shop/product-filters";

interface ProductsPageProps {
  searchParams: Promise<{ q?: string; categoria?: string; orden?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { q, categoria, orden } = await searchParams;
  const sort = resolveSortOption(orden);

  const supabase = await createClient();

  const { data: allCategories } = await supabase
    .from("categories")
    .select("slug, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Si viene ?categoria= pero el slug no resuelve a una categoría activa
  // (typo, o se desactivó), no hay que mostrar el catálogo completo sin
  // avisar — eso se ve como un bug para quien filtró. Se corta la consulta
  // y se cae directo al estado vacío.
  let categoryId: string | null = null;
  let categoryNotFound = false;
  if (categoria) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categoria)
      .eq("is_active", true)
      .maybeSingle();
    if (category) {
      categoryId = category.id;
    } else {
      categoryNotFound = true;
    }
  }

  let productsWithImages: Awaited<ReturnType<typeof attachPrimaryImages>> = [];

  if (!categoryNotFound) {
    let query = supabase.from("public_products").select("*");

    if (q) {
      query = query.ilike("name", `%${q}%`);
    }
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    if (sort === "precio_asc") {
      query = query.order("price", { ascending: true });
    } else if (sort === "precio_desc") {
      query = query.order("price", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: products, error } = await query;

    if (error) {
      console.error("ProductsPage: error fetching products", error);
    }

    productsWithImages = await attachPrimaryImages(supabase, products ?? []);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Productos</h1>
      <Suspense>
        <ProductFilters categories={allCategories ?? []} />
      </Suspense>
      {productsWithImages.length === 0 ? (
        <p className="text-muted-foreground">No encontramos productos con esa búsqueda.</p>
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
