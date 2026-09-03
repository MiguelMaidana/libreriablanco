import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/shop/format";

interface CustomersPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { q } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, first_name, last_name, phone, email")
    .order("created_at", { ascending: false });

  if (q) {
    const term = `%${q}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`,
    );
  }

  const { data: customers, error } = await query;

  if (error) {
    console.error("CustomersPage: error fetching customers", error);
  }

  const rows = customers ?? [];
  const customerIds = rows.map((customer) => customer.id);

  let completedOrders: { customer_id: string; created_at: string }[] = [];
  if (customerIds.length > 0) {
    const { data } = await supabase
      .from("orders")
      .select("customer_id, created_at")
      .eq("status", "COMPLETED")
      .in("customer_id", customerIds);
    completedOrders = data ?? [];
  }

  const statsByCustomer = new Map<string, { count: number; lastPurchase: string | null }>();
  for (const order of completedOrders) {
    const existing = statsByCustomer.get(order.customer_id) ?? { count: 0, lastPurchase: null };
    existing.count += 1;
    if (!existing.lastPurchase || order.created_at > existing.lastPurchase) {
      existing.lastPurchase = order.created_at;
    }
    statsByCustomer.set(order.customer_id, existing);
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl">Clientes</h1>

      <form className="flex gap-2" action="/admin/clientes">
        <Input name="q" placeholder="Buscar por nombre, teléfono o email" defaultValue={q} />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          {q ? "No encontramos clientes con esa búsqueda." : "Todavía no hay clientes cargados."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((customer) => {
            const stats = statsByCustomer.get(customer.id) ?? { count: 0, lastPurchase: null };
            return (
              <Link
                key={customer.id}
                href={`/admin/clientes/${customer.id}`}
                className="flex flex-col gap-1 rounded-lg border p-4 hover:bg-accent"
              >
                <p className="font-medium">{`${customer.first_name} ${customer.last_name}`}</p>
                {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
                <p className="text-sm text-muted-foreground">
                  {`${stats.count} compra${stats.count === 1 ? "" : "s"}`}
                </p>
                {stats.lastPurchase && (
                  <p className="text-sm text-muted-foreground">
                    {`Última compra: ${formatDate(stats.lastPurchase)}`}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
