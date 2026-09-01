import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "./product-card";
import type { ShopProduct } from "@/lib/shop/products";

const baseProduct: ShopProduct = {
  id: "p1",
  slug: "cuaderno-a4",
  name: "Cuaderno A4",
  price: 1500,
  is_new: false,
  is_featured: false,
  imageUrl: null,
} as ShopProduct;

describe("ProductCard", () => {
  it("muestra el nombre y el precio formateado (no texto literal '${...}')", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("Cuaderno A4")).toBeInTheDocument();
    expect(screen.getByText(/\$\s*1\.500/)).toBeInTheDocument();
  });

  it("enlaza a /productos/[slug]", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/productos/cuaderno-a4");
  });

  it("muestra el badge Nuevo solo cuando is_new es true", () => {
    render(<ProductCard product={{ ...baseProduct, is_new: true }} />);
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
  });

  it("no muestra ningún badge cuando is_new e is_featured son false", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
    expect(screen.queryByText("Destacado")).not.toBeInTheDocument();
  });
});
