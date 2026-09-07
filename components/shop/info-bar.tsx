import { Banknote, MessageCircle, Truck } from "lucide-react";

interface InfoBarProps {
  storeEnabled: boolean;
}

export function InfoBar({ storeEnabled }: InfoBarProps) {
  if (!storeEnabled) {
    return (
      <div className="bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
        La tienda está en mantenimiento. Volvé a visitarnos pronto.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 bg-primary px-4 py-3 text-center text-sm text-primary-foreground sm:grid-cols-3">
      <div className="flex items-center justify-center gap-2">
        <Truck className="h-4 w-4" aria-hidden="true" />
        <span>Retirá gratis por nuestro local</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Banknote className="h-4 w-4" aria-hidden="true" />
        <span>Pago por transferencia</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span>¿Necesitás envío? Consultanos por WhatsApp</span>
      </div>
    </div>
  );
}
