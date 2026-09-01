import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/productos",
  useSearchParams: () => mockSearchParams,
}));

import { ProductFilters } from "./product-filters";

describe("ProductFilters", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it("muestra las categorías recibidas como opciones", async () => {
    const user = userEvent.setup();
    render(<ProductFilters categories={[{ slug: "escolar", name: "Escolar" }]} />);

    await user.click(screen.getByRole("combobox", { name: /categoría/i }));

    expect(await screen.findByText("Escolar")).toBeInTheDocument();
  });

  it("navega a ?categoria=<slug> al elegir una categoría", async () => {
    const user = userEvent.setup();
    render(<ProductFilters categories={[{ slug: "escolar", name: "Escolar" }]} />);

    await user.click(screen.getByRole("combobox", { name: /categoría/i }));
    await user.click(await screen.findByText("Escolar"));

    expect(mockPush).toHaveBeenCalledWith("/productos?categoria=escolar");
  });

  it("elimina el parámetro al volver al valor por defecto (\"todas\")", async () => {
    mockSearchParams = new URLSearchParams("categoria=escolar");
    const user = userEvent.setup();
    render(<ProductFilters categories={[{ slug: "escolar", name: "Escolar" }]} />);

    await user.click(screen.getByRole("combobox", { name: /categoría/i }));
    await user.click(await screen.findByText("Todas las categorías"));

    expect(mockPush).toHaveBeenCalledWith("/productos");
  });

  it("preserva otros parámetros existentes al cambiar el orden", async () => {
    mockSearchParams = new URLSearchParams("q=cuaderno");
    const user = userEvent.setup();
    render(<ProductFilters categories={[]} />);

    await user.click(screen.getByRole("combobox", { name: /ordenar por/i }));
    await user.click(await screen.findByText("Precio: menor a mayor"));

    expect(mockPush).toHaveBeenCalledWith("/productos?q=cuaderno&orden=precio_asc");
  });
});
