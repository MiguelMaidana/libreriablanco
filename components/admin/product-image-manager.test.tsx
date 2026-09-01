import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductImageManager } from "./product-image-manager";

describe("ProductImageManager", () => {
  it("muestra las imágenes existentes con la principal marcada", () => {
    render(
      <ProductImageManager
        productId="prod-1"
        images={[
          { id: "img-1", url: "https://example.com/a.jpg", position: 0, isPrimary: true },
          { id: "img-2", url: "https://example.com/b.jpg", position: 1, isPrimary: false },
        ]}
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("Principal")).toBeInTheDocument();
  });

  it("muestra el input de carga solo si hay menos de 4 imágenes", () => {
    const fourImages = Array.from({ length: 4 }, (_, i) => ({
      id: `img-${i}`,
      url: `https://example.com/${i}.jpg`,
      position: i,
      isPrimary: i === 0,
    }));

    render(<ProductImageManager productId="prod-1" images={fourImages} />);

    expect(screen.queryByLabelText("Subir imagen")).not.toBeInTheDocument();
    expect(screen.getByText("Llegaste al máximo de 4 imágenes.")).toBeInTheDocument();
  });
});
