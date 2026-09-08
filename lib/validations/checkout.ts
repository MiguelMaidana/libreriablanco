import { z } from "zod";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const checkoutSchema = z.object({
  firstName: z.string().min(1, "Ingresá tu nombre."),
  lastName: z.string().min(1, "Ingresá tu apellido."),
  email: z.string().email("Ingresá un email válido."),
  phone: z
    .string()
    .trim()
    .min(6, "Ingresá tu teléfono."),
  items: z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "El carrito no es válido." });
        return z.NEVER;
      }
    })
    .pipe(z.array(cartItemSchema).min(1, "El carrito está vacío.")),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
