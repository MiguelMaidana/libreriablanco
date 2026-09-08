import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockAddItem = vi.fn();
const { mockToastSuccess } = vi.hoisted(() => ({ mockToastSuccess: vi.fn() }));

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

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess },
}));

import { AddToCartButton } from "./add-to-cart-button";

describe("AddToCartButton", () => {
  beforeEach(() => {
    mockAddItem.mockReset();
    mockToastSuccess.mockReset();
  });

  it("agrega el producto al carrito al hacer click", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" productName="Cuaderno A4" available />);
    await user.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(mockAddItem).toHaveBeenCalledWith("p1", 1);
  });

  it("muestra 'Agregado' después del click", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" productName="Cuaderno A4" available />);
    await user.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(await screen.findByRole("button", { name: "Agregado" })).toBeInTheDocument();
  });

  // El carrito solo se ve como un contador chico en el header — sin un
  // aviso más visible, no queda claro que el click surtió efecto.
  it("muestra un toast de confirmación con el nombre del producto al agregarlo", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" productName="Cuaderno A4" available />);
    await user.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(mockToastSuccess).toHaveBeenCalledWith("Cuaderno A4 agregado al carrito");
  });

  it("se deshabilita y no permite agregar si available es false", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton productId="p1" productName="Cuaderno A4" available={false} />);
    const button = screen.getByRole("button", { name: "No disponible" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
