"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PriceWarningDialogProps {
  open: boolean;
  lossPerUnit: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PriceWarningDialog({
  open,
  lossPerUnit,
  onConfirm,
  onCancel,
}: PriceWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>El precio de venta es menor al costo</AlertDialogTitle>
          <AlertDialogDescription>
            {`Vas a perder $${Math.abs(lossPerUnit).toFixed(0)} por unidad. ¿Querés guardar igualmente?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Revisar precio</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Guardar igual</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
