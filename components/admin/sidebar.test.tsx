import { describe, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminSidebar } from "./sidebar";

describe("AdminSidebar", () => {
  it("muestra el nombre del admin y el link a Productos", () => {
    render(<AdminSidebar adminName="Jessica Besse" />);

    expect(screen.getByText("Jessica Besse")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Productos" })).toHaveAttribute(
      "href",
      "/admin/productos",
    );
    expect(screen.getByRole("link", { name: "Categorías" })).toHaveAttribute(
      "href",
      "/admin/categorias",
    );
  });

  it("muestra los links a Pedidos y Clientes", () => {
    render(<AdminSidebar adminName="Jessica Besse" />);

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
    render(<AdminSidebar adminName="Jessica Besse" />);

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog");
    const link = within(dialog).getByRole("link", { name: "Productos" });

    await user.click(link);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
