import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { CategoryActiveToggle } from "@/components/admin/category-active-toggle";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, is_featured, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("CategoriesPage: error fetching categories", error);
  }

  const rows = categories ?? [];

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Categorías</h1>
        <CategoryDialog trigger={<Button>+ Crear categoría</Button>} />
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no creaste categorías. Agregá la primera para poder cargar productos.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Destacada</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell>{category.is_featured ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <CategoryActiveToggle categoryId={category.id} isActive={category.is_active} />
                </TableCell>
                <TableCell>
                  <CategoryDialog
                    trigger={<Button variant="outline">Editar</Button>}
                    category={{
                      id: category.id,
                      name: category.name,
                      isFeatured: category.is_featured,
                      isActive: category.is_active,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
