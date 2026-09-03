"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface AdminSidebarProps {
  adminName: string;
}

interface NavLinksProps {
  onNavigate?: () => void;
}

function NavLinks({ onNavigate }: NavLinksProps) {
  return (
    <nav className="flex flex-col gap-1">
      <Link
        href="/admin/productos"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Productos
      </Link>
      <Link
        href="/admin/categorias"
        className="ml-3 rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Categorías
      </Link>
      <Link
        href="/admin/pedidos"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Pedidos
      </Link>
      <Link
        href="/admin/clientes"
        className="rounded px-3 py-2 text-sm hover:bg-accent"
        onClick={onNavigate}
      >
        Clientes
      </Link>
    </nav>
  );
}

export function AdminSidebar({ adminName }: AdminSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-56 flex-col justify-between border-r p-4 md:flex">
        <div>
          <p className="mb-4 text-lg font-semibold">Librería Blanco</p>
          <NavLinks />
        </div>
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">{adminName}</p>
          <form action="/admin/logout" method="post">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b p-4 md:hidden">
        <p className="text-lg font-semibold">Librería Blanco</p>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menú">
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col justify-between p-4">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">{adminName}</p>
              <form action="/admin/logout" method="post">
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
