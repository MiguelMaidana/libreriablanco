"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createRole,
  updateRole,
  type RoleActionState,
} from "@/app/admin/(protected)/usuarios/roles/actions";
import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  type PermissionModule,
  type PermissionAction,
} from "@/lib/auth/permission-catalog";

const MODULE_LABELS: Record<PermissionModule, string> = {
  productos: "Productos",
  precios: "Precios",
  stock: "Stock",
  pedidos: "Pedidos",
  clientes: "Clientes",
  facturacion: "Facturación",
  usuarios: "Usuarios",
  configuracion: "Configuración",
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
};

interface RoleFormProps {
  mode: "create" | "edit";
  roleId?: string;
  initialName?: string;
  initialPermissions?: { module: PermissionModule; action: PermissionAction }[];
}

const initialState: RoleActionState = { error: null };

export function RoleForm({ mode, roleId, initialName, initialPermissions }: RoleFormProps) {
  const router = useRouter();
  const submittedRef = useRef(false);
  const checkedSet = new Set((initialPermissions ?? []).map((p) => `${p.module}_${p.action}`));

  const action = mode === "edit" ? updateRole.bind(null, roleId!) : createRole;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    submittedRef.current = false;
    if (state.error === null) {
      toast.success("Rol guardado.");
      router.push("/admin/usuarios/roles");
    }
  }, [state, pending, router]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="flex max-w-3xl flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre del rol</Label>
        <Input id="name" name="name" defaultValue={initialName ?? ""} required />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">¿Qué puede hacer?</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              {PERMISSION_ACTIONS.map((action) => (
                <TableHead key={action} className="text-center">
                  {ACTION_LABELS[action]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_MODULES.map((module) => (
              <TableRow key={module}>
                <TableCell>{MODULE_LABELS[module]}</TableCell>
                {PERMISSION_ACTIONS.map((action) => (
                  <TableCell key={action} className="text-center">
                    <Checkbox
                      name={`perm_${module}_${action}`}
                      defaultChecked={checkedSet.has(`${module}_${action}`)}
                      aria-label={`${MODULE_LABELS[module]} - ${ACTION_LABELS[action]}`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar rol"}
      </Button>
    </form>
  );
}
