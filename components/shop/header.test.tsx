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
    render(<Header logoUrl={null} />);
    expect(screen.getByRole("link", { name: "Librería Blanco" })).toBeInTheDocument();
  });

  it("muestra la imagen del logo cuando settings.logo_url está cargado", () => {
    render(<Header logoUrl="https://example.com/logo.png" />);
    expect(screen.getByRole("img", { name: "Librería Blanco" })).toBeInTheDocument();
  });
});
