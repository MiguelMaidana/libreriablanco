import Link from "next/link";
import { Package } from "lucide-react";

interface CategoryPillProps {
  name: string;
  slug: string;
}

export function CategoryPill({ name, slug }: CategoryPillProps) {
  return (
    <Link
      href={`/categoria/${slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition hover:bg-accent hover:shadow-md"
    >
      <Package className="h-6 w-6 text-primary" aria-hidden="true" />
      {name}
    </Link>
  );
}
