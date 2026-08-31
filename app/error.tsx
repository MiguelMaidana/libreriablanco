"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-2xl">No pudimos completar la operación.</h1>
      <p className="text-muted-foreground">Probá de nuevo en un momento.</p>
      <Button onClick={reset}>Intentar de nuevo</Button>
    </main>
  );
}
