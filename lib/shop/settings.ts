import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type Settings = Database["public"]["Tables"]["settings"]["Row"];

// cache() deduplica la consulta dentro del mismo request — el layout del
// shop y la página que se está renderizando (Home, ficha de producto)
// llaman a getSettings() por separado; sin esto, cada request hacía dos
// round-trips idénticos a Supabase.
export const getSettings = cache(async (): Promise<Settings | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();

  if (error) {
    console.error("getSettings: error fetching settings", error);
    return null;
  }

  return data;
});
