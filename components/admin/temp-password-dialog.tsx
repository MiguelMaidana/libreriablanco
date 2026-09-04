"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TempPasswordDialogProps {
  open: boolean;
  email: string;
  password: string;
  onClose: () => void;
}

export function TempPasswordDialog({ open, email, password, onClose }: TempPasswordDialogProps) {
  async function handleCopy() {
    // Esta es la única vez que se muestra la contraseña temporal: si el
    // copiado falla en silencio (contexto no seguro, permiso denegado,
    // etc.) y el admin le cree al toast de éxito, la pierde para siempre
    // (solo recuperable reseteándola de nuevo). Por eso esperamos la
    // promesa y solo mostramos éxito si realmente se copió.
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Contraseña copiada.");
    } catch (error) {
      console.error("TempPasswordDialog: error copying password to clipboard", error);
      toast.error("No pudimos copiar la contraseña. Copiala manualmente antes de cerrar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contraseña temporal generada</DialogTitle>
          <DialogDescription>
            {`Copiá esta contraseña y pasásela a ${email}. No vas a poder volver a verla.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 rounded border bg-muted p-4">
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="font-mono text-lg">{password}</p>
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={handleCopy}>
            Copiar
          </Button>
          <Button type="button" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
