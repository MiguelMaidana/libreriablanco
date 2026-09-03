import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/shop/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE_VARIANT } from "@/lib/admin/orders";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone, email")
    .eq("id", id)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const orderRows = orders ?? [];
  const totalComprado = orderRows
    .filter((order) => order.status === "COMPLETED")
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl">{`${customer.first_name} ${customer.last_name}`}</h1>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Datos</h2>
        {customer.phone && <p>{customer.phone}</p>}
        {customer.email && <p>{customer.email}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Historial de compras</h2>
        {orderRows.length === 0 ? (
          <p className="text-muted-foreground">Todavía no tiene pedidos.</p>
        ) : (
          orderRows.map((order) => (
            <div key={order.id} className="flex items-center justify-between text-sm">
              <span>
                {`Pedido #${order.order_number} · ${new Date(order.created_at).toLocaleDateString("es-AR")} · ${formatPrice(order.total)}`}
              </span>
              <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                {ORDER_STATUS_LABEL[order.status]}
              </Badge>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="font-semibold">Total comprado</h2>
        <p className="text-xl font-semibold">{formatPrice(totalComprado)}</p>
      </section>
    </main>
  );
}
