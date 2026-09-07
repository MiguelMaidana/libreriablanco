import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/shop/settings";
import { attachPrimaryImages } from "@/lib/shop/products";
import { Hero } from "@/components/shop/hero";
import { CategoryPill } from "@/components/shop/category-pill";
import { ProductCard } from "@/components/shop/product-card";

export default async function HomePage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: categories }, { data: featured }, { data: news }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("display_order", { ascending: true })
      .limit(6),
    supabase
      .from("public_products")
      .select("*")
      .eq("is_featured", true)
      .order("featured_order", { ascending: true })
      .limit(8),
    supabase
      .from("public_products")
      .select("*")
      .eq("is_new", true)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const [featuredWithImages, newsWithImages] = await Promise.all([
    attachPrimaryImages(supabase, featured ?? []),
    attachPrimaryImages(supabase, news ?? []),
  ]);

  return (
    <div className="flex flex-col gap-10 pb-10">
      <Hero
        title={settings?.hero_title ?? null}
        text={settings?.hero_text ?? null}
        ctaText={settings?.hero_cta_text ?? null}
        ctaLink={settings?.hero_cta_link ?? null}
        imageUrl={settings?.hero_image_url ?? null}
      />

      {categories && categories.length > 0 && (
        <section className="mx-auto flex w-full max-w-6xl flex-wrap justify-center gap-3 px-4">
          {categories.map((category) => (
            <CategoryPill key={category.id} name={category.name} slug={category.slug} />
          ))}
        </section>
      )}

      {featuredWithImages.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-semibold">Destacados</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featuredWithImages.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {newsWithImages.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-semibold">Novedades</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {newsWithImages.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
