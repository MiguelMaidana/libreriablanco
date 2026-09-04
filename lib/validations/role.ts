import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().min(1, "Ingresá un nombre para el rol."),
});

export type RoleInput = z.infer<typeof roleSchema>;
