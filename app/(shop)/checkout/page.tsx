import { CheckoutForm } from "@/components/shop/checkout-form";
import { getSettings } from "@/lib/shop/settings";

export default async function CheckoutPage() {
  const settings = await getSettings();

  return (
    <CheckoutForm
      whatsappNumber={settings?.whatsapp_number ?? null}
      shippingMessage={settings?.whatsapp_shipping_inquiry_template ?? null}
    />
  );
}
