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
