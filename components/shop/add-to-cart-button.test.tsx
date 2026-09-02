import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockAddItem = vi.fn();

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: [],
    count: 0,
    addItem: mockAddItem,
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }),
}));

import { AddToCartButton } from "./add-to-cart-button";

describe("AddToCartButton", () => {
  beforeEach(() => {
    mockAddItem.mockReset();
  });

  it("agrega el producto al carrito al hacer click", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" available />);
    await user.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(mockAddItem).toHaveBeenCalledWith("p1", 1);
  });

  it("muestra 'Agregado' después del click", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" available />);
    await user.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(await screen.findByRole("button", { name: "Agregado" })).toBeInTheDocument();
  });

  it("se deshabilita y no permite agregar si available es false", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" available={false} />);
    const button = screen.getByRole("button", { name: "No disponible" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(mockAddItem).not.toHaveBeenCalled();
  });
});
