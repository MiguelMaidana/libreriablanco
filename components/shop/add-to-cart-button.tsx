"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-provider";

interface AddToCartButtonProps {
  productId: string;
  productName: string;
  available: boolean;
}

export function AddToCartButton({ productId, productName, available }: AddToCartButtonProps) {
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
    toast.success(`${productName} agregado al carrito`);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick}>
      <ShoppingCart className="size-4" />
      {added ? "Agregado" : "Agregar al carrito"}
    </Button>
  );
}
