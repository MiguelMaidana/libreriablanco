import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type PublicProduct = Database["public"]["Views"]["public_products"]["Row"];

export interface ShopProduct extends PublicProduct {
  imageUrl: string | null;
}

export async function attachPrimaryImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  products: PublicProduct[],
): Promise<ShopProduct[]> {
  const ids = products.map((p) => p.id).filter((id): id is string => id !== null);

  if (ids.length === 0) {
    return products.map((p) => ({ ...p, imageUrl: null }));
  }

  const { data: images, error } = await supabase
    .from("product_images")
    .select("product_id, url")
    .in("product_id", ids)
    .eq("is_primary", true);

  if (error) {
    console.error("attachPrimaryImages: error fetching images", error);
  }

  const imageByProduct = new Map((images ?? []).map((img) => [img.product_id, img.url]));

  return products.map((p) => ({
    ...p,
    imageUrl: p.id ? (imageByProduct.get(p.id) ?? null) : null,
  }));
}
