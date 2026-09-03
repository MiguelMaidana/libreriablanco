import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  newOrdersCount: number;
  publishedProductsCount: number;
  unavailableProductsCount: number;
  todayOrdersCount: number;
  todayOrdersTotal: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [newOrders, publishedProducts, unavailableProducts, todayOrders] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "NEW"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("available", false),
    supabase.from("orders").select("total").gte("created_at", startOfToday.toISOString()),
  ]);

  const todayOrdersList = todayOrders.data ?? [];

  return {
    newOrdersCount: newOrders.count ?? 0,
    publishedProductsCount: publishedProducts.count ?? 0,
    unavailableProductsCount: unavailableProducts.count ?? 0,
    todayOrdersCount: todayOrdersList.length,
    todayOrdersTotal: todayOrdersList.reduce((sum, order) => sum + order.total, 0),
  };
}
