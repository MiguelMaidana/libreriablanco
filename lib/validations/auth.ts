import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
