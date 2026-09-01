import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : null));

export const productSchema = z.object({
  name: z.string().min(1, "Ingresá un nombre."),
  categoryId: z.string().min(1, "Elegí una categoría."),
  shortDescription: optionalText,
  cost: z.coerce.number().nonnegative("El costo no puede ser negativo."),
  price: z.coerce.number().nonnegative("El precio no puede ser negativo."),
  available: z.boolean(),
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  sku: optionalText,
  isbn: optionalText,
  barcode: optionalText,
  brand: optionalText,
  author: optionalText,
  publisher: optionalText,
  tags: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
});

export type ProductInput = z.infer<typeof productSchema>;
