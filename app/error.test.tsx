import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorPage from "./error";

describe("ErrorPage", () => {
  it("muestra un mensaje amigable, nunca el error técnico crudo", () => {
    const error = Object.assign(new Error("SQL ERROR 23505"), {
      digest: "abc123",
    });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(
      screen.getByText("No pudimos completar la operación."),
    ).toBeInTheDocument();
    expect(screen.queryByText("SQL ERROR 23505")).not.toBeInTheDocument();
  });
});
