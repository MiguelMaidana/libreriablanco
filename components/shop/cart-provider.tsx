"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  readCart,
  writeCart,
  addToCart,
  setItemQuantity,
  removeFromCart,
  type CartItem,
} from "@/lib/shop/cart";

interface CartContextValue {
  items: CartItem[];
  count: number;
  addItem: (productId: string, quantity: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // El carrito solo existe en el navegador — se lee después del montaje
  // para que el primer render del servidor y del cliente coincidan
  // (ambos arrancan vacíos) y no haya warning de hidratación.
  useEffect(() => {
    setItems(readCart());
  }, []);

  function addItem(productId: string, quantity: number) {
    setItems((current) => {
      const next = addToCart(current, productId, quantity);
      writeCart(next);
      return next;
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setItems((current) => {
      const next = setItemQuantity(current, productId, quantity);
      writeCart(next);
      return next;
    });
  }

  function removeItem(productId: string) {
    setItems((current) => {
      const next = removeFromCart(current, productId);
      writeCart(next);
      return next;
    });
  }

  function clear() {
    setItems([]);
    writeCart([]);
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, addItem, setQuantity, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }
  return context;
}
