"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryOption {
  slug: string;
  name: string;
}

interface ProductFiltersProps {
  categories: CategoryOption[];
}

export function ProductFilters({ categories }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams);
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <Select
        value={searchParams.get("categoria") ?? "todas"}
        onValueChange={(value) => updateParam("categoria", value, "todas")}
      >
        <SelectTrigger className="w-48" aria-label="Categoría">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las categorías</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.slug} value={category.slug}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("orden") ?? "relevancia"}
        onValueChange={(value) => updateParam("orden", value, "relevancia")}
      >
        <SelectTrigger className="w-48" aria-label="Ordenar por">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="relevancia">Más recientes</SelectItem>
          <SelectItem value="precio_asc">Precio: menor a mayor</SelectItem>
          <SelectItem value="precio_desc">Precio: mayor a menor</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
