"use server";

import { createClient } from "@/lib/supabase/server";
import { attachPrimaryImages, type ShopProduct } from "@/lib/shop/products";

export async function getCartProducts(productIds: string[]): Promise<ShopProduct[]> {
  if (productIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("public_products").select("*").in("id", productIds);

  if (error) {
    console.error("getCartProducts: error fetching products", error);
    return [];
  }

  return attachPrimaryImages(supabase, data ?? []);
}
