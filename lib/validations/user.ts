import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z.string().min(1, "Ingresá un nombre."),
  email: z.string().email("Ingresá un email válido."),
  roleId: z.string().uuid("Elegí un rol."),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1, "Ingresá un nombre."),
  roleId: z.string().uuid("Elegí un rol."),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
