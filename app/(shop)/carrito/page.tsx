import { CartView } from "@/components/shop/cart-view";
import { getSettings } from "@/lib/shop/settings";

export default async function CartPage() {
  const settings = await getSettings();

  return (
    <CartView
      whatsappNumber={settings?.whatsapp_number ?? null}
      shippingMessage={settings?.whatsapp_shipping_inquiry_template ?? null}
    />
  );
}
