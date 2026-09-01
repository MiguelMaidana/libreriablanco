import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductForm } from "./product-form";

// ProductForm calls useRouter() unconditionally at render time (used to redirect
// after a successful create). Outside of a real Next.js App Router tree, next's
// useRouter() throws "invariant expected app router to be mounted" instead of
// returning a stub, so it must be mocked for these render-only tests — same
// pattern already used in app/admin/(protected)/layout.test.tsx.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const categories = [{ id: "cat-1", name: "Papelería" }];

describe("ProductForm", () => {
  it("muestra el CTA 'Guardar producto' y los campos principales", () => {
    render(<ProductForm mode="create" categories={categories} />);

    expect(screen.getByLabelText("Nombre del producto")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoría")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar producto" })).toBeInTheDocument();
  });

  it("calcula ganancia y margen en vivo al tipear costo y precio", async () => {
    const user = userEvent.setup();
    render(<ProductForm mode="create" categories={categories} />);

    await user.type(screen.getByLabelText("¿Cuánto te cuesta?"), "1000");
    await user.type(screen.getByLabelText("¿A cuánto lo vendés?"), "1500");

    expect(screen.getByText("$500")).toBeInTheDocument();
    expect(screen.getByText("33.33%")).toBeInTheDocument();
  });

  it("pre-popula los valores cuando mode es edit", () => {
    render(
      <ProductForm
        mode="edit"
        categories={categories}
        initialValues={{
          id: "prod-1",
          name: "Cuaderno Rivadavia A4",
          categoryId: "cat-1",
          cost: 1000,
          price: 1500,
        }}
      />,
    );

    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Cuaderno Rivadavia A4");
  });
});
