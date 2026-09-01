import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppButton } from "./whatsapp-button";

describe("WhatsAppButton", () => {
  it("no renderiza nada si no hay número de teléfono", () => {
    const { container } = render(<WhatsAppButton phoneNumber={null} message="Hola" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza un link a wa.me con el mensaje codificado", () => {
    render(<WhatsAppButton phoneNumber="5491155555555" message="Hola" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://wa.me/5491155555555?text=Hola");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
