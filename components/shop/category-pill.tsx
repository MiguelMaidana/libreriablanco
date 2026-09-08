import Link from "next/link";
import {
  Backpack,
  CalendarDays,
  FileText,
  FolderOpen,
  Library,
  NotebookText,
  Package,
  Palette,
  Pencil,
  type LucideIcon,
} from "lucide-react";

interface CategoryPillProps {
  name: string;
  slug: string;
}

interface CategoryStyle {
  icon: LucideIcon;
  bg: string;
  color: string;
}

// Mapeo por nombre de categoría — no depende de un campo nuevo en la base.
// Categorías sin match (nombres no previstos) caen al ícono genérico.
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  cuadernos: { icon: NotebookText, bg: "bg-purple-100", color: "text-purple-600" },
  escritura: { icon: Pencil, bg: "bg-orange-100", color: "text-orange-600" },
  papelería: { icon: FileText, bg: "bg-slate-100", color: "text-slate-600" },
  arte: { icon: Palette, bg: "bg-pink-100", color: "text-pink-600" },
  "mochilas y cartucheras": { icon: Backpack, bg: "bg-rose-100", color: "text-rose-600" },
  agendas: { icon: CalendarDays, bg: "bg-blue-100", color: "text-blue-600" },
  "carpetas y repuestos": { icon: FolderOpen, bg: "bg-amber-100", color: "text-amber-600" },
  libros: { icon: Library, bg: "bg-emerald-100", color: "text-emerald-600" },
};

const DEFAULT_STYLE: CategoryStyle = { icon: Package, bg: "bg-muted", color: "text-primary" };

function getCategoryStyle(name: string): CategoryStyle {
  return CATEGORY_STYLES[name.trim().toLowerCase()] ?? DEFAULT_STYLE;
}

export function CategoryPill({ name, slug }: CategoryPillProps) {
  const { icon: Icon, bg, color } = getCategoryStyle(name);

  return (
    <Link
      href={`/categoria/${slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition hover:bg-accent hover:shadow-md"
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${bg}`}>
        <Icon className={`h-6 w-6 ${color}`} aria-hidden="true" />
      </span>
      {name}
    </Link>
  );
}
