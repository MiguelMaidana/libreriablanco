"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withPermissionAction } from "@/lib/auth/permissions";

export interface OrderActionResult {
  error: string | null;
}

const FORBIDDEN: OrderActionResult = { error: "No tenés permiso para esta acción." };
const NOT_NEW_ERROR: OrderActionResult = { error: "Este pedido ya no está en estado Nuevo." };

export async function finalizeOrder(id: string): Promise<OrderActionResult> {
  return withPermissionAction("pedidos", "editar", FORBIDDEN, async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "COMPLETED", payment_confirmed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "NEW")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("finalizeOrder: error updating order", error);
      return { error: "No pudimos finalizar el pedido." };
    }

    if (!data) {
      return NOT_NEW_ERROR;
    }

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/admin");
    return { error: null };
  });
}

export async function cancelOrder(id: string): Promise<OrderActionResult> {
  return withPermissionAction("pedidos", "editar", FORBIDDEN, async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .eq("status", "NEW")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("cancelOrder: error updating order", error);
      return { error: "No pudimos cancelar el pedido." };
    }

    if (!data) {
      return NOT_NEW_ERROR;
    }

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/admin");
    return { error: null };
  });
}
