import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

import { sendOrderConfirmationEmail } from "./email";

const baseParams = {
  orderNumber: "LB-1000",
  customerName: "Ana Pérez",
  customerEmail: "ana@example.com",
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

  it("envía un email al cliente con el número de pedido y el total", async () => {
    await sendOrderConfirmationEmail(baseParams);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0]![0];
    expect(call.to).toEqual(["ana@example.com"]);
    expect(call.subject).toContain("LB-1000");
    expect(call.html).toContain("LB-1000");
    expect(call.html).toContain("Cuaderno A4");
    expect(call.html).toContain("Tijera");
  });

  it("escapa HTML en el nombre del cliente y de los productos", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      customerName: "<script>alert(1)</script>",
      items: [{ name: "<b>Producto</b>", quantity: 1, unitPrice: 100, subtotal: 100 }],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;");
    expect(call.html).not.toContain("<b>Producto</b>");
  });

  it("incluye los datos de transferencia y de retiro cuando están configurados", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      settings: {
        ...baseParams.settings,
        transferAlias: "libreria.blanco",
        transferCbuCvu: "0000003100012345678901",
        address: "Murguiondo 4230",
        businessHours: "Lun a Vie 9 a 18",
        pickupInstructions: "Tocar timbre en la puerta lateral.",
      },
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain("libreria.blanco");
    expect(call.html).toContain("0000003100012345678901");
    expect(call.html).toContain("Murguiondo 4230");
    expect(call.html).toContain("Lun a Vie 9 a 18");
    expect(call.html).toContain("Tocar timbre en la puerta lateral.");
  });

  it("no manda una segunda copia si no hay email de notificación configurado", async () => {
    await sendOrderConfirmationEmail(baseParams);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("manda una copia interna cuando hay un email de notificación configurado", async () => {
    await sendOrderConfirmationEmail({
      ...baseParams,
      settings: { ...baseParams.settings, notificationEmail: "libreria@example.com" },
    });

    expect(mockSend).toHaveBeenCalledTimes(2);
    const internalCall = mockSend.mock.calls[1]![0];
    expect(internalCall.to).toEqual(["libreria@example.com"]);
    expect(internalCall.subject).toContain("LB-1000");
  });

  it("no lanza si Resend devuelve un error", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(sendOrderConfirmationEmail(baseParams)).resolves.not.toThrow();
  });

  it("no lanza si Resend rechaza la promesa", async () => {
    mockSend.mockRejectedValue(new Error("network error"));
    await expect(sendOrderConfirmationEmail(baseParams)).resolves.not.toThrow();
  });
});
