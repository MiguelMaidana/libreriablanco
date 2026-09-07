import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ShopProduct } from "@/lib/shop/products";

// A diferencia de checkout-form.test.tsx, este archivo NO mockea
// "./cart-provider": usa el CartProvider real para reproducir la carrera
// de hidratación que el mock de useCart() (con items ya poblados desde el
// primer render) no puede exponer. CartProvider arranca con items=[] y
// solo lee localStorage dentro de un efecto de montaje; como React
// flushea los efectos de los hijos antes que los del padre, el efecto de
// CheckoutForm se ejecuta ANTES de que CartProvider haya leído el
// carrito real. Sin el flag `hydrated`, eso hace que CheckoutForm
// redirija a /carrito en cualquier carga dura/nueva pestaña.
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockGetCartProducts = vi.fn();
vi.mock("@/lib/shop/cart-products", () => ({
  getCartProducts: (ids: string[]) => mockGetCartProducts(ids),
}));

const mockCreateOrder = vi.fn();
vi.mock("@/app/(shop)/checkout/actions", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

import { CartProvider } from "./cart-provider";
import { CheckoutForm } from "./checkout-form";

const cuaderno: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1000,
  imageUrl: null,
} as ShopProduct;

describe("CheckoutForm con CartProvider real (hidratación)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockGetCartProducts.mockReset();
    mockCreateOrder.mockReset();
    window.localStorage.clear();
  });

  it("no redirige a /carrito aunque el primer render tenga items=[] antes de leer localStorage", async () => {
    window.localStorage.setItem(
      "lb_cart",
      JSON.stringify([{ productId: "p1", quantity: 1 }]),
    );
    mockGetCartProducts.mockResolvedValue([cuaderno]);

    render(
      <CartProvider>
        <CheckoutForm
          whatsappNumber={null}
          shippingMessage={null}
          address={null}
          businessHours={null}
          pickupInstructions={null}
        />
      </CartProvider>,
    );

    // El carrito real (desde localStorage) termina renderizando el resumen.
    await screen.findByText(/Cuaderno A4/);

    // Nunca debe haber redirigido a /carrito, ni siquiera transitoriamente
    // en el primer render con items=[] previo a la hidratación.
    expect(mockReplace).not.toHaveBeenCalledWith("/carrito");
  });
});
