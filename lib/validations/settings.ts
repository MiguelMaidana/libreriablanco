import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : null));

const optionalUrlText = z
  .string()
  .optional()
  .transform((value) => {
    if (!value || value.trim().length === 0) {
      return null;
    }
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  })
  .refine((value) => value === null || z.string().url().safeParse(value).success, {
    message: "La URL no es válida.",
  });

export const settingsSchema = z.object({
  businessName: optionalText,
  address: optionalText,
  businessHours: optionalText,
  phone: optionalText,
  email: optionalText,
  facebookUrl: optionalUrlText,
  instagramUrl: optionalUrlText,
  whatsappNumber: optionalText,
  whatsappGeneralMessage: optionalText,
  whatsappReceiptTemplate: optionalText,
  whatsappShippingInquiryTemplate: optionalText,
  transferAlias: optionalText,
  transferAccountHolder: optionalText,
  transferCbuCvu: optionalText,
  transferBankOrWallet: optionalText,
  transferInstructions: optionalText,
  storeEnabled: z.boolean(),
  heroTitle: optionalText,
  heroText: optionalText,
  heroCtaText: optionalText,
  heroCtaLink: optionalText,
  pickupInstructionsText: optionalText,
});

export type SettingsInput = z.infer<typeof settingsSchema>;
