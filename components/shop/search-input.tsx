"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const q = formData.get("q");
    const params = new URLSearchParams(searchParams);
    if (typeof q === "string" && q.trim().length > 0) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    const query = params.toString();
    router.push(query ? `/productos?${query}` : "/productos");
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 flex-1">
      <Input
        name="q"
        type="search"
        placeholder="Buscar cuadernos, lápices, carpetas..."
        defaultValue={searchParams.get("q") ?? ""}
      />
    </form>
  );
}
