import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryDialog } from "./category-dialog";
import { createCategory } from "@/app/admin/(protected)/categorias/actions";

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return { ...actual };
});

vi.mock("@/app/admin/(protected)/categorias/actions", () => ({
  createCategory: vi.fn(async () => ({ error: null })),
  updateCategory: vi.fn(async () => ({ error: null })),
}));

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

  it("limpia el mensaje de error de un envío fallido al reabrir el diálogo", async () => {
    vi.mocked(createCategory).mockResolvedValueOnce({ error: "No pudimos guardar la categoría." });

    const user = userEvent.setup();
    render(<CategoryDialog trigger={<button>Abrir</button>} />);

    await user.click(screen.getByText("Abrir"));
    await user.type(screen.getByLabelText("Nombre"), "Papelería");
    await user.click(screen.getByRole("button", { name: "Guardar categoría" }));

    expect(await screen.findByText("No pudimos guardar la categoría.")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Crear categoría")).not.toBeInTheDocument();
    });

    await user.click(screen.getByText("Abrir"));

    expect(screen.getByText("Crear categoría")).toBeInTheDocument();
    expect(screen.queryByText("No pudimos guardar la categoría.")).not.toBeInTheDocument();
  });
});
