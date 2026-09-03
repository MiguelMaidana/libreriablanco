export function buildOrderContactMessage(firstName: string, orderNumber: string): string {
  return `Hola ${firstName}! Te escribo por tu pedido #${orderNumber}.`;
}
