"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";
import { settingsSchema } from "@/lib/validations/settings";

export interface SettingsActionState {
  error: string | null;
}

const FORBIDDEN: SettingsActionState = { error: "No tenés permiso para esta acción." };

function parseSettingsForm(formData: FormData) {
  const getValue = (key: string) => formData.get(key) ?? undefined;

  return settingsSchema.safeParse({
    businessName: getValue("businessName"),
    address: getValue("address"),
    businessHours: getValue("businessHours"),
    phone: getValue("phone"),
    email: getValue("email"),
    facebookUrl: getValue("facebookUrl"),
    instagramUrl: getValue("instagramUrl"),
    whatsappNumber: getValue("whatsappNumber"),
    whatsappGeneralMessage: getValue("whatsappGeneralMessage"),
    whatsappReceiptTemplate: getValue("whatsappReceiptTemplate"),
    whatsappShippingInquiryTemplate: getValue("whatsappShippingInquiryTemplate"),
    transferAlias: getValue("transferAlias"),
    transferAccountHolder: getValue("transferAccountHolder"),
    transferCbuCvu: getValue("transferCbuCvu"),
    transferBankOrWallet: getValue("transferBankOrWallet"),
    transferInstructions: getValue("transferInstructions"),
    storeEnabled: formData.get("storeEnabled") === "on",
    heroTitle: getValue("heroTitle"),
    heroText: getValue("heroText"),
    heroCtaText: getValue("heroCtaText"),
    heroCtaLink: getValue("heroCtaLink"),
    pickupInstructionsText: getValue("pickupInstructionsText"),
  });
}

function toRow(input: ReturnType<typeof settingsSchema.parse>) {
  return {
    business_name: input.businessName,
    address: input.address,
    business_hours: input.businessHours,
    phone: input.phone,
    email: input.email,
    facebook_url: input.facebookUrl,
    instagram_url: input.instagramUrl,
    whatsapp_number: input.whatsappNumber,
    whatsapp_general_message: input.whatsappGeneralMessage,
    whatsapp_receipt_template: input.whatsappReceiptTemplate,
    whatsapp_shipping_inquiry_template: input.whatsappShippingInquiryTemplate,
    transfer_alias: input.transferAlias,
    transfer_account_holder: input.transferAccountHolder,
    transfer_cbu_cvu: input.transferCbuCvu,
    transfer_bank_or_wallet: input.transferBankOrWallet,
    transfer_instructions: input.transferInstructions,
    store_enabled: input.storeEnabled,
    hero_title: input.heroTitle,
    hero_text: input.heroText,
    hero_cta_text: input.heroCtaText,
    hero_cta_link: input.heroCtaLink,
    pickup_instructions_text: input.pickupInstructionsText,
  };
}

export async function updateSettings(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return withPermissionAction("configuracion", "editar", FORBIDDEN, async () => {
    const parsed = parseSettingsForm(formData);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("settings").update(toRow(parsed.data)).eq("id", 1);

    if (error) {
      console.error("updateSettings: error updating settings", error);
      return { error: "No pudimos guardar la configuración." };
    }

    revalidatePath("/admin/configuracion");
    revalidatePath("/");
    return { error: null };
  });
}
