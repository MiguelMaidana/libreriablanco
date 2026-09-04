"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";
import {
  createUser,
  updateUser,
  type UserActionState,
} from "@/app/admin/(protected)/usuarios/actions";

export interface RoleOption {
  id: string;
  name: string;
}

export interface UserDialogValue {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
}

interface UserDialogProps {
  trigger: React.ReactNode;
  roles: RoleOption[];
  user?: UserDialogValue;
}

const initialState: UserActionState = { error: null };

export function UserDialog({ trigger, roles, user }: UserDialogProps) {
  const [open, setOpen] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const isEdit = Boolean(user);
  const submittedRef = useRef(false);
  const submittedEmailRef = useRef("");

  const action = isEdit ? updateUser.bind(null, user!.id) : createUser;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    submittedRef.current = false;
    if (state.error !== null) {
      setDisplayError(state.error);
      return;
    }
    setDisplayError(null);
    // Cerrar el diálogo de formulario es una reacción al resultado del
    // server action (state), que solo se conoce después de que se resuelve;
    // no hay un event handler síncrono desde el cual dispararlo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    if (state.tempPassword) {
      setRevealedPassword(state.tempPassword);
    } else {
      toast.success("Usuario guardado.");
    }
  }, [state, pending]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDisplayError(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar usuario" : "Crear usuario"}</DialogTitle>
          </DialogHeader>
          <form
            action={formAction}
            onSubmit={(event) => {
              submittedRef.current = true;
              submittedEmailRef.current = String(
                new FormData(event.currentTarget).get("email") ?? "",
              );
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Nombre</Label>
              <Input id="fullName" name="fullName" defaultValue={user?.fullName ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user?.email ?? ""}
                required
                readOnly={isEdit}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="roleId">Rol</Label>
              <Select name="roleId" defaultValue={user?.roleId} required>
                <SelectTrigger id="roleId">
                  <SelectValue placeholder="Elegí un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {displayError && <p className="text-sm text-destructive">{displayError}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar usuario"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {revealedPassword && (
        <TempPasswordDialog
          open
          email={user?.email ?? submittedEmailRef.current}
          password={revealedPassword}
          onClose={() => setRevealedPassword(null)}
        />
      )}
    </>
  );
}
