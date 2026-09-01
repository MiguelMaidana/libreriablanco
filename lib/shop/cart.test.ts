import { describe, it, expect, beforeEach } from "vitest";
import { readCart, writeCart, addToCart, setItemQuantity, removeFromCart } from "./cart";

describe("cart", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readCart devuelve [] cuando no hay nada guardado", () => {
    expect(readCart()).toEqual([]);
  });

  it("readCart devuelve [] si el JSON guardado está corrupto", () => {
    window.localStorage.setItem("lb_cart", "{esto no es json");
    expect(readCart()).toEqual([]);
  });

  it("readCart ignora entradas con forma inválida", () => {
    window.localStorage.setItem(
      "lb_cart",
      JSON.stringify([{ productId: "p1", quantity: 2 }, { productId: "p2" }, "basura"]),
    );
    expect(readCart()).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("writeCart + readCart hacen roundtrip", () => {
    writeCart([{ productId: "p1", quantity: 3 }]);
    expect(readCart()).toEqual([{ productId: "p1", quantity: 3 }]);
  });

  it("addToCart agrega un producto nuevo", () => {
    const result = addToCart([], "p1", 2);
    expect(result).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("addToCart suma cantidad si el producto ya está", () => {
    const result = addToCart([{ productId: "p1", quantity: 2 }], "p1", 3);
    expect(result).toEqual([{ productId: "p1", quantity: 5 }]);
  });

  it("setItemQuantity cambia la cantidad de un item existente", () => {
    const result = setItemQuantity([{ productId: "p1", quantity: 2 }], "p1", 5);
    expect(result).toEqual([{ productId: "p1", quantity: 5 }]);
  });

  it("setItemQuantity con cantidad <= 0 elimina el item", () => {
    const result = setItemQuantity([{ productId: "p1", quantity: 2 }], "p1", 0);
    expect(result).toEqual([]);
  });

  it("removeFromCart quita el item por id", () => {
    const result = removeFromCart(
      [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      "p1",
    );
    expect(result).toEqual([{ productId: "p2", quantity: 1 }]);
  });
});
