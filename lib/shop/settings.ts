import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type Settings = Database["public"]["Tables"]["settings"]["Row"];

export async function getSettings(): Promise<Settings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();

  if (error) {
    console.error("getSettings: error fetching settings", error);
    return null;
  }

  return data;
}
