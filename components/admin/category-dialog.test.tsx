import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryDialog } from "./category-dialog";

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return { ...actual };
});

describe("CategoryDialog", () => {
  it("muestra 'Crear categoría' cuando no hay categoría inicial", async () => {
    const user = userEvent.setup();
    render(<CategoryDialog trigger={<button>Abrir</button>} />);

    await user.click(screen.getByText("Abrir"));

    expect(screen.getByText("Crear categoría")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
  });

  it("pre-popula el formulario cuando se pasa una categoría existente", async () => {
    const user = userEvent.setup();
    render(
      <CategoryDialog
        trigger={<button>Editar</button>}
        category={{ id: "cat-1", name: "Papelería", isFeatured: true, isActive: true }}
      />,
    );

    await user.click(screen.getByText("Editar"));

    expect(screen.getByText("Editar categoría")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Papelería");
  });
});
