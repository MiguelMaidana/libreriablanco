export type SortOption = "relevancia" | "precio_asc" | "precio_desc";

export function resolveSortOption(value: string | undefined): SortOption {
  if (value === "precio_asc" || value === "precio_desc") {
    return value;
  }
  return "relevancia";
}
