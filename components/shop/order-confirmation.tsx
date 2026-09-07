import Link from "next/link";
import { formatPrice } from "@/lib/shop/format";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "./whatsapp-button";

export interface OrderConfirmationItem {
  id: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderConfirmationSettings {
  whatsappNumber: string | null;
  receiptMessage: string | null;
  generalMessage: string | null;
  transferAlias: string | null;
  transferCbuCvu: string | null;
  transferBankOrWallet: string | null;
  transferAccountHolder: string | null;
  transferInstructions: string | null;
  address: string | null;
  businessHours: string | null;
  pickupInstructions: string | null;
}

interface OrderConfirmationProps {
  orderNumber: string;
  items: OrderConfirmationItem[];
  total: number;
  settings: OrderConfirmationSettings;
}

export function OrderConfirmation({ orderNumber, items, total, settings }: OrderConfirmationProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">¡Gracias por tu compra!</h1>
      <p className="text-lg">
        Pedido <span className="font-semibold">{orderNumber}</span>
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>{`${item.productNameSnapshot} x${item.quantity}`}</span>
              <span>{formatPrice(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <p className="text-lg font-semibold">Total: {formatPrice(total)}</p>
      </section>

      <section className="flex flex-col gap-2 rounded border p-4">
        <h2 className="text-lg font-semibold">Datos para transferir</h2>
        {settings.transferBankOrWallet && <p>{settings.transferBankOrWallet}</p>}
        {settings.transferAlias && <p>Alias: {settings.transferAlias}</p>}
        {settings.transferCbuCvu && <p>CBU/CVU: {settings.transferCbuCvu}</p>}
        {settings.transferAccountHolder && <p>Titular: {settings.transferAccountHolder}</p>}
        {settings.transferInstructions && (
          <p className="text-sm text-muted-foreground">{settings.transferInstructions}</p>
        )}
      </section>

      {(settings.address || settings.businessHours || settings.pickupInstructions) && (
        <section className="flex flex-col gap-1 text-sm text-muted-foreground">
          <h2 className="text-lg font-semibold">Retiro</h2>
          {settings.address && <p>{settings.address}</p>}
          {settings.businessHours && <p>{settings.businessHours}</p>}
          {settings.pickupInstructions && <p>{settings.pickupInstructions}</p>}
        </section>
      )}

      {settings.whatsappNumber && settings.receiptMessage && (
        <Button asChild>
          <a
            href={buildWhatsAppUrl(settings.whatsappNumber, settings.receiptMessage)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviar comprobante por WhatsApp
          </a>
        </Button>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          No existe seguimiento público de pedidos. Cualquier consulta, escribinos por WhatsApp.
        </p>
        <WhatsAppButton
          phoneNumber={settings.whatsappNumber}
          message={settings.generalMessage ?? "Hola! Quería hacer una consulta."}
          label="Consultar por WhatsApp"
        />
      </div>

      <Link href="/" className="text-sm underline">
        Volver a la tienda
      </Link>
    </div>
  );
}
