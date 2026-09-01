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
    // next/image URL-encodes the src into a query string (e.g. /_next/image?url=...),
    // and encodeURIComponent never escapes letters or dots — so the original
    // filename survives literally inside the encoded src. Asserting on "a.jpg"
    // vs "b.jpg" (not just "example.com", which both URLs share) is what actually
    // proves the main image swapped.
    expect(images[0]).toHaveAttribute("src", expect.stringContaining("a.jpg"));

    const thumbnails = screen.getAllByRole("button");
    await user.click(thumbnails[1]!);

    const mainImageAfterClick = screen.getAllByRole("img")[0];
    expect(mainImageAfterClick).toHaveAttribute("src", expect.stringContaining("b.jpg"));
    expect(mainImageAfterClick).not.toHaveAttribute("src", expect.stringContaining("a.jpg"));
  });
});
