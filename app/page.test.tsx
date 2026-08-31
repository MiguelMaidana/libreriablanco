import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("muestra el nombre de la librería", () => {
    render(<HomePage />);
    expect(screen.getByText("Librería Blanco")).toBeInTheDocument();
  });
});
