import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("muestra el título y texto por defecto cuando settings no tiene datos", () => {
    render(<Hero title={null} text={null} ctaText={null} ctaLink={null} imageUrl={null} />);
    expect(screen.getByText("Todo para volver al cole")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/productos");
  });

  it("muestra el contenido de settings cuando existe", () => {
    render(
      <Hero
        title="Nuevos ingresos"
        text="Mirá lo último"
        ctaText="Ver novedades"
        ctaLink="/productos?orden=novedades"
        imageUrl={null}
      />,
    );
    expect(screen.getByText("Nuevos ingresos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver novedades" })).toHaveAttribute("href", "/productos?orden=novedades");
  });

  it("no renderiza ninguna imagen de fondo cuando hero_image_url es null", () => {
    const { container } = render(<Hero title={null} text={null} ctaText={null} ctaLink={null} imageUrl={null} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("usa hero_image_url como fondo con overlay cuando está configurada", () => {
    const { container } = render(
      <Hero title={null} text={null} ctaText={null} ctaLink={null} imageUrl="https://example.com/hero-banner.png" />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("hero-banner.png"));
  });
});
