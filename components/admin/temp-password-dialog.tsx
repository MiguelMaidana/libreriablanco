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
  function handleCopy() {
    navigator.clipboard.writeText(password);
    toast.success("Contraseña copiada.");
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
