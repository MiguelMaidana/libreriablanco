import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getViewAccess } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductQuickActions } from "@/components/admin/product-quick-actions";
import { ViewGuardMessage } from "@/components/admin/view-guard-message";

type FilterKey = "todos" | "publicados" | "no-disponibles" | "destacados";

interface ProductsPageProps {
  searchParams: Promise<{ filtro?: string; q?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { allowed, admin } = await getViewAccess("productos");
  if (!admin) {
    return <ViewGuardMessage title="Productos" message="No pudimos verificar tu sesión." />;
  }
  if (!allowed) {
    return <ViewGuardMessage title="Productos" message="No tenés permiso para ver esta página." />;
  }

  const { filtro, q } = await searchParams;
  const filter = (filtro as FilterKey) ?? "todos";

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, price, available, is_published, is_featured, product_images(url, is_primary)")
    .order("created_at", { ascending: false });

  if (filter === "publicados") {
    query = query.eq("is_published", true);
  } else if (filter === "no-disponibles") {
    query = query.eq("available", false);
  } else if (filter === "destacados") {
    query = query.eq("is_featured", true);
  }

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error("ProductsPage: error fetching products", error);
  }

  const rows = products ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Productos</h1>
        <Button asChild>
          <Link href="/admin/productos/nuevo">+ Agregar producto</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/admin/productos">
        <input type="hidden" name="filtro" value={filter} />
        <Input name="q" placeholder="Buscar producto..." defaultValue={q} />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <Tabs value={filter}>
        <TabsList>
          <TabsTrigger value="todos" asChild>
            <Link href="/admin/productos?filtro=todos">Todos</Link>
          </TabsTrigger>
          <TabsTrigger value="publicados" asChild>
            <Link href="/admin/productos?filtro=publicados">Publicados</Link>
          </TabsTrigger>
          <TabsTrigger value="no-disponibles" asChild>
            <Link href="/admin/productos?filtro=no-disponibles">No disponibles</Link>
          </TabsTrigger>
          <TabsTrigger value="destacados" asChild>
            <Link href="/admin/productos?filtro=destacados">Destacados</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no cargaste productos. Agregá el primero para empezar a armar tu tienda.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foto</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((product) => {
              const primaryImage = product.product_images?.find((img) => img.is_primary)?.url;
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    {primaryImage ? (
                      <Image
                        src={primaryImage}
                        alt=""
                        width={48}
                        height={48}
                        className="aspect-square rounded object-cover"
                      />
                    ) : (
                      <div className="size-12 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{`$${product.price}`}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_published ? "default" : "secondary"}>
                      {product.is_published ? "Publicado" : "Borrador"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ProductQuickActions
                      productId={product.id}
                      available={product.available}
                      isPublished={product.is_published}
                      isFeatured={product.is_featured}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
