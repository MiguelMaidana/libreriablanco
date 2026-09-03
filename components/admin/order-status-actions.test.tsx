import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFinalizeOrder = vi.fn();
const mockCancelOrder = vi.fn();

vi.mock("@/app/admin/(protected)/pedidos/actions", () => ({
  finalizeOrder: (...args: unknown[]) => mockFinalizeOrder(...args),
  cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
}));

import { OrderStatusActions } from "./order-status-actions";

describe("OrderStatusActions", () => {
  beforeEach(() => {
    mockFinalizeOrder.mockReset();
    mockCancelOrder.mockReset();
  });

  it("ejecuta finalizeOrder directo al hacer click en Finalizar pedido", async () => {
    mockFinalizeOrder.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<OrderStatusActions orderId="order-1" />);

    await user.click(screen.getByRole("button", { name: "Finalizar pedido" }));

    expect(mockFinalizeOrder).toHaveBeenCalledWith("order-1");
    expect(mockCancelOrder).not.toHaveBeenCalled();
  });

  it("pide confirmación antes de cancelar y no ejecuta cancelOrder hasta confirmar", async () => {
    mockCancelOrder.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<OrderStatusActions orderId="order-1" />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mockCancelOrder).not.toHaveBeenCalled();

    expect(await screen.findByText("¿Cancelar este pedido?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sí, cancelar" }));
    expect(mockCancelOrder).toHaveBeenCalledWith("order-1");
  });

  it("no ejecuta cancelOrder si se hace click en Volver", async () => {
    const user = userEvent.setup();
    render(<OrderStatusActions orderId="order-1" />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await screen.findByText("¿Cancelar este pedido?");
    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});
