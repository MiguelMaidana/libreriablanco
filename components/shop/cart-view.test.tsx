import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProduct } from "@/lib/shop/products";

const mockSetQuantity = vi.fn();
const mockRemoveItem = vi.fn();
let mockItems: { productId: string; quantity: number }[] = [];

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: mockItems,
    count: mockItems.reduce((sum, item) => sum + item.quantity, 0),
    addItem: vi.fn(),
    setQuantity: mockSetQuantity,
    removeItem: mockRemoveItem,
    clear: vi.fn(),
  }),
}));

const mockGetCartProducts = vi.fn();
vi.mock("@/lib/shop/cart-products", () => ({
  getCartProducts: (ids: string[]) => mockGetCartProducts(ids),
}));

import { CartView } from "./cart-view";

const cuaderno: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1000,
  imageUrl: null,
} as ShopProduct;

describe("CartView", () => {
  beforeEach(() => {
    mockSetQuantity.mockReset();
    mockRemoveItem.mockReset();
    mockGetCartProducts.mockReset();
    mockItems = [];
  });

  it("muestra el mensaje de carrito vacío cuando no hay items", async () => {
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView />);
    expect(await screen.findByText("Tu carrito está vacío.")).toBeInTheDocument();
  });

  it("muestra los productos del carrito con su precio y el total", async () => {
    mockItems = [{ productId: "p1", quantity: 2 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView />);
    expect(await screen.findByText("Cuaderno A4")).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent("2.000");
  });

  it("avisa cuando un producto del carrito ya no está disponible", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView />);
    expect(await screen.findByText(/ya no están disponibles/i)).toBeInTheDocument();
  });

  it("quita un item al hacer click en Quitar", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    const user = userEvent.setup();
    render(<CartView />);
    await screen.findByText("Cuaderno A4");
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect(mockRemoveItem).toHaveBeenCalledWith("p1");
  });

  it("deshabilita 'Continuar a checkout' si ningún producto está disponible", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView />);
    await screen.findByText(/ya no están disponibles/i);
    expect(screen.getByRole("button", { name: "Continuar a checkout" })).toBeDisabled();
  });

  it("habilita 'Continuar a checkout' como link cuando hay productos disponibles", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView />);
    await screen.findByText("Cuaderno A4");
    expect(screen.getByRole("link", { name: "Continuar a checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });
});
