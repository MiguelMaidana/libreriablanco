import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./cart-provider", () => ({
  useCart: () => ({
    items: [],
    count: 0,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }),
}));

import { Header } from "./header";

describe("Header", () => {
  it("muestra el texto 'Librería Blanco' cuando no hay logo cargado", () => {
    render(<Header logoUrl={null} categories={[]} />);
    expect(screen.getByRole("link", { name: "Librería Blanco" })).toBeInTheDocument();
  });

  it("muestra la imagen del logo cuando settings.logo_url está cargado", () => {
    render(<Header logoUrl="https://example.com/logo.png" categories={[]} />);
    expect(screen.getByRole("img", { name: "Librería Blanco" })).toBeInTheDocument();
  });

  it("no muestra la barra de categorías si no hay categorías", () => {
    render(<Header logoUrl={null} categories={[]} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("muestra un link por cada categoría, apuntando a /categoria/[slug]", () => {
    render(
      <Header
        logoUrl={null}
        categories={[
          { id: "c1", name: "Escolar", slug: "escolar" },
          { id: "c2", name: "Arte", slug: "arte" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Escolar" })).toHaveAttribute(
      "href",
      "/categoria/escolar",
    );
    expect(screen.getByRole("link", { name: "Arte" })).toHaveAttribute(
      "href",
      "/categoria/arte",
    );
  });
});
