import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderConfirmation } from "./order-confirmation";

const baseProps = {
  orderNumber: "LB-1000",
  total: 2000,
  items: [
    { id: "oi-1", productNameSnapshot: "Cuaderno A4", quantity: 2, unitPrice: 1000, subtotal: 2000 },
  ],
  settings: {
    whatsappNumber: null,
    receiptMessage: null,
    generalMessage: null,
    transferAlias: null,
    transferCbuCvu: null,
    transferBankOrWallet: null,
    transferAccountHolder: null,
    transferInstructions: null,
    address: null,
    businessHours: null,
  },
};

describe("OrderConfirmation", () => {
  it("muestra el número de pedido y el resumen de items", () => {
    render(<OrderConfirmation {...baseProps} />);
    expect(screen.getByText("LB-1000")).toBeInTheDocument();
    expect(screen.getByText(/Cuaderno A4 x2/)).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent("2.000");
  });

  it("no muestra nombre, email ni teléfono del cliente en ningún lado", () => {
    render(<OrderConfirmation {...baseProps} />);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("muestra los datos de transferencia cuando están configurados", () => {
    render(
      <OrderConfirmation
        {...baseProps}
        settings={{
          ...baseProps.settings,
          transferAlias: "libreria.blanco",
          transferCbuCvu: "0000003100012345678901",
        }}
      />,
    );
    expect(screen.getByText(/libreria\.blanco/)).toBeInTheDocument();
    expect(screen.getByText(/0000003100012345678901/)).toBeInTheDocument();
  });

  it("no muestra el botón de WhatsApp si falta el número o el mensaje", () => {
    render(<OrderConfirmation {...baseProps} />);
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
  });

  it("muestra el botón de WhatsApp con el link armado cuando hay número y mensaje", () => {
    render(
      <OrderConfirmation
        {...baseProps}
        settings={{
          ...baseProps.settings,
          whatsappNumber: "5491112345678",
          receiptMessage: "Hola! Te paso el comprobante. Número de pedido: LB-1000.",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: "Enviar comprobante por WhatsApp" });
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me/5491112345678"));
  });

  it("muestra la dirección y el horario cuando están configurados", () => {
    render(
      <OrderConfirmation
        {...baseProps}
        settings={{
          ...baseProps.settings,
          address: "Av. Siempre Viva 742",
          businessHours: "Lunes a viernes de 9 a 18",
        }}
      />,
    );
    expect(screen.getByText("Av. Siempre Viva 742")).toBeInTheDocument();
    expect(screen.getByText("Lunes a viernes de 9 a 18")).toBeInTheDocument();
  });

  it("muestra el botón de consulta general por WhatsApp cuando hay número configurado", () => {
    render(
      <OrderConfirmation
        {...baseProps}
        settings={{ ...baseProps.settings, whatsappNumber: "5491112345678" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Consultar por WhatsApp" })).toBeInTheDocument();
  });
});
