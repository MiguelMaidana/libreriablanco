import Image from "next/image";
import Link from "next/link";
import { SearchInput } from "./search-input";
import { CartLink } from "./cart-link";

interface HeaderCategory {
  id: string;
  name: string;
  slug: string;
}

interface HeaderProps {
  logoUrl: string | null;
  categories: HeaderCategory[];
}

export function Header({ logoUrl, categories }: HeaderProps) {
  return (
    <header className="border-b">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <Link href="/" className="flex items-center text-xl font-bold text-primary">
          {logoUrl ? (
            <Image src={logoUrl} alt="Librería Blanco" width={40} height={40} priority className="h-10 w-auto" />
          ) : (
            "Librería Blanco"
          )}
        </Link>
        <SearchInput />
        <CartLink />
      </div>
      {categories.length > 0 && (
        <nav className="flex gap-5 overflow-x-auto border-t px-4 py-2 text-sm">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categoria/${category.slug}`}
              className="whitespace-nowrap text-muted-foreground hover:text-foreground"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
