"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";

const MAX_IMAGES_PER_PRODUCT = 4;
const BUCKET = "product-images";

export interface ImageActionState {
  error: string | null;
}

const FORBIDDEN_IMAGE: ImageActionState = { error: "No tenés permiso para esta acción." };

export async function uploadProductImage(
  productId: string,
  _prevState: ImageActionState,
  formData: FormData,
): Promise<ImageActionState> {
  return withPermissionAction("productos", "editar", FORBIDDEN_IMAGE, async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Elegí una imagen para subir." };
    }

    const supabase = await createClient();

    const { count, error: countError } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    if (countError) {
      console.error("uploadProductImage: error counting images", countError);
      return { error: "No pudimos subir la imagen." };
    }

    const currentCount = count ?? 0;
    if (currentCount >= MAX_IMAGES_PER_PRODUCT) {
      return { error: `Ya tenés el máximo de ${MAX_IMAGES_PER_PRODUCT} imágenes para este producto.` };
    }

    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);

    if (uploadError) {
      console.error("uploadProductImage: error uploading file", uploadError);
      return { error: "No pudimos subir la imagen." };
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: insertError } = await supabase.from("product_images").insert({
      product_id: productId,
      url: publicUrlData.publicUrl,
      position: currentCount,
      is_primary: currentCount === 0,
    });

    if (insertError) {
      console.error("uploadProductImage: error inserting row", insertError);
      return { error: "No pudimos guardar la imagen." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}

export async function deleteProductImage(
  imageId: string,
  productId: string,
): Promise<ImageActionState> {
  return withPermissionAction("productos", "editar", FORBIDDEN_IMAGE, async () => {
    const supabase = await createClient();

    const { data: image, error: fetchError } = await supabase
      .from("product_images")
      .select("url")
      .eq("id", imageId)
      .single();

    if (fetchError || !image) {
      console.error("deleteProductImage: error fetching image", fetchError);
      return { error: "No pudimos eliminar la imagen." };
    }

    const marker = `/${BUCKET}/`;
    const markerIndex = image.url.indexOf(marker);
    const storagePath = markerIndex >= 0 ? image.url.slice(markerIndex + marker.length) : null;

    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }

    const { error: deleteError } = await supabase.from("product_images").delete().eq("id", imageId);

    if (deleteError) {
      console.error("deleteProductImage: error deleting row", deleteError);
      return { error: "No pudimos eliminar la imagen." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}

export async function setPrimaryProductImage(
  productId: string,
  imageId: string,
): Promise<ImageActionState> {
  return withPermissionAction("productos", "editar", FORBIDDEN_IMAGE, async () => {
    const supabase = await createClient();

    const { error: clearError } = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);

    if (clearError) {
      console.error("setPrimaryProductImage: error clearing primary", clearError);
      return { error: "No pudimos actualizar la imagen principal." };
    }

    const { error: setError } = await supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", imageId);

    if (setError) {
      console.error("setPrimaryProductImage: error setting primary", setError);
      return { error: "No pudimos actualizar la imagen principal." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}

export async function reorderProductImage(
  productId: string,
  imageId: string,
  direction: "up" | "down",
): Promise<ImageActionState> {
  return withPermissionAction("productos", "editar", FORBIDDEN_IMAGE, async () => {
    const supabase = await createClient();

    const { data: images, error } = await supabase
      .from("product_images")
      .select("id, position")
      .eq("product_id", productId)
      .order("position", { ascending: true });

    if (error || !images) {
      console.error("reorderProductImage: error fetching images", error);
      return { error: "No pudimos reordenar las imágenes." };
    }

    const index = images.findIndex((img) => img.id === imageId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    if (index === -1 || swapIndex < 0 || swapIndex >= images.length) {
      return { error: null };
    }

    const current = images[index];
    const swap = images[swapIndex];

    if (!current || !swap) {
      return { error: null };
    }

    const { error: firstError } = await supabase
      .from("product_images")
      .update({ position: swap.position })
      .eq("id", current.id);
    const { error: secondError } = await supabase
      .from("product_images")
      .update({ position: current.position })
      .eq("id", swap.id);

    if (firstError || secondError) {
      console.error("reorderProductImage: error swapping positions", firstError ?? secondError);
      return { error: "No pudimos reordenar las imágenes." };
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { error: null };
  });
}
