import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("muestra el título y texto por defecto cuando settings no tiene datos", () => {
    render(<Hero title={null} text={null} ctaText={null} ctaLink={null} />);
    expect(screen.getByText("Todo para volver al cole")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/productos");
  });

  it("muestra el contenido de settings cuando existe", () => {
    render(<Hero title="Nuevos ingresos" text="Mirá lo último" ctaText="Ver novedades" ctaLink="/productos?orden=novedades" />);
    expect(screen.getByText("Nuevos ingresos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver novedades" })).toHaveAttribute("href", "/productos?orden=novedades");
  });
});
