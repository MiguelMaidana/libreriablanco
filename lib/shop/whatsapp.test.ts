import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl, buildProductInquiryMessage, buildReceiptMessage, buildShippingInquiryMessage } from "./whatsapp";

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

describe("buildShippingInquiryMessage", () => {
  it("agrega el detalle de un producto al final de la plantilla", () => {
    const message = buildShippingInquiryMessage("¿Podés hacer envío?", [
      { name: "Cuaderno A4", quantity: 2 },
    ]);
    expect(message).toBe("¿Podés hacer envío?\n\n- Cuaderno A4 x 2");
  });

  it("agrega el detalle de varios productos, uno por línea", () => {
    const message = buildShippingInquiryMessage("¿Podés hacer envío?", [
      { name: "Cuaderno A4", quantity: 2 },
      { name: "Lapicera azul", quantity: 1 },
    ]);
    expect(message).toBe("¿Podés hacer envío?\n\n- Cuaderno A4 x 2\n- Lapicera azul x 1");
  });
});
