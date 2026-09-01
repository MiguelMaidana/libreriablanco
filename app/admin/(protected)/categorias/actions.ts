"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";
import { categorySchema } from "@/lib/validations/category";
import { slugify } from "@/lib/utils";

export interface CategoryActionState {
  error: string | null;
}

const FORBIDDEN_CATEGORY: CategoryActionState = { error: "No tenés permiso para esta acción." };

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function uniqueSlug(
  supabase: SupabaseClient,
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (;;) {
    let query = supabase.from("categories").select("id").eq("slug", candidate);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data } = await query.maybeSingle();
    if (!data) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function parseCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    isFeatured: formData.get("isFeatured") === "on",
    isActive: formData.get("isActive") === "on",
  });
}

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  return withPermissionAction("productos", "crear", FORBIDDEN_CATEGORY, async () => {
    const parsed = parseCategoryForm(formData);
    if (!parsed.success) {
      return { error: "Revisá los datos ingresados." };
    }

    const supabase = await createClient();
    const slug = await uniqueSlug(supabase, slugify(parsed.data.name));

    const { error } = await supabase.from("categories").insert({
      name: parsed.data.name,
      slug,
      is_featured: parsed.data.isFeatured,
      is_active: parsed.data.isActive,
    });

    if (error) {
      console.error("createCategory: error inserting category", error);
      return { error: "No pudimos guardar la categoría." };
    }

    revalidatePath("/admin/categorias");
    return { error: null };
  });
}

export async function updateCategory(
  id: string,
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  return withPermissionAction("productos", "editar", FORBIDDEN_CATEGORY, async () => {
    const parsed = parseCategoryForm(formData);
    if (!parsed.success) {
      return { error: "Revisá los datos ingresados." };
    }

    const supabase = await createClient();
    const slug = await uniqueSlug(supabase, slugify(parsed.data.name), id);

    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        slug,
        is_featured: parsed.data.isFeatured,
        is_active: parsed.data.isActive,
      })
      .eq("id", id);

    if (error) {
      console.error("updateCategory: error updating category", error);
      return { error: "No pudimos guardar la categoría." };
    }

    revalidatePath("/admin/categorias");
    return { error: null };
  });
}

export async function toggleCategoryActive(
  id: string,
  nextIsActive: boolean,
): Promise<CategoryActionState> {
  return withPermissionAction("productos", "editar", FORBIDDEN_CATEGORY, async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("categories")
      .update({ is_active: nextIsActive })
      .eq("id", id);

    if (error) {
      console.error("toggleCategoryActive: error updating category", error);
      return { error: "No pudimos actualizar la categoría." };
    }

    revalidatePath("/admin/categorias");
    return { error: null };
  });
}
