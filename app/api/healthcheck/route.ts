import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("_healthcheck")
    .select("status")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: data.status });
}
