import { describe, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminSidebar, type SidebarViewPermissions } from "./sidebar";

const ALL_ALLOWED: SidebarViewPermissions = {
  productos: true,
  pedidos: true,
  clientes: true,
  configuracion: true,
  usuarios: true,
};

describe("AdminSidebar", () => {
  it("muestra el nombre del admin y el link a Productos", () => {
    render(<AdminSidebar adminName="Jessica Besse" viewPermissions={ALL_ALLOWED} />);

    expect(screen.getByText("Jessica Besse")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute(
      "href",
      "/admin/productos",
    );
    expect(screen.getByRole("link", { name: "Categorías" })).toHaveAttribute(
      "href",
      "/admin/categorias",
    );
    expect(screen.getByRole("link", { name: "Usuarios y Roles" })).toHaveAttribute(
      "href",
      "/admin/usuarios",
    );
  });

  it("muestra los links a Pedidos y Clientes", () => {
    render(<AdminSidebar adminName="Jessica Besse" viewPermissions={ALL_ALLOWED} />);

    expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute(
      "href",
      "/admin/pedidos",
    );
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute(
      "href",
      "/admin/clientes",
    );
  });

  it("cierra el menú mobile al navegar a un link", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar adminName="Jessica Besse" viewPermissions={ALL_ALLOWED} />);

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog");
    const link = within(dialog).getByRole("link", { name: "Productos" });

    await user.click(link);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("no muestra los links de los módulos sin permiso de ver", () => {
    render(
      <AdminSidebar
        adminName="Vendedora"
        viewPermissions={{ productos: false, pedidos: true, clientes: false, configuracion: false, usuarios: false }}
      />,
    );

    expect(screen.queryByRole("link", { name: "Productos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Categorías" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clientes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuarios y Roles" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedidos" })).toBeInTheDocument();
  });

  it("no muestra Categorías si no tiene permiso de ver Productos", () => {
    render(
      <AdminSidebar
        adminName="Vendedora"
        viewPermissions={{ ...ALL_ALLOWED, productos: false }}
      />,
    );

    expect(screen.queryByRole("link", { name: "Categorías" })).not.toBeInTheDocument();
  });
});
