import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("es más chico en mobile y más grande en desktop (md:)", () => {
    render(<WhatsAppFloatingButton phoneNumber="5491155555555" message="Hola" />);
    const link = screen.getByRole("link", { name: "Escribinos por WhatsApp" });
    expect(link.className).toContain("h-12");
    expect(link.className).toContain("w-12");
    expect(link.className).toContain("md:h-14");
    expect(link.className).toContain("md:w-14");
  });

  // El botón queda fijo en la misma esquina en toda página — si un campo de
  // formulario (ej. Teléfono en checkout) cae ahí, el botón lo tapa mientras
  // el usuario está escribiendo. Se oculta mientras haya un campo enfocado.
  it("se oculta mientras hay un campo de formulario enfocado en la página", async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Campo de prueba" />
        <WhatsAppFloatingButton phoneNumber="5491155555555" message="Hola" />
      </>,
    );
    const link = screen.getByRole("link", { name: "Escribinos por WhatsApp" });
    expect(link).toHaveAttribute("aria-hidden", "false");

    await user.click(screen.getByLabelText("Campo de prueba"));
    expect(link).toHaveAttribute("aria-hidden", "true");

    await user.tab();
    expect(link).toHaveAttribute("aria-hidden", "false");
  });
});
