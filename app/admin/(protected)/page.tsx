import Link from "next/link";
import { getCurrentAdmin } from "@/lib/auth/permissions";
import { getDashboardStats } from "@/lib/admin/dashboard";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/shop/format";

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();
  const stats = await getDashboardStats();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{`Hola, ${admin?.fullName ?? "administradora"} 👋`}</h1>
        <p className="text-muted-foreground">¿Qué necesitás hacer?</p>
        <Button asChild className="w-fit">
          <Link href="/admin/productos/nuevo">+ Agregar producto</Link>
        </Button>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-semibold">Pedidos nuevos</h2>
        <p className="text-2xl">{`${stats.newOrdersCount} pedidos`}</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/admin/pedidos">Ver pedidos</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-semibold">Productos</h2>
        <p>{`${stats.publishedProductsCount} publicados`}</p>
        <p>{`${stats.unavailableProductsCount} no disponibles`}</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/admin/productos">Ver productos</Link>
        </Button>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Hoy</h2>
        <p>{`${stats.todayOrdersCount} pedidos · ${formatPrice(stats.todayOrdersTotal)}`}</p>
      </section>

      <form action="/admin/logout" method="post">
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
