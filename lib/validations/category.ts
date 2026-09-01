import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Ingresá un nombre."),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
