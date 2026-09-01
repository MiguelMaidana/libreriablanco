import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductGallery } from "./product-gallery";

describe("ProductGallery", () => {
  it("muestra un placeholder si no hay imágenes", () => {
    const { container } = render(<ProductGallery images={[]} alt="Producto" />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("muestra la primera imagen como principal y permite cambiarla con las miniaturas", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        images={["https://example.com/a.jpg", "https://example.com/b.jpg"]}
        alt="Producto"
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("src", expect.stringContaining("example.com"));

    const thumbnails = screen.getAllByRole("button");
    await user.click(thumbnails[1]!);

    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", expect.stringContaining("example.com"));
  });
});
