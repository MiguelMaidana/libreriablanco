import { describe, it, expect } from "vitest";
import { buildOrderContactMessage, normalizeArgentinePhone } from "./whatsapp";

describe("buildOrderContactMessage", () => {
  it("arma el mensaje con el nombre del cliente y el número de pedido", () => {
    expect(buildOrderContactMessage("María", "LB-1042")).toBe(
      "Hola María! Te escribo por tu pedido #LB-1042.",
    );
  });
});

describe("normalizeArgentinePhone", () => {
  it("antepone 549 a un número local sin código de país", () => {
    // "11 2345-6789" -> dígitos "1123456789" -> no empieza con 54, 0 ni 15
    // -> se antepone "549" -> "5491123456789".
    expect(normalizeArgentinePhone("11 2345-6789")).toBe("5491123456789");
  });

  it("devuelve un número que ya viene en formato internacional sin cambios", () => {
    expect(normalizeArgentinePhone("5491123456789")).toBe("5491123456789");
  });

  it("solo quita el 0 de larga distancia, no el 15 intercalado en medio", () => {
    // "011 15-2345-6789" -> dígitos "0111523456789" -> se quita el "0"
    // inicial -> "111523456789" (empieza con "11", no con "15", así que
    // el "15" del medio no se recorta) -> se antepone "549"
    // -> "549111523456789".
    expect(normalizeArgentinePhone("011 15-2345-6789")).toBe("549111523456789");
  });
});
