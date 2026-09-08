"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkoutSchema } from "@/lib/validations/checkout";

export interface CheckoutActionState {
  error: string | null;
  orderNumber: string | null;
}

const UNAVAILABLE_ERROR =
  "Algunos productos de tu carrito ya no están disponibles. Volvé al carrito y revisalo.";
const GENERIC_ERROR = "No pudimos procesar tu pedido. Intentá de nuevo.";

export async function createOrder(
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse({
    firstName: formData.get("firstName") ?? undefined,
    lastName: formData.get("lastName") ?? undefined,
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    items: formData.get("items") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
      orderNumber: null,
    };
  }

  const { firstName, lastName, email, phone, items } = parsed.data;
  const productIds = items.map((item) => item.productId);

  // Precio y disponibilidad SIEMPRE se recalculan acá — nunca se confía
  // en un precio que pudiera venir del formulario/carrito del navegador.
  const supabase = await createClient();
  const { data: currentProducts, error: productsError } = await supabase
    .from("public_products")
    .select("id, price")
    .in("id", productIds);

  if (
    productsError ||
    !currentProducts ||
    currentProducts.length !== productIds.length ||
    currentProducts.some((product) => product.price === null)
  ) {
    return { error: UNAVAILABLE_ERROR, orderNumber: null };
  }

  const priceById = new Map(currentProducts.map((product) => [product.id, product.price as number]));

  const serviceClient = createServiceClient();
  // `cost` no está expuesto en public_products (es información interna)
  // así que hace falta la tabla completa, vía service_role, solo para
  // resolver el snapshot de costo del pedido.
  const { data: fullProducts, error: fullProductsError } = await serviceClient
    .from("products")
    .select("id, name, sku, cost")
    .in("id", productIds);

  if (fullProductsError || !fullProducts || fullProducts.length !== productIds.length) {
    console.error("createOrder: error fetching product cost data", fullProductsError);
    return { error: GENERIC_ERROR, orderNumber: null };
  }
  const fullProductById = new Map(fullProducts.map((product) => [product.id, product]));

  const orderItems = items.map((item) => {
    const fullProduct = fullProductById.get(item.productId)!;
    return {
      product_id: item.productId,
      product_name: fullProduct.name,
      sku: fullProduct.sku,
      unit_cost: fullProduct.cost,
      unit_price: priceById.get(item.productId)!,
      quantity: item.quantity,
    };
  });

  const { data: rpcResult, error: rpcError } = await serviceClient.rpc("create_guest_order", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_phone: phone,
    p_items: orderItems,
  });

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    console.error("createOrder: error creating order", rpcError);
    return { error: GENERIC_ERROR, orderNumber: null };
  }

  return { error: null, orderNumber: rpcResult[0]!.order_number };
}
