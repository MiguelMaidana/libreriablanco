"use client";

import { useState, useTransition } from "react";
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
import { UserDialog, type RoleOption, type UserDialogValue } from "@/components/admin/user-dialog";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";
import { toggleActive, resetPassword } from "@/app/admin/(protected)/usuarios/actions";

interface UserRowActionsProps {
  user: UserDialogValue & { isActive: boolean };
  roles: RoleOption[];
  // `roles` (roleOptions) excluye SUPER_ADMIN por diseño. Para la fila del
  // propio SUPER_ADMIN, `user.roleId` no existe en esa lista, así que el
  // <Select> de UserDialog quedaría en un estado sin ninguna opción
  // coincidente. El caller (usuarios/page.tsx) pasa `false` acá para esas
  // filas y así evita ofrecer un botón que abra un diálogo de edición roto.
  canEditRole?: boolean;
}

export function UserRowActions({ user, roles, canEditRole = true }: UserRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  function handleToggleActive(nextIsActive: boolean) {
    startTransition(async () => {
      const result = await toggleActive(user.id, nextIsActive);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(nextIsActive ? "Usuario reactivado." : "Usuario desactivado.");
      }
    });
  }

  function handleResetPassword() {
    startTransition(async () => {
      const result = await resetPassword(user.id);
      if (result.error) {
        toast.error(result.error);
      } else if (result.tempPassword) {
        setRevealedPassword(result.tempPassword);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canEditRole && (
        <UserDialog trigger={<Button variant="outline">Editar</Button>} roles={roles} user={user} />
      )}

      {user.isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Restablecer contraseña
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{`¿Restablecer la contraseña de ${user.fullName}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                Se va a generar una nueva contraseña temporal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPassword}>Restablecer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {user.isActive ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={isPending}>
              Desactivar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{`¿Desactivar a ${user.fullName}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                No va a poder iniciar sesión hasta que lo reactives.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleToggleActive(false)}>
                Sí, desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => handleToggleActive(true)}
        >
          Reactivar
        </Button>
      )}

      {revealedPassword && (
        <TempPasswordDialog
          open
          email={user.email}
          password={revealedPassword}
          onClose={() => setRevealedPassword(null)}
        />
      )}
    </div>
  );
}
