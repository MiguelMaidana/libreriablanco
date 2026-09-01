import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToggleAvailability = vi.fn().mockResolvedValue({ error: null });
const mockTogglePublished = vi.fn().mockResolvedValue({ error: null });
const mockToggleFeatured = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/app/admin/(protected)/productos/actions", () => ({
  toggleProductAvailability: (...args: unknown[]) => mockToggleAvailability(...args),
  toggleProductPublished: (...args: unknown[]) => mockTogglePublished(...args),
  toggleProductFeatured: (...args: unknown[]) => mockToggleFeatured(...args),
}));

import { ProductQuickActions } from "./product-quick-actions";

describe("ProductQuickActions", () => {
  it("llama a toggleProductAvailability al tocar el switch de disponible", async () => {
    const user = userEvent.setup();
    render(
      <ProductQuickActions
        productId="prod-1"
        available={true}
        isPublished={false}
        isFeatured={false}
      />,
    );

    await user.click(screen.getByLabelText("Disponible"));

    expect(mockToggleAvailability).toHaveBeenCalledWith("prod-1", false);
  });

  it("llama a toggleProductFeatured al tocar 'Destacar'", async () => {
    const user = userEvent.setup();
    render(
      <ProductQuickActions
        productId="prod-1"
        available={true}
        isPublished={true}
        isFeatured={false}
      />,
    );

    await user.click(screen.getByText("Destacar"));

    expect(mockToggleFeatured).toHaveBeenCalledWith("prod-1", true);
  });
});
