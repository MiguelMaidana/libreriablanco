export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildProductInquiryMessage(productName: string, productUrl: string): string {
  return `Hola! Quería consultar sobre "${productName}": ${productUrl}`;
}

export function buildReceiptMessage(template: string, orderNumber: string): string {
  return `${template} Número de pedido: ${orderNumber}.`;
}

export interface ShippingInquiryItem {
  name: string;
  quantity: number;
}

export function buildShippingInquiryMessage(template: string, items: ShippingInquiryItem[]): string {
  if (items.length === 0) {
    return template;
  }
  const itemLines = items.map((item) => `- ${item.name} x ${item.quantity}`).join("\n");
  return `${template}\n\n${itemLines}`;
}
