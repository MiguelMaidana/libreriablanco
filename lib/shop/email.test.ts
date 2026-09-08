import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

import { sendOrderConfirmationEmail } from "./email";

const baseParams = {
  orderId: "order-uuid-1",
  orderNumber: "LB-1000",
  customerName: "Ana Pérez",
  customerEmail: "ana@example.com",
  customerPhone: "1122334455",
  items: [
    { name: "Cuaderno A4", quantity: 2, unitPrice: 1000, subtotal: 2000 },
    { name: "Tijera", quantity: 1, unitPrice: 500, subtotal: 500 },
  ],
  total: 2500,
  settings: {
    transferAlias: null,
    transferCbuCvu: null,
    transferBankOrWallet: null,
    transferAccountHolder: null,
    transferInstructions: null,
    address: null,
    businessHours: null,
    pickupInstructions: null,
    notificationEmail: null,
  },
};

describe("sendOrderConfirmationEmail", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  // El envío al cliente está desactivado (CUSTOMER_EMAIL_ENABLED = false en
  // email.ts) hasta que se verifique un dominio propio en Resend — sin eso,
  // Resend solo entrega a la casilla de la cuenta, nunca a un cliente real.
  it("no manda nada si no hay email de notificación configurado (envío al cliente desactivado)", async () => {
    await sendOrderConfirmationEmail(baseParams);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("manda solo la copia interna cuando hay un email de notificación configurado", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0]![0];
    expect(call.to).toEqual(["libreria@example.com"]);
    expect(call.subject).toContain("LB-1000");
    expect(call.html).toContain("Recibiste un pedido de Ana Pérez");
    expect(call.html).toContain("LB-1000");
    expect(call.html).toContain("Cuaderno A4");
    expect(call.html).toContain("Tijera");
  });

  it("escapa HTML en el nombre del cliente y de los productos", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      customerName: "<script>alert(1)</script>",
      items: [{ name: "<b>Producto</b>", quantity: 1, unitPrice: 100, subtotal: 100 }],
      settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;");
    expect(call.html).not.toContain("<b>Producto</b>");
  });

  it("incluye los datos de contacto del cliente (nombre, teléfono, email) en la copia interna", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain("Ana Pérez");
    expect(call.html).toContain("1122334455");
    expect(call.html).toContain("ana@example.com");
  });

  it("incluye un botón 'Ir al pedido' con el link al panel admin cuando hay orderId", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain("Ir al pedido");
    expect(call.html).toContain("https://libreriablanco.vercel.app/admin/pedidos/order-uuid-1");
  });

  it("no incluye el botón 'Ir al pedido' cuando no se pudo resolver el orderId", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      orderId: null,
      settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).not.toContain("Ir al pedido");
  });

  it("NO incluye los datos de transferencia ni de retiro en la copia interna (son datos de la propia librería)", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      settings: {
        ...baseParams.settings,
        notificationEmail: "libreria@example.com",
        transferAlias: "libreria.blanco",
        transferCbuCvu: "0000003100012345678901",
        address: "Murguiondo 4230",
        businessHours: "Lun a Vie 9 a 18",
        pickupInstructions: "Tocar timbre en la puerta lateral.",
      },
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).not.toContain("libreria.blanco");
    expect(call.html).not.toContain("0000003100012345678901");
    expect(call.html).not.toContain("Murguiondo 4230");
    expect(call.html).not.toContain("Tocar timbre en la puerta lateral.");
  });

  it("no lanza si Resend devuelve un error", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(
      sendOrderConfirmationEmail({
        ...baseParams,
        settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
      }),
    ).resolves.not.toThrow();
  });

  it("no lanza si Resend rechaza la promesa", async () => {
    mockSend.mockRejectedValue(new Error("network error"));
    await expect(
      sendOrderConfirmationEmail({
        ...baseParams,
        settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
      }),
    ).resolves.not.toThrow();
  });
});
