import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function uniqueSlug(
  supabase: SupabaseClient,
  table: "categories" | "products",
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (;;) {
    let query = supabase.from(table).select("id").eq("slug", candidate);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data } = await query.maybeSingle();
    if (!data) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
