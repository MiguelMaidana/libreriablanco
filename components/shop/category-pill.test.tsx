import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryPill } from "./category-pill";

describe("CategoryPill", () => {
  it("enlaza a /categoria/[slug] y muestra el nombre de la categoría", () => {
    render(<CategoryPill name="Cuadernos" slug="cuadernos" />);
    const link = screen.getByRole("link", { name: /Cuadernos/i });
    expect(link).toHaveAttribute("href", "/categoria/cuadernos");
  });

  it("usa un ícono y color distintos para una categoría conocida", () => {
    const { container } = render(<CategoryPill name="Arte" slug="arte" />);
    expect(container.querySelector(".bg-pink-100")).toBeInTheDocument();
  });

  it("no distingue mayúsculas ni espacios extra al matchear el nombre", () => {
    const { container } = render(<CategoryPill name="  ARTE  " slug="arte" />);
    expect(container.querySelector(".bg-pink-100")).toBeInTheDocument();
  });

  it("usa el ícono genérico para una categoría sin mapeo conocido", () => {
    const { container } = render(<CategoryPill name="Categoría inventada" slug="inventada" />);
    expect(container.querySelector(".bg-muted")).toBeInTheDocument();
  });
});
