import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { getSettings } from "@/lib/shop/settings";
import { buildReceiptMessage } from "@/lib/shop/whatsapp";
import { OrderConfirmation } from "@/components/shop/order-confirmation";

interface OrderConfirmationPageProps {
  params: Promise<{ orderNumber: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: "Pedido confirmado — Librería Blanco",
    robots: { index: false },
  };
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  const serviceClient = createServiceClient();

  const { data: order } = await serviceClient
    .from("orders")
    .select("id, order_number, total")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const { data: items } = await serviceClient
    .from("order_items")
    .select("id, product_name_snapshot, quantity, unit_price, subtotal")
    .eq("order_id", order.id);

  const settings = await getSettings();
  const receiptMessage = settings?.whatsapp_receipt_template
    ? buildReceiptMessage(settings.whatsapp_receipt_template, order.order_number)
    : null;

  return (
    <OrderConfirmation
      orderNumber={order.order_number}
      total={order.total}
      items={(items ?? []).map((item) => ({
        id: item.id,
        productNameSnapshot: item.product_name_snapshot,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
      }))}
      settings={{
        whatsappNumber: settings?.whatsapp_number ?? null,
        receiptMessage,
        transferAlias: settings?.transfer_alias ?? null,
        transferCbuCvu: settings?.transfer_cbu_cvu ?? null,
        transferBankOrWallet: settings?.transfer_bank_or_wallet ?? null,
        transferAccountHolder: settings?.transfer_account_holder ?? null,
        transferInstructions: settings?.transfer_instructions ?? null,
      }}
    />
  );
}
