import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("muestra un mensaje amigable en español", () => {
    render(<NotFound />);
    expect(
      screen.getByText("No encontramos esta página."),
    ).toBeInTheDocument();
  });
});
