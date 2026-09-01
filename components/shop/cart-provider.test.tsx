import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "./cart-provider";

function Probe() {
  const { items, count, addItem, setQuantity, removeItem, clear } = useCart();
  return (
    <div>
      <p data-testid="count">{count}</p>
      <ul>
        {items.map((item) => (
          <li key={item.productId}>{`${item.productId}:${item.quantity}`}</li>
        ))}
      </ul>
      <button onClick={() => addItem("p1", 2)}>add</button>
      <button onClick={() => setQuantity("p1", 5)}>set</button>
      <button onClick={() => removeItem("p1")}>remove</button>
      <button onClick={() => clear()}>clear</button>
    </div>
  );
}

describe("CartProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("arranca con el carrito guardado en localStorage", async () => {
    window.localStorage.setItem("lb_cart", JSON.stringify([{ productId: "p9", quantity: 1 }]));
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    expect(await screen.findByText("p9:1")).toBeInTheDocument();
  });

  it("addItem agrega un producto y persiste en localStorage", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await user.click(screen.getByText("add"));
    expect(await screen.findByText("p1:2")).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("2");
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("lb_cart") ?? "[]")).toEqual([
        { productId: "p1", quantity: 2 },
      ]);
    });
  });

  it("setQuantity y removeItem actualizan el estado", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await user.click(screen.getByText("add"));
    await screen.findByText("p1:2");
    await user.click(screen.getByText("set"));
    expect(await screen.findByText("p1:5")).toBeInTheDocument();
    await user.click(screen.getByText("remove"));
    await waitFor(() => expect(screen.queryByText(/p1:/)).not.toBeInTheDocument());
  });

  it("clear vacía el carrito", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await user.click(screen.getByText("add"));
    await screen.findByText("p1:2");
    await user.click(screen.getByText("clear"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  it("useCart fuera de CartProvider tira un error claro", () => {
    function BadProbe() {
      useCart();
      return null;
    }
    expect(() => render(<BadProbe />)).toThrow("useCart debe usarse dentro de CartProvider");
  });
});
