import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({
          data: { status: "ok" },
          error: null,
        }),
      }),
    }),
  })),
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("muestra el nombre de la librería como título", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("heading", { name: "Librería Blanco" }),
    ).toBeInTheDocument();
  });

  it("muestra un botón primario de ejemplo", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("button", { name: "Ver productos" }),
    ).toBeInTheDocument();
  });

  it("muestra el estado de la conexión a Supabase", async () => {
    render(await HomePage());
    expect(screen.getByText(/Conexión a Supabase: ok/)).toBeInTheDocument();
  });
});
