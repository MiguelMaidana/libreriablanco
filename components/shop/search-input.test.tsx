import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

import { SearchInput } from "./search-input";

describe("SearchInput", () => {
  it("navega a /productos?q=<término> al enviar el formulario", async () => {
    const user = userEvent.setup();
    render(<SearchInput />);

    await user.type(screen.getByPlaceholderText(/Buscar/i), "cuaderno");
    await user.keyboard("{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/productos?q=cuaderno");
  });
});
