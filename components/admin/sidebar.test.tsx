import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("no muestra ítems de módulos que todavía no existen", () => {
    render(<AdminSidebar adminName="Jessica Besse" />);

    expect(screen.queryByText("Pedidos")).not.toBeInTheDocument();
    expect(screen.queryByText("Clientes")).not.toBeInTheDocument();
  });
});
