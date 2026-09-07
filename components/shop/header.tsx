import Image from "next/image";
import Link from "next/link";
import { SearchInput } from "./search-input";
import { WhatsAppButton } from "./whatsapp-button";
import { CartLink } from "./cart-link";

interface HeaderProps {
  whatsappNumber: string | null;
  whatsappMessage: string | null;
  logoUrl: string | null;
}

export function Header({ whatsappNumber, whatsappMessage, logoUrl }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b p-4">
      <Link href="/" className="flex items-center text-xl font-bold text-primary">
        {logoUrl ? (
          <Image src={logoUrl} alt="Librería Blanco" width={40} height={40} className="h-10 w-auto" />
        ) : (
          "Librería Blanco"
        )}
      </Link>
      <SearchInput />
      <WhatsAppButton
        phoneNumber={whatsappNumber}
        message={whatsappMessage ?? "Hola! Quería hacer una consulta."}
      />
      <CartLink />
    </header>
  );
}
