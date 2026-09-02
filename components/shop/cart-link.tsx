"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-provider";

export function CartLink() {
  const { count } = useCart();

  return (
    <Link href="/carrito" className="relative flex items-center gap-1 p-2" aria-label="Ver carrito">
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span
          data-testid="cart-count"
          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
