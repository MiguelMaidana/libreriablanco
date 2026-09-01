import Link from "next/link";
import { SearchInput } from "./search-input";
import { WhatsAppButton } from "./whatsapp-button";

interface HeaderProps {
  whatsappNumber: string | null;
  whatsappMessage: string | null;
}

export function Header({ whatsappNumber, whatsappMessage }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b p-4">
      <Link href="/" className="text-xl font-bold text-primary">
        Librería Blanco
      </Link>
      <SearchInput />
      <WhatsAppButton
        phoneNumber={whatsappNumber}
        message={whatsappMessage ?? "Hola! Quería hacer una consulta."}
      />
    </header>
  );
}
