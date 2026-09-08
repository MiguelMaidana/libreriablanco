"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./cart-provider";
import { getCartProducts } from "@/lib/shop/cart-products";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl, buildShippingInquiryMessage } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShopProduct } from "@/lib/shop/products";

interface CartViewProps {
  whatsappNumber: string | null;
  shippingMessage: string | null;
}

export function CartView({ whatsappNumber, shippingMessage }: CartViewProps) {
  const { items, setQuantity, removeItem, hydrated } = useCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // El carrito arranca vacío hasta que CartProvider lee localStorage;
    // esperar a `hydrated` evita un fetch con items=[] seguido de otro con
    // el carrito real (el flash "cargando" → "vacío" → contenido real).
    if (!hydrated) {
      return;
    }
    // No reiniciamos `loaded` a false acá: una vez que ya se hizo la
    // primera carga, un re-fetch disparado por un cambio de cantidad no
    // debe ocultar la lista completa (eso desmontaría el <Input> de
    // cantidad y le haría perder el foco mientras se tipea).
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
  }, [items, hydrated]);

  if (!loaded) {
    return <p className="p-8 text-muted-foreground">Cargando carrito...</p>;
  }

  if (items.length === 0) {
    return <p className="p-8 text-muted-foreground">Tu carrito está vacío.</p>;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const hasUnavailableItems = items.some((item) => !productById.has(item.productId));

  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return product?.price ? sum + product.price * item.quantity : sum;
  }, 0);

  const shippingInquiryMessage = shippingMessage
    ? buildShippingInquiryMessage(
        shippingMessage,
        items
          .map((item) => {
            const product = productById.get(item.productId);
            return product ? { name: product.name ?? "", quantity: item.quantity } : null;
          })
          .filter((item): item is { name: string; quantity: number } => item !== null),
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Tu carrito</h1>

      {hasUnavailableItems && (
        <p className="rounded border border-destructive p-3 text-sm text-destructive">
          Algunos productos de tu carrito ya no están disponibles. Quitalos del carrito para
          poder continuar.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const product = productById.get(item.productId);
          if (!product) {
            return (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-4 border-b pb-4"
              >
                <p className="text-sm text-muted-foreground">Producto ya no disponible</p>
                <Button type="button" variant="ghost" onClick={() => removeItem(item.productId)}>
                  Quitar
                </Button>
              </li>
            );
          }
          const subtotal = product.price ? product.price * item.quantity : 0;
          return (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-4 border-b pb-4"
            >
              <div className="flex flex-col gap-1">
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(product.price)}</p>
                <p className="text-sm text-muted-foreground">Subtotal: {formatPrice(subtotal)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => {
                    // Un campo vaciado (para retipear) da Number("") === 0, y un
                    // pegado no numérico da NaN — ninguno de los dos debe borrar
                    // el item (eso queda reservado al botón "Quitar").
                    const raw = Number(event.target.value);
                    const next = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
                    setQuantity(item.productId, next);
                  }}
                  className="w-16"
                />
                <Button type="button" variant="ghost" onClick={() => removeItem(item.productId)}>
                  Quitar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xl font-semibold">Total: {formatPrice(total)}</p>

      <p className="text-sm text-muted-foreground">
        Retiro sin cargo en el local. ¿Necesitás envío? Consultanos por WhatsApp.{" "}
        {whatsappNumber && shippingInquiryMessage && (
          <a
            href={buildWhatsAppUrl(whatsappNumber, shippingInquiryMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Consultar por WhatsApp
          </a>
        )}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {!hasUnavailableItems ? (
          <Button asChild>
            <Link href="/checkout">Ir a pagar</Link>
          </Button>
        ) : (
          <Button type="button" disabled>
            Ir a pagar
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/productos">Continuar comprando</Link>
        </Button>
      </div>
    </div>
  );
}
