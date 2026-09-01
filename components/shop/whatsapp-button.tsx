import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/shop/whatsapp";

interface WhatsAppButtonProps {
  phoneNumber: string | null;
  message: string;
  label?: string;
}

export function WhatsAppButton({ phoneNumber, message, label = "WhatsApp" }: WhatsAppButtonProps) {
  if (!phoneNumber) {
    return null;
  }

  return (
    <Button asChild variant="outline">
      <a href={buildWhatsAppUrl(phoneNumber, message)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-4" />
        {label}
      </a>
    </Button>
  );
}
