import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-2xl">No encontramos esta página.</h1>
      <p className="text-muted-foreground">
        Puede que el link esté mal escrito o que la página ya no exista.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
