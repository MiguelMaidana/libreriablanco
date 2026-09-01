"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createCategory,
  updateCategory,
  type CategoryActionState,
} from "@/app/admin/(protected)/categorias/actions";
import { toast } from "sonner";

export interface CategoryDialogValue {
  id: string;
  name: string;
  isFeatured: boolean;
  isActive: boolean;
}

interface CategoryDialogProps {
  trigger: React.ReactNode;
  category?: CategoryDialogValue;
}

const initialState: CategoryActionState = { error: null };

export function CategoryDialog({ trigger, category }: CategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(category);
  const submittedRef = useRef(false);

  const action = isEdit ? updateCategory.bind(null, category!.id) : createCategory;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    if (state.error === null) {
      toast.success(isEdit ? "Categoría guardada." : "Categoría creada.");
      // Closing the dialog is a reaction to the server action's result (state),
      // which can only be observed after the action settles; there is no event
      // handler to run this from since useActionState resolves asynchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      submittedRef.current = false;
    }
  }, [state, pending, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría" : "Crear categoría"}</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => {
            submittedRef.current = true;
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={category?.name ?? ""} required />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isFeatured">Destacada</Label>
            <Switch id="isFeatured" name="isFeatured" defaultChecked={category?.isFeatured ?? false} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Activa</Label>
            <Switch id="isActive" name="isActive" defaultChecked={category?.isActive ?? true} />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar categoría"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
