import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewAccess } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice, formatDateTime } from "@/lib/shop/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_BADGE_VARIANT,
  STATUS_BY_FILTER,
  type OrderFilter,
} from "@/lib/admin/orders";
import { DATE_FILTERS, getDateRangeForFilter, type DateFilter } from "@/lib/admin/date-ranges";
import { ViewGuardMessage } from "@/components/admin/view-guard-message";

const EMPTY_MESSAGE_BY_FILTER: Record<OrderFilter, string> = {
  nuevos: "No hay pedidos nuevos por el momento.",
  finalizados: "Todavía no hay pedidos finalizados.",
  cancelados: "No hay pedidos cancelados.",
  todos: "Todavía no llegó ningún pedido.",
};

interface OrdersPageProps {
  searchParams: Promise<{ filtro?: string; fecha?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { allowed, admin } = await getViewAccess("pedidos");
  if (!admin) {
    return <ViewGuardMessage title="Pedidos" message="No pudimos verificar tu sesión." />;
  }
  if (!allowed) {
    return <ViewGuardMessage title="Pedidos" message="No tenés permiso para ver esta página." />;
  }

  const { filtro, fecha } = await searchParams;
  const filter = (filtro as OrderFilter) ?? "nuevos";
  const dateFilter = (fecha as DateFilter) ?? "todas";
  const dateRange = getDateRangeForFilter(dateFilter);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, total, created_at, customers(first_name, last_name), order_items(quantity)",
    )
    .order("created_at", { ascending: false });

  if (filter !== "todos") {
    query = query.eq("status", STATUS_BY_FILTER[filter]);
  }

  if (dateRange) {
    query = query.gte("created_at", dateRange.from).lt("created_at", dateRange.to);
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error("OrdersPage: error fetching orders", error);
  }

  const rows = orders ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Pedidos</h1>
        <Button asChild variant="outline">
          <a href={`/admin/pedidos/export?filtro=${filter}&fecha=${dateFilter}`}>
            Exportar a Excel
          </a>
        </Button>
      </div>

      <Tabs value={filter}>
        <TabsList>
          <TabsTrigger value="nuevos" asChild>
            <Link href={`/admin/pedidos?filtro=nuevos&fecha=${dateFilter}`}>Nuevos</Link>
          </TabsTrigger>
          <TabsTrigger value="finalizados" asChild>
            <Link href={`/admin/pedidos?filtro=finalizados&fecha=${dateFilter}`}>Finalizados</Link>
          </TabsTrigger>
          <TabsTrigger value="cancelados" asChild>
            <Link href={`/admin/pedidos?filtro=cancelados&fecha=${dateFilter}`}>Cancelados</Link>
          </TabsTrigger>
          <TabsTrigger value="todos" asChild>
            <Link href={`/admin/pedidos?filtro=todos&fecha=${dateFilter}`}>Todos</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={dateFilter}>
        <TabsList>
          {DATE_FILTERS.map((option) => (
            <TabsTrigger key={option.value} value={option.value} asChild>
              <Link href={`/admin/pedidos?filtro=${filter}&fecha=${option.value}`}>
                {option.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{EMPTY_MESSAGE_BY_FILTER[filter]}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((order) => {
            const customerName = order.customers
              ? `${order.customers.first_name} ${order.customers.last_name}`
              : "Cliente";
            const unitCount = (order.order_items ?? []).reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{`Pedido #${order.order_number}`}</p>
                  <p className="text-sm text-muted-foreground">{customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {`${unitCount} producto${unitCount === 1 ? "" : "s"} · ${formatPrice(order.total)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(order.created_at)}</p>
                  <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]} className="w-fit">
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/pedidos/${order.id}`}>Ver pedido</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
