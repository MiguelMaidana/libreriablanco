"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-provider";
import { getCartProducts } from "@/lib/shop/cart-products";
import { createOrder, type CheckoutActionState } from "@/app/(shop)/checkout/actions";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShopProduct } from "@/lib/shop/products";

interface CheckoutFormProps {
  whatsappNumber: string | null;
  shippingMessage: string | null;
}

const initialState: CheckoutActionState = { error: null, orderNumber: null };

export function CheckoutForm({ whatsappNumber, shippingMessage }: CheckoutFormProps) {
  const router = useRouter();
  const { items, clear, hydrated } = useCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const redirectedRef = useRef(false);

  useEffect(() => {
    // `clear()` (más abajo) vacía el carrito al confirmar el pedido, lo
    // que dispararía este mismo efecto de nuevo con items.length === 0 —
    // sin este chequeo, redirigiría a /carrito pisando el router.push a
    // /compra-exitosa que se dispara en el otro efecto.
    if (redirectedRef.current) {
      return;
    }
    // El carrito arranca vacío hasta que CartProvider lee localStorage.
    // Sin esperar a `hydrated`, este efecto vería items=[] en el primer
    // render y redirigiría a /carrito incluso con un carrito real.
    if (!hydrated) {
      return;
    }
    if (items.length === 0) {
      router.replace("/carrito");
      return;
    }
    let cancelled = false;
    getCartProducts(items.map((item) => item.productId)).then((result) => {
      if (!cancelled) {
        setProducts(result);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items, router, hydrated]);

  useEffect(() => {
    if (state.orderNumber && !redirectedRef.current) {
      redirectedRef.current = true;
      clear();
      router.push(`/compra-exitosa/${state.orderNumber}`);
    }
  }, [state, clear, router]);

  if (!hydrated || items.length === 0 || !loaded) {
    return <p className="p-8 text-muted-foreground">Cargando...</p>;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return product?.price ? sum + product.price * item.quantity : sum;
  }, 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const product = productById.get(item.productId);
            return (
              <li key={item.productId} className="flex justify-between text-sm">
                <span>
                  {product ? `${product.name} x${item.quantity}` : "Producto no disponible"}
                </span>
                {product?.price && <span>{formatPrice(product.price * item.quantity)}</span>}
              </li>
            );
          })}
        </ul>
        <p className="text-lg font-semibold">Total: {formatPrice(total)}</p>
      </section>

      <p className="text-sm text-muted-foreground">
        Retiro en el local. ¿Necesitás envío? Consultanos por WhatsApp.{" "}
        {whatsappNumber && shippingMessage && (
          <a
            href={buildWhatsAppUrl(whatsappNumber, shippingMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Consultar por WhatsApp
          </a>
        )}
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" name="lastName" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" name="phone" type="tel" />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Confirmando..." : "Confirmar pedido"}
        </Button>
      </form>
    </div>
  );
}
