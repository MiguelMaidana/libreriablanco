import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages } from "@/lib/shop/products";
import { buildWhatsAppUrl, buildProductInquiryMessage } from "@/lib/shop/whatsapp";
import { getSettings } from "@/lib/shop/settings";
import { formatPrice } from "@/lib/shop/format";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductCard } from "@/components/shop/product-card";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { Button } from "@/components/ui/button";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

// cache() deduplica la consulta dentro del mismo request — ver la nota
// equivalente en la página de categoría (Tarea 6).
const getProduct = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("public_products").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Producto no encontrado — Librería Blanco" };
  }

  return {
    title: `${product.name} — Librería Blanco`,
    description: product.short_description ?? undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product || !product.id) {
    notFound();
  }

  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: images }, { data: related }] = await Promise.all([
    supabase
      .from("product_images")
      .select("url")
      .eq("product_id", product.id)
      .order("position", { ascending: true }),
    product.category_id
      ? supabase
          .from("public_products")
          .select("*")
          .eq("category_id", product.category_id)
          .neq("id", product.id)
          .limit(4)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const relatedWithImages = await attachPrimaryImages(supabase, related ?? []);

  // El origen se deriva de los headers del request (host + proto) en vez
  // de depender de una env var — evita que el link de WhatsApp quede roto
  // (ruta relativa) si esa variable nunca se configura en producción.
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "libreriablanco.vercel.app";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const productUrl = `${protocol}://${host}/productos/${slug}`;
  const whatsappMessage = buildProductInquiryMessage(product.name ?? "este producto", productUrl);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={(images ?? []).map((img) => img.url)} alt={product.name ?? ""} />
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-2xl font-bold text-primary">{formatPrice(product.price)}</p>
          <p className={product.available ? "text-green-600" : "text-destructive"}>
            {product.available ? "Disponible" : "No disponible"}
          </p>
          <AddToCartButton productId={product.id ?? ""} available={product.available ?? false} />
          {product.full_description && (
            <p className="text-muted-foreground">{product.full_description}</p>
          )}
          {settings?.whatsapp_number && (
            <Button asChild>
              <a
                href={buildWhatsAppUrl(settings.whatsapp_number, whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Consultar por WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>

      {relatedWithImages.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">También te puede interesar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedWithImages.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
