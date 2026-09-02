import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl, buildProductInquiryMessage, buildReceiptMessage } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("arma la URL de wa.me quitando caracteres no numéricos del teléfono", () => {
    const url = buildWhatsAppUrl("+54 9 11 5555-5555", "Hola");
    expect(url).toBe("https://wa.me/5491155555555?text=Hola");
  });

  it("codifica el mensaje correctamente", () => {
    const url = buildWhatsAppUrl("5491155555555", "Hola! ¿Cómo va?");
    expect(url).toContain(encodeURIComponent("Hola! ¿Cómo va?"));
  });
});

describe("buildProductInquiryMessage", () => {
  it("arma un mensaje con el nombre y la URL del producto", () => {
    const message = buildProductInquiryMessage(
      "Cuaderno Rivadavia A4",
      "https://libreriablanco.vercel.app/productos/cuaderno-rivadavia-a4",
    );
    expect(message).toContain("Cuaderno Rivadavia A4");
    expect(message).toContain("https://libreriablanco.vercel.app/productos/cuaderno-rivadavia-a4");
  });
});

describe("buildReceiptMessage", () => {
  it("agrega el número de pedido al final del template", () => {
    const message = buildReceiptMessage("Hola! Te paso el comprobante de mi compra.", "LB-1000");
    expect(message).toBe("Hola! Te paso el comprobante de mi compra. Número de pedido: LB-1000.");
  });
});
