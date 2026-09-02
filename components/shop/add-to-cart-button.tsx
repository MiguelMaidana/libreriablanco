"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-provider";

interface AddToCartButtonProps {
  productId: string;
  available: boolean;
}

export function AddToCartButton({ productId, available }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (!available) {
    return (
      <Button type="button" variant="outline" disabled>
        No disponible
      </Button>
    );
  }

  function handleClick() {
    addItem(productId, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick}>
      <ShoppingCart className="size-4" />
      {added ? "Agregado" : "Agregar al carrito"}
    </Button>
  );
}
