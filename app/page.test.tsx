import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("muestra el nombre de la librería como título", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Librería Blanco" }),
    ).toBeInTheDocument();
  });

  it("muestra un botón primario de ejemplo", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("button", { name: "Ver productos" }),
    ).toBeInTheDocument();
  });
});
