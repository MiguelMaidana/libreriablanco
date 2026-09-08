import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewAccess } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/shop/format";
import { ORDER_STATUS_LABEL, STATUS_BY_FILTER, type OrderFilter } from "@/lib/admin/orders";
import { getDateRangeForFilter, type DateFilter } from "@/lib/admin/date-ranges";
import { buildOrdersWorkbookBuffer, type OrderExportRow } from "@/lib/admin/orders-export";

export async function GET(request: Request) {
  const { allowed, admin } = await getViewAccess("pedidos");
  if (!admin || !allowed) {
    return NextResponse.json({ error: "No tenés permiso para exportar pedidos." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = (searchParams.get("filtro") as OrderFilter) ?? "nuevos";
  const dateFilter = (searchParams.get("fecha") as DateFilter) ?? "todas";
  const dateRange = getDateRangeForFilter(dateFilter);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "order_number, status, total, created_at, customers(first_name, last_name, phone), order_items(quantity)",
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
    console.error("GET /admin/pedidos/export: error fetching orders", error);
    return NextResponse.json({ error: "No pudimos generar el archivo." }, { status: 500 });
  }

  const rows: OrderExportRow[] = (orders ?? []).map((order) => ({
    orderNumber: order.order_number,
    date: formatDateTime(order.created_at),
    customerName: order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : "",
    customerPhone: order.customers?.phone ?? "",
    statusLabel: ORDER_STATUS_LABEL[order.status] ?? order.status,
    itemCount: (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    total: order.total,
  }));

  const buffer = await buildOrdersWorkbookBuffer(rows);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pedidos.xlsx"',
    },
  });
}
