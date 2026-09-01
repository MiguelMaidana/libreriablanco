"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";
import { productSchema } from "@/lib/validations/product";

export interface ProductActionState {
  error: string | null;
  productId: string | null;
}

function parseProductForm(formData: FormData) {
  const getValue = (key: string) => formData.get(key) ?? undefined;

  return productSchema.safeParse({
    name: getValue("name"),
    categoryId: getValue("categoryId"),
    shortDescription: getValue("shortDescription"),
    cost: getValue("cost"),
    price: getValue("price"),
    available: formData.get("available") === "on",
    isPublished: formData.get("isPublished") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    isNew: formData.get("isNew") === "on",
    sku: getValue("sku"),
    isbn: getValue("isbn"),
    barcode: getValue("barcode"),
    brand: getValue("brand"),
    author: getValue("author"),
    publisher: getValue("publisher"),
    tags: getValue("tags"),
  });
}

function toRow(input: ReturnType<typeof productSchema.parse>) {
  return {
    name: input.name,
    category_id: input.categoryId,
    short_description: input.shortDescription,
    cost: input.cost,
    price: input.price,
    available: input.available,
    is_published: input.isPublished,
    is_featured: input.isFeatured,
    is_new: input.isNew,
    sku: input.sku,
    isbn: input.isbn,
    barcode: input.barcode,
    brand: input.brand,
    author: input.author,
    publisher: input.publisher,
    tags: input.tags,
  };
}

export async function createProduct(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  return withPermissionAction(
    "productos",
    "crear",
    { error: "No tenés permiso para esta acción.", productId: null },
    async (admin) => {
      const parsed = parseProductForm(formData);
      if (!parsed.success) {
        return {
          error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
          productId: null,
        };
      }

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .insert({ ...toRow(parsed.data), updated_by: admin.id })
        .select("id")
        .single();

      if (error || !data) {
        console.error("createProduct: error inserting product", error);
        return { error: "No pudimos guardar el producto.", productId: null };
      }

      revalidatePath("/admin/productos");
      return { error: null, productId: data.id };
    },
  );
}

export async function updateProduct(
  id: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  return withPermissionAction(
    "productos",
    "editar",
    { error: "No tenés permiso para esta acción.", productId: id },
    async (admin) => {
      const parsed = parseProductForm(formData);
      if (!parsed.success) {
        return {
          error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
          productId: id,
        };
      }

      const supabase = await createClient();
      const { error } = await supabase
        .from("products")
        .update({ ...toRow(parsed.data), updated_by: admin.id })
        .eq("id", id);

      if (error) {
        console.error("updateProduct: error updating product", error);
        return { error: "No pudimos guardar el producto.", productId: id };
      }

      revalidatePath("/admin/productos");
      revalidatePath(`/admin/productos/${id}`);
      return { error: null, productId: id };
    },
  );
}

interface ToggleResult {
  error: string | null;
}

const FORBIDDEN_TOGGLE: ToggleResult = { error: "No tenés permiso para esta acción." };

export async function toggleProductAvailability(
  id: string,
  nextAvailable: boolean,
): Promise<ToggleResult> {
  return withPermissionAction("productos", "editar", FORBIDDEN_TOGGLE, async (admin) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ available: nextAvailable, updated_by: admin.id })
      .eq("id", id);

    if (error) {
      console.error("toggleProductAvailability: error updating product", error);
      return { error: "No pudimos actualizar la disponibilidad." };
    }

    revalidatePath("/admin/productos");
    return { error: null };
  });
}

export async function toggleProductPublished(
  id: string,
  nextPublished: boolean,
): Promise<ToggleResult> {
  return withPermissionAction("productos", "editar", FORBIDDEN_TOGGLE, async (admin) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_published: nextPublished, updated_by: admin.id })
      .eq("id", id);

    if (error) {
      console.error("toggleProductPublished: error updating product", error);
      return { error: "No pudimos actualizar la publicación." };
    }

    revalidatePath("/admin/productos");
    return { error: null };
  });
}

export async function toggleProductFeatured(
  id: string,
  nextFeatured: boolean,
): Promise<ToggleResult> {
  return withPermissionAction("productos", "editar", FORBIDDEN_TOGGLE, async (admin) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_featured: nextFeatured, updated_by: admin.id })
      .eq("id", id);

    if (error) {
      console.error("toggleProductFeatured: error updating product", error);
      return { error: "No pudimos actualizar el destacado." };
    }

    revalidatePath("/admin/productos");
    return { error: null };
  });
}
