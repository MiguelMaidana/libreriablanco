"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { finalizeOrder, cancelOrder, type OrderActionResult } from "@/app/admin/(protected)/pedidos/actions";

interface OrderStatusActionsProps {
  orderId: string;
}

export function OrderStatusActions({ orderId }: OrderStatusActionsProps) {
  const [isPending, startTransition] = useTransition();

  function run(promise: Promise<OrderActionResult>, successMessage: string) {
    startTransition(async () => {
      const result = await promise;
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(successMessage);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => run(finalizeOrder(orderId), "Pedido finalizado.")}
      >
        Finalizar pedido
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" disabled={isPending}>
            Cancelar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(cancelOrder(orderId), "Pedido cancelado.")}>
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
