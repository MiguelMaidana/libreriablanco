import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryPill } from "./category-pill";

describe("CategoryPill", () => {
  it("enlaza a /categoria/[slug] y muestra el nombre de la categoría", () => {
    render(<CategoryPill name="Cuadernos" slug="cuadernos" />);
    const link = screen.getByRole("link", { name: /Cuadernos/i });
    expect(link).toHaveAttribute("href", "/categoria/cuadernos");
  });
});
