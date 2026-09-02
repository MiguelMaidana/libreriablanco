import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProduct } from "@/lib/shop/products";

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockClear = vi.fn();
let mockItems: { productId: string; quantity: number }[] = [{ productId: "p1", quantity: 1 }];
vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: mockItems,
    count: mockItems.length,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: mockClear,
  }),
}));

const mockGetCartProducts = vi.fn();
vi.mock("@/lib/shop/cart-products", () => ({
  getCartProducts: (ids: string[]) => mockGetCartProducts(ids),
}));

const mockCreateOrder = vi.fn();
vi.mock("@/app/(shop)/checkout/actions", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

import { CheckoutForm } from "./checkout-form";

const cuaderno: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1000,
  imageUrl: null,
} as ShopProduct;

describe("CheckoutForm", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockClear.mockReset();
    mockGetCartProducts.mockReset();
    mockCreateOrder.mockReset();
    mockItems = [{ productId: "p1", quantity: 1 }];
  });

  it("redirige a /carrito si el carrito está vacío", async () => {
    mockItems = [];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    expect(mockReplace).toHaveBeenCalledWith("/carrito");
  });

  it("muestra el resumen y el total", async () => {
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    expect(await screen.findByText(/Cuaderno A4/)).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent("1.000");
  });

  it("muestra el mensaje de error cuando la acción falla", async () => {
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    mockCreateOrder.mockResolvedValue({
      error: "Algunos productos de tu carrito ya no están disponibles. Volvé al carrito y revisalo.",
      orderNumber: null,
    });
    const user = userEvent.setup();
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText(/Cuaderno A4/);

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Confirmar pedido" }));

    expect(await screen.findByText(/ya no están disponibles/i)).toBeInTheDocument();
    expect(mockClear).not.toHaveBeenCalled();
  });

  it("limpia el carrito y redirige a /compra-exitosa en éxito", async () => {
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    mockCreateOrder.mockResolvedValue({ error: null, orderNumber: "LB-1000" });
    const user = userEvent.setup();
    render(<CheckoutForm whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText(/Cuaderno A4/);

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Confirmar pedido" }));

    await vi.waitFor(() => expect(mockClear).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith("/compra-exitosa/LB-1000");
    // El mock de useCart no es reactivo (no vuelve a renderizar cuando
    // clear() muta el estado real del carrito), así que esta aserción no
    // reproduce la condición de carrera del efecto de "carrito vacío";
    // esa protección (el chequeo de redirectedRef.current) se revisa por
    // lectura de código en el task review, no por este test.
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
