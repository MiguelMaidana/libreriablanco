import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProduct } from "@/lib/shop/products";

const mockSetQuantity = vi.fn();
const mockRemoveItem = vi.fn();
let mockItems: { productId: string; quantity: number }[] = [];

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: mockItems,
    count: mockItems.reduce((sum, item) => sum + item.quantity, 0),
    hydrated: true,
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
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    expect(await screen.findByText("Tu carrito está vacío.")).toBeInTheDocument();
  });

  it("muestra los productos del carrito con su precio y el total", async () => {
    mockItems = [{ productId: "p1", quantity: 2 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    expect(await screen.findByText("Cuaderno A4")).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent("2.000");
  });

  it("avisa cuando un producto del carrito ya no está disponible", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    expect(await screen.findByText(/ya no están disponibles/i)).toBeInTheDocument();
  });

  it("quita un item al hacer click en Quitar", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    const user = userEvent.setup();
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText("Cuaderno A4");
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect(mockRemoveItem).toHaveBeenCalledWith("p1");
  });

  it("deshabilita 'Ir a pagar' si ningún producto está disponible", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText(/ya no están disponibles/i);
    expect(screen.getByRole("button", { name: "Ir a pagar" })).toBeDisabled();
  });

  it("deshabilita 'Ir a pagar' si hay al menos un producto no disponible, aunque otro sí lo esté", async () => {
    // createOrder es todo-o-nada: si dejáramos avanzar a checkout con un
    // item no disponible en el carrito, el pedido completo sería
    // rechazado igual. CartView debe reflejar esa regla, no solo
    // "algo" disponible.
    mockItems = [
      { productId: "p1", quantity: 1 },
      { productId: "p2", quantity: 1 },
    ];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText(/ya no están disponibles/i);
    expect(screen.getByRole("button", { name: "Ir a pagar" })).toBeDisabled();
  });

  it("habilita 'Ir a pagar' como link cuando hay productos disponibles", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText("Cuaderno A4");
    expect(screen.getByRole("link", { name: "Ir a pagar" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });

  it("aumentar la cantidad no reemplaza la lista por el mensaje de carga", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    const { rerender } = render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText("Cuaderno A4");

    const input = screen.getByRole("spinbutton");
    mockGetCartProducts.mockResolvedValueOnce([cuaderno]);
    fireEvent.change(input, { target: { value: "3" } });
    expect(mockSetQuantity).toHaveBeenCalledWith("p1", 3);

    // Simula la re-renderización reactiva que produciría el CartProvider
    // real al aplicar el cambio de cantidad (acá el hook está mockeado,
    // así que forzamos el re-render con el nuevo valor de items).
    mockItems = [{ productId: "p1", quantity: 3 }];
    rerender(<CartView whatsappNumber={null} shippingMessage={null} />);

    expect(screen.queryByText("Cargando carrito...")).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("vaciar el input de cantidad no elimina el item ni deja quantity <= 0", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText("Cuaderno A4");

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });

    expect(mockRemoveItem).not.toHaveBeenCalled();
    expect(mockSetQuantity).toHaveBeenCalledWith("p1", 1);
    expect(mockSetQuantity).not.toHaveBeenCalledWith("p1", 0);
  });

  it("muestra el subtotal por línea", async () => {
    mockItems = [{ productId: "p1", quantity: 2 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText("Cuaderno A4");
    expect(screen.getByText(/Subtotal:/)).toHaveTextContent("2.000");
  });

  it("muestra el link 'Continuar comprando' hacia /productos", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText("Cuaderno A4");
    expect(screen.getByRole("link", { name: "Continuar comprando" })).toHaveAttribute(
      "href",
      "/productos",
    );
  });

  it("muestra el mensaje de retiro sin cargo en el local", async () => {
    mockItems = [{ productId: "p1", quantity: 1 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber={null} shippingMessage={null} />);
    await screen.findByText("Cuaderno A4");
    expect(screen.getByText(/Retiro sin cargo en el local/)).toBeInTheDocument();
  });

  it("arma el link de WhatsApp de envío con el detalle de los productos del carrito", async () => {
    mockItems = [{ productId: "p1", quantity: 2 }];
    mockGetCartProducts.mockResolvedValue([cuaderno]);
    render(<CartView whatsappNumber="5491112345678" shippingMessage="¿Podés hacer envío?" />);
    await screen.findByText("Cuaderno A4");
    const link = screen.getByRole("link", { name: "Consultar por WhatsApp" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("- Cuaderno A4 x 2")),
    );
  });
});
