import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  newOrdersCount: number;
  publishedProductsCount: number;
  unavailableProductsCount: number;
  todayOrdersCount: number;
  todayOrdersTotal: number;
}

const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

function getStartOfTodayInArgentina(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return new Date(`${year}-${month}-${day}T00:00:00-03:00`);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const startOfToday = getStartOfTodayInArgentina();

  const [newOrders, publishedProducts, unavailableProducts, todayOrders] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "NEW"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("available", false),
    supabase.from("orders").select("total").gte("created_at", startOfToday.toISOString()),
  ]);

  if (newOrders.error) {
    console.error("getDashboardStats: error fetching new orders count", newOrders.error);
  }
  if (publishedProducts.error) {
    console.error(
      "getDashboardStats: error fetching published products count",
      publishedProducts.error,
    );
  }
  if (unavailableProducts.error) {
    console.error(
      "getDashboardStats: error fetching unavailable products count",
      unavailableProducts.error,
    );
  }
  if (todayOrders.error) {
    console.error("getDashboardStats: error fetching today's orders", todayOrders.error);
  }

  const todayOrdersList = todayOrders.data ?? [];

  return {
    newOrdersCount: newOrders.count ?? 0,
    publishedProductsCount: publishedProducts.count ?? 0,
    unavailableProductsCount: unavailableProducts.count ?? 0,
    todayOrdersCount: todayOrdersList.length,
    todayOrdersTotal: todayOrdersList.reduce((sum, order) => sum + order.total, 0),
  };
}
