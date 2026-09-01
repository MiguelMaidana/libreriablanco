import Link from "next/link";

interface CategoryPillProps {
  name: string;
  slug: string;
}

export function CategoryPill({ name, slug }: CategoryPillProps) {
  return (
    <Link href={`/categoria/${slug}`} className="rounded-full border px-4 py-2 text-sm hover:bg-accent">
      {name}
    </Link>
  );
}
