export interface CartItem {
  productId: string;
  quantity: number;
}

const STORAGE_KEY = "lb_cart";

function isCartItem(value: unknown): value is CartItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CartItem).productId === "string" &&
    typeof (value as CartItem).quantity === "number" &&
    (value as CartItem).quantity > 0
  );
}

export function readCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(items: CartItem[], productId: string, quantity: number): CartItem[] {
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    return items.map((item) =>
      item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item,
    );
  }
  return [...items, { productId, quantity }];
}

export function setItemQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] {
  if (quantity <= 0) {
    return removeFromCart(items, productId);
  }
  return items.map((item) => (item.productId === productId ? { ...item, quantity } : item));
}

export function removeFromCart(items: CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.productId !== productId);
}
