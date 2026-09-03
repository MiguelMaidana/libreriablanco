"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";

const SETTINGS_IMAGE_BUCKET = "settings-images";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export interface ImageActionState {
  error: string | null;
}

const FORBIDDEN_IMAGE: ImageActionState = { error: "No tenés permiso para esta acción." };

async function uploadSettingsImage(
  field: "logo_url" | "hero_image_url",
  formData: FormData,
): Promise<ImageActionState> {
  return withPermissionAction("configuracion", "editar", FORBIDDEN_IMAGE, async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Elegí una imagen para subir." };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: "Solo se aceptan imágenes JPG, PNG, WEBP o AVIF." };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: "La imagen no puede pesar más de 5MB." };
    }

    const supabase = await createClient();
    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${field}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(SETTINGS_IMAGE_BUCKET).upload(path, file);

    if (uploadError) {
      console.error("uploadSettingsImage: error uploading file", uploadError);
      return { error: "No pudimos subir la imagen." };
    }

    const { data: publicUrlData } = supabase.storage.from(SETTINGS_IMAGE_BUCKET).getPublicUrl(path);

    const updatePayload =
      field === "logo_url"
        ? { logo_url: publicUrlData.publicUrl }
        : { hero_image_url: publicUrlData.publicUrl };

    const { error: updateError } = await supabase.from("settings").update(updatePayload).eq("id", 1);

    if (updateError) {
      console.error("uploadSettingsImage: error updating settings row", updateError);
      return { error: "No pudimos guardar la imagen." };
    }

    revalidatePath("/admin/configuracion");
    revalidatePath("/");
    return { error: null };
  });
}

export async function uploadLogo(
  _prevState: ImageActionState,
  formData: FormData,
): Promise<ImageActionState> {
  return uploadSettingsImage("logo_url", formData);
}

export async function uploadHeroImage(
  _prevState: ImageActionState,
  formData: FormData,
): Promise<ImageActionState> {
  return uploadSettingsImage("hero_image_url", formData);
}
