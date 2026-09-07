import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./footer";

const baseSettings = {
  businessName: null,
  address: null,
  phone: null,
  businessHours: null,
  facebookUrl: null,
  instagramUrl: null,
};

describe("Footer", () => {
  it("muestra 'Librería Blanco' por defecto cuando no hay nombre configurado", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.getByText("Librería Blanco")).toBeInTheDocument();
  });

  it("muestra el nombre del negocio cuando está configurado", () => {
    render(<Footer settings={{ ...baseSettings, businessName: "Librería Blanco S.R.L." }} />);
    expect(screen.getByText("Librería Blanco S.R.L.")).toBeInTheDocument();
  });

  it("no muestra dirección/horario/teléfono cuando no están cargados", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.queryByText("Murguiondo 123")).not.toBeInTheDocument();
  });

  it("muestra dirección, horario y teléfono cuando están cargados", () => {
    render(
      <Footer
        settings={{
          ...baseSettings,
          address: "Murguiondo 123",
          businessHours: "Lun a Vie 9 a 18hs",
          phone: "1122334455",
        }}
      />,
    );
    expect(screen.getByText("Murguiondo 123")).toBeInTheDocument();
    expect(screen.getByText("Lun a Vie 9 a 18hs")).toBeInTheDocument();
    expect(screen.getByText("1122334455")).toBeInTheDocument();
  });

  it("no muestra iconos de redes sociales cuando no están cargados", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.queryByLabelText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Instagram")).not.toBeInTheDocument();
  });

  it("muestra iconos de redes sociales cuando están cargados", () => {
    render(
      <Footer
        settings={{
          ...baseSettings,
          facebookUrl: "https://facebook.com/libreriablanco",
          instagramUrl: "https://instagram.com/libreriablanco",
        }}
      />,
    );
    expect(screen.getByLabelText("Facebook")).toHaveAttribute("href", "https://facebook.com/libreriablanco");
    expect(screen.getByLabelText("Instagram")).toHaveAttribute("href", "https://instagram.com/libreriablanco");
  });

  it("muestra el copyright y la navegación a productos/carrito", () => {
    render(<Footer settings={baseSettings} />);
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Librería Blanco`))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute("href", "/productos");
    expect(screen.getByRole("link", { name: "Carrito" })).toHaveAttribute("href", "/carrito");
  });
});
