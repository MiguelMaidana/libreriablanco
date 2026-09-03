export function buildOrderContactMessage(firstName: string, orderNumber: string): string {
  return `Hola ${firstName}! Te escribo por tu pedido #${orderNumber}.`;
}

export function normalizeArgentinePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  // Ya viene con código de país (54) — devolvemos tal cual, asumiendo
  // que quien lo cargó así ya sabía lo que hacía.
  if (digits.startsWith("54")) {
    return digits;
  }

  // Prefijo de larga distancia local ("0" antes del código de área,
  // ej. "011 2345-6789") no tiene sentido en el formato internacional.
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // El "15" que se agrega a los celulares en la marcación local
  // ("11 15-2345-6789") tampoco existe en el formato internacional.
  if (digits.startsWith("15")) {
    digits = digits.slice(2);
  }

  // Anteponemos el código de país (54) + el indicador de celular (9),
  // que WhatsApp requiere para números argentinos.
  return `549${digits}`;
}
