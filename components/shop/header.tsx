import Image from "next/image";
import Link from "next/link";
import { SearchInput } from "./search-input";
import { CartLink } from "./cart-link";

interface HeaderProps {
  logoUrl: string | null;
}

export function Header({ logoUrl }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b p-4">
      <Link href="/" className="flex items-center text-xl font-bold text-primary">
        {logoUrl ? (
          <Image src={logoUrl} alt="Librería Blanco" width={40} height={40} priority className="h-10 w-auto" />
        ) : (
          "Librería Blanco"
        )}
      </Link>
      <SearchInput />
      <CartLink />
    </header>
  );
}
