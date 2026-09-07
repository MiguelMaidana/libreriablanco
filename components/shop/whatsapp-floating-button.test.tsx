import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppFloatingButton } from "./whatsapp-floating-button";

describe("WhatsAppFloatingButton", () => {
  it("no renderiza nada si no hay número de teléfono", () => {
    const { container } = render(<WhatsAppFloatingButton phoneNumber={null} message="Hola" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza un link fijo a wa.me con el mensaje codificado", () => {
    render(<WhatsAppFloatingButton phoneNumber="5491155555555" message="Hola" />);
    const link = screen.getByRole("link", { name: "Escribinos por WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/5491155555555?text=Hola");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
