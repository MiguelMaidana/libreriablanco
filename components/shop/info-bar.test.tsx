import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoBar } from "./info-bar";

describe("InfoBar", () => {
  it("muestra las 3 columnas de información cuando la tienda está habilitada", () => {
    render(<InfoBar storeEnabled={true} />);
    expect(screen.getByText(/Retirá gratis/i)).toBeInTheDocument();
    expect(screen.getByText(/Pago por transferencia/i)).toBeInTheDocument();
    expect(screen.getByText(/Consultanos por WhatsApp/i)).toBeInTheDocument();
  });

  it("muestra un aviso de mantenimiento cuando la tienda está deshabilitada", () => {
    render(<InfoBar storeEnabled={false} />);
    expect(screen.getByText(/mantenimiento/i)).toBeInTheDocument();
  });
});
