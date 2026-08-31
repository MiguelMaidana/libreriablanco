import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("_healthcheck")
    .select("status")
    .maybeSingle();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-3xl">Librería Blanco</h1>
      <p className="text-muted-foreground">
        Base del proyecto lista — esta pantalla se reemplaza en la Fase 3
        por la vidriera pública real.
      </p>
      <p className="text-sm text-muted-foreground">
        Conexión a Supabase: {data?.status ?? "sin verificar"}
      </p>
      <Button>Ver productos</Button>
      <Card>
        <CardHeader>
          <CardTitle>Cuaderno Rivadavia A4</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge>Nuevo</Badge>
          <span>$ 3.500</span>
        </CardContent>
      </Card>
    </main>
  );
}
