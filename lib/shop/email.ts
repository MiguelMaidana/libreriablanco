import { Resend } from "resend";
import { formatPrice } from "./format";

const resend = new Resend(process.env.RESEND_API_KEY);

// Remitente de prueba de Resend — no requiere verificar un dominio propio.
// Migrar a un remitente con dominio propio una vez que la librería tenga uno.
const FROM_ADDRESS = "Librería Blanco <onboarding@resend.dev>";

// Mismos colores que app/globals.css (--primary) y el footer del sitio.
const BRAND_RED = "#dc2626";
const FOOTER_DARK = "#1f1f1f";

export interface OrderEmailItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderEmailSettings {
  transferAlias: string | null;
  transferCbuCvu: string | null;
  transferBankOrWallet: string | null;
  transferAccountHolder: string | null;
  transferInstructions: string | null;
  address: string | null;
  businessHours: string | null;
  pickupInstructions: string | null;
  notificationEmail: string | null;
}

export interface SendOrderConfirmationEmailParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderEmailItem[];
  total: number;
  settings: OrderEmailSettings;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOrderEmailHtml({
  orderNumber,
  customerName,
  items,
  total,
  settings,
}: SendOrderConfirmationEmailParams): string {
  const itemsRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#333;font-size:14px;">${escapeHtml(item.name)} x${item.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;color:#333;font-size:14px;">${formatPrice(item.subtotal)}</td>
        </tr>`,
    )
    .join("");

  const hasTransferData =
    settings.transferBankOrWallet ||
    settings.transferAlias ||
    settings.transferCbuCvu ||
    settings.transferAccountHolder ||
    settings.transferInstructions;

  const transferSection = hasTransferData
    ? `
      <tr>
        <td style="padding:24px 0 0 0;">
          <h2 style="font-size:15px;margin:0 0 8px 0;color:${BRAND_RED};">Datos para transferir</h2>
          <table role="presentation" width="100%" style="font-size:14px;color:#333;">
            ${settings.transferBankOrWallet ? `<tr><td style="padding:2px 0;">${escapeHtml(settings.transferBankOrWallet)}</td></tr>` : ""}
            ${settings.transferAlias ? `<tr><td style="padding:2px 0;">Alias: ${escapeHtml(settings.transferAlias)}</td></tr>` : ""}
            ${settings.transferCbuCvu ? `<tr><td style="padding:2px 0;">CBU/CVU: ${escapeHtml(settings.transferCbuCvu)}</td></tr>` : ""}
            ${settings.transferAccountHolder ? `<tr><td style="padding:2px 0;">Titular: ${escapeHtml(settings.transferAccountHolder)}</td></tr>` : ""}
            ${settings.transferInstructions ? `<tr><td style="padding:2px 0;">${escapeHtml(settings.transferInstructions)}</td></tr>` : ""}
          </table>
        </td>
      </tr>`
    : "";

  const hasPickupData = settings.address || settings.businessHours || settings.pickupInstructions;

  const pickupSection = hasPickupData
    ? `
      <tr>
        <td style="padding:24px 0 0 0;">
          <h2 style="font-size:15px;margin:0 0 8px 0;color:${BRAND_RED};">Retiro</h2>
          <table role="presentation" width="100%" style="font-size:14px;color:#333;">
            ${settings.address ? `<tr><td style="padding:2px 0;">${escapeHtml(settings.address)}</td></tr>` : ""}
            ${settings.businessHours ? `<tr><td style="padding:2px 0;">${escapeHtml(settings.businessHours)}</td></tr>` : ""}
            ${settings.pickupInstructions ? `<tr><td style="padding:2px 0;">${escapeHtml(settings.pickupInstructions)}</td></tr>` : ""}
          </table>
        </td>
      </tr>`
    : "";

  return `
    <table role="presentation" width="100%" style="background-color:#f4f4f5;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:${BRAND_RED};padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:bold;">Librería Blanco</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <table role="presentation" width="100%">
                  <tr>
                    <td>
                      <h1 style="font-size:18px;margin:0 0 4px 0;color:#111;">¡Gracias por tu compra, ${escapeHtml(customerName)}!</h1>
                      <p style="margin:0 0 20px 0;color:#555;font-size:14px;">Pedido <strong>${escapeHtml(orderNumber)}</strong></p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" width="100%" style="border-collapse:collapse;">
                        <tbody>${itemsRows}</tbody>
                      </table>
                      <table role="presentation" width="100%" style="margin-top:8px;">
                        <tr>
                          <td style="font-size:15px;font-weight:bold;color:#111;">Total</td>
                          <td style="font-size:15px;font-weight:bold;color:${BRAND_RED};text-align:right;">${formatPrice(total)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${transferSection}
                  ${pickupSection}
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:${FOOTER_DARK};padding:20px 32px;text-align:center;">
                <span style="color:#d4d4d8;font-size:12px;">Librería Blanco · Sucursal Murguiondo</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}

export async function sendOrderConfirmationEmail(params: SendOrderConfirmationEmailParams): Promise<void> {
  const html = buildOrderEmailHtml(params);
  const subject = `Confirmación de tu pedido ${params.orderNumber}`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [params.customerEmail],
      subject,
      html,
    });
    if (error) {
      console.error("sendOrderConfirmationEmail: Resend returned an error", error);
    }
  } catch (error) {
    console.error("sendOrderConfirmationEmail: error sending customer email", error);
  }

  if (!params.settings.notificationEmail) {
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [params.settings.notificationEmail],
      subject: `Nuevo pedido ${params.orderNumber}`,
      html,
    });
    if (error) {
      console.error("sendOrderConfirmationEmail: Resend returned an error (copia interna)", error);
    }
  } catch (error) {
    console.error("sendOrderConfirmationEmail: error sending internal copy", error);
  }
}
