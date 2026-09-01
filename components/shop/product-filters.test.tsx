import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/productos",
  useSearchParams: () => mockSearchParams,
}));

import { ProductFilters } from "./product-filters";

describe("ProductFilters", () => {
  it("muestra las categorías recibidas como opciones", async () => {
    const user = userEvent.setup();
    render(<ProductFilters categories={[{ slug: "escolar", name: "Escolar" }]} />);

    await user.click(screen.getByRole("combobox", { name: /categoría/i }));

    expect(await screen.findByText("Escolar")).toBeInTheDocument();
  });
});
