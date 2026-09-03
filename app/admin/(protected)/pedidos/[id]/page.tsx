import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";
import { buildOrderContactMessage } from "@/lib/admin/whatsapp";
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE_VARIANT } from "@/lib/admin/orders";
import { OrderStatusActions } from "@/components/admin/order-status-actions";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, total, payment_method, customers(first_name, last_name, phone, email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name_snapshot, unit_price, quantity")
    .eq("order_id", id)
    .order("id", { ascending: true });

  const customerName = order.customers
    ? `${order.customers.first_name} ${order.customers.last_name}`
    : "Cliente";
  const customerPhone = order.customers?.phone ?? null;

  const whatsappUrl =
    customerPhone && order.customers
      ? buildWhatsAppUrl(
          customerPhone,
          buildOrderContactMessage(order.customers.first_name, order.order_number),
        )
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl">{`Pedido #${order.order_number}`}</h1>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Cliente</h2>
        <p>{customerName}</p>
        {customerPhone && <p>{customerPhone}</p>}
        {order.customers?.email && <p>{order.customers.email}</p>}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Productos</h2>
        {(items ?? []).map((item) => (
          <p key={item.id}>
            {`${item.quantity} x ${item.product_name_snapshot} — ${formatPrice(item.unit_price * item.quantity)}`}
          </p>
        ))}
      </section>

      <section>
        <h2 className="font-semibold">Total</h2>
        <p className="text-xl font-semibold">{formatPrice(order.total)}</p>
      </section>

      <section>
        <h2 className="font-semibold">Pago</h2>
        <p>Transferencia</p>
      </section>

      {whatsappUrl && (
        <Button asChild variant="outline">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            Abrir WhatsApp
          </a>
        </Button>
      )}

      {order.status === "NEW" ? (
        <OrderStatusActions orderId={order.id} />
      ) : (
        <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]} className="w-fit">
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      )}
    </main>
  );
}
