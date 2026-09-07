import { describe, it, expect } from "vitest";
import { settingsSchema } from "./settings";

const validInput = {
  businessName: "Librería Blanco",
  address: "Av. Siempre Viva 123",
  businessHours: "Lun a Vie 9 a 18",
  phone: "1122334455",
  email: "hola@libreriablanco.com",
  facebookUrl: "https://facebook.com/libreriablanco",
  instagramUrl: "https://instagram.com/libreriablanco",
  whatsappNumber: "5491122334455",
  whatsappGeneralMessage: "Hola! Quería hacer una consulta.",
  whatsappReceiptTemplate: "Hola! Te paso el comprobante.",
  whatsappShippingInquiryTemplate: "Hola! Necesito que me envíen el pedido.",
  transferAlias: "libreria.blanco",
  transferAccountHolder: "Librería Blanco SRL",
  transferCbuCvu: "0000003100012345678901",
  transferBankOrWallet: "Banco Nación",
  transferInstructions: "Enviar el comprobante por WhatsApp.",
  storeEnabled: true,
  heroTitle: "Todo para volver al cole",
  heroText: "Encontrá útiles, cuadernos y mucho más.",
  heroCtaText: "Ver productos",
  heroCtaLink: "/productos",
  pickupInstructionsText: "Retirá tu pedido de lunes a sábado.",
};

describe("settingsSchema", () => {
  it("acepta todos los campos completos", () => {
    const result = settingsSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBe("Librería Blanco");
      expect(result.data.storeEnabled).toBe(true);
    }
  });

  it("convierte campos de texto vacíos o solo espacios a null", () => {
    const result = settingsSchema.safeParse({
      ...validInput,
      businessName: "",
      transferAlias: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBeNull();
      expect(result.data.transferAlias).toBeNull();
    }
  });

  it("acepta todos los campos de texto ausentes", () => {
    const result = settingsSchema.safeParse({ storeEnabled: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBeNull();
      expect(result.data.storeEnabled).toBe(false);
    }
  });

  it("rechaza si storeEnabled no es un booleano", () => {
    const result = settingsSchema.safeParse({ ...validInput, storeEnabled: "true" });
    expect(result.success).toBe(false);
  });

  it("acepta y convierte a null los campos de redes sociales", () => {
    const result = settingsSchema.safeParse({ ...validInput, facebookUrl: "", instagramUrl: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.facebookUrl).toBeNull();
      expect(result.data.instagramUrl).toBeNull();
    }
  });
});
