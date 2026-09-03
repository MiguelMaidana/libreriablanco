import { describe, it, expect } from "vitest";
import { buildOrderContactMessage } from "./whatsapp";

describe("buildOrderContactMessage", () => {
  it("arma el mensaje con el nombre del cliente y el número de pedido", () => {
    expect(buildOrderContactMessage("María", "LB-1042")).toBe(
      "Hola María! Te escribo por tu pedido #LB-1042.",
    );
  });
});
