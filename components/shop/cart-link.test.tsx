import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let mockCount = 0;

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: [],
    count: mockCount,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }),
}));

import { CartLink } from "./cart-link";

describe("CartLink", () => {
  it("enlaza a /carrito", () => {
    mockCount = 0;
    render(<CartLink />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/carrito");
  });

  it("no muestra contador cuando el carrito está vacío", () => {
    mockCount = 0;
    render(<CartLink />);
    expect(screen.queryByTestId("cart-count")).not.toBeInTheDocument();
  });

  it("muestra la cantidad de items cuando hay productos en el carrito", () => {
    mockCount = 3;
    render(<CartLink />);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("3");
  });
});
