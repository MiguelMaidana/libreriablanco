import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeroProps {
  title: string | null;
  text: string | null;
  ctaText: string | null;
  ctaLink: string | null;
}

const DEFAULT_TITLE = "Todo para volver al cole";
const DEFAULT_TEXT = "Encontrá útiles, cuadernos y mucho más.";

export function Hero({ title, text, ctaText, ctaLink }: HeroProps) {
  return (
    <section className="flex flex-col items-center gap-4 bg-muted px-4 py-10 text-center">
      <h1 className="text-3xl font-bold">{title ?? DEFAULT_TITLE}</h1>
      <p className="text-muted-foreground">{text ?? DEFAULT_TEXT}</p>
      <Button asChild>
        <Link href={ctaLink ?? "/productos"}>{ctaText ?? "Ver productos"}</Link>
      </Button>
    </section>
  );
}
