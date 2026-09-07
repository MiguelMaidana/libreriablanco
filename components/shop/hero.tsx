import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeroProps {
  title: string | null;
  text: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  imageUrl: string | null;
}

const DEFAULT_TITLE = "Todo para volver al cole";
const DEFAULT_TEXT = "Encontrá útiles, cuadernos y mucho más.";

export function Hero({ title, text, ctaText, ctaLink, imageUrl }: HeroProps) {
  return (
    <section className="relative flex min-h-[300px] items-center justify-center overflow-hidden bg-muted px-4 text-center md:min-h-[480px]">
      {imageUrl && (
        <>
          <Image src={imageUrl} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-black/40" />
        </>
      )}
      <div className="relative flex flex-col items-center gap-4">
        <h1 className={`text-3xl font-bold ${imageUrl ? "text-white" : ""}`}>{title ?? DEFAULT_TITLE}</h1>
        <p className={imageUrl ? "text-white/90" : "text-muted-foreground"}>{text ?? DEFAULT_TEXT}</p>
        <Button asChild>
          <Link href={ctaLink ?? "/productos"}>{ctaText ?? "Ver productos"}</Link>
        </Button>
      </div>
    </section>
  );
}
