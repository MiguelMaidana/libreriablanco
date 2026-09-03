"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateSettings, type SettingsActionState } from "@/app/admin/(protected)/configuracion/actions";
import type { Settings } from "@/lib/shop/settings";

interface SettingsFormProps {
  settings: Settings | null;
}

const initialState: SettingsActionState = { error: null };

export function SettingsForm({ settings }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!submittedRef.current || pending) {
      return;
    }
    submittedRef.current = false;
    if (state.error === null) {
      toast.success("Configuración guardada.");
    }
  }, [state, pending]);

  function handleSubmit() {
    submittedRef.current = true;
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Librería</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="businessName">Nombre</Label>
          <Input id="businessName" name="businessName" defaultValue={settings?.business_name ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" name="address" defaultValue={settings?.address ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="businessHours">Horarios</Label>
          <Input id="businessHours" name="businessHours" defaultValue={settings?.business_hours ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={settings?.phone ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={settings?.email ?? ""} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">WhatsApp</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappNumber">Número</Label>
          <Input id="whatsappNumber" name="whatsappNumber" defaultValue={settings?.whatsapp_number ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappGeneralMessage">Mensaje general</Label>
          <Textarea
            id="whatsappGeneralMessage"
            name="whatsappGeneralMessage"
            defaultValue={settings?.whatsapp_general_message ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappReceiptTemplate">Mensaje para comprobante</Label>
          <Textarea
            id="whatsappReceiptTemplate"
            name="whatsappReceiptTemplate"
            defaultValue={settings?.whatsapp_receipt_template ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsappShippingInquiryTemplate">Mensaje para consulta de envío</Label>
          <Textarea
            id="whatsappShippingInquiryTemplate"
            name="whatsappShippingInquiryTemplate"
            defaultValue={settings?.whatsapp_shipping_inquiry_template ?? ""}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Transferencia</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferAlias">Alias</Label>
          <Input id="transferAlias" name="transferAlias" defaultValue={settings?.transfer_alias ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferAccountHolder">Titular</Label>
          <Input
            id="transferAccountHolder"
            name="transferAccountHolder"
            defaultValue={settings?.transfer_account_holder ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferCbuCvu">CBU/CVU</Label>
          <Input id="transferCbuCvu" name="transferCbuCvu" defaultValue={settings?.transfer_cbu_cvu ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferBankOrWallet">Banco/billetera</Label>
          <Input
            id="transferBankOrWallet"
            name="transferBankOrWallet"
            defaultValue={settings?.transfer_bank_or_wallet ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferInstructions">Instrucciones</Label>
          <Textarea
            id="transferInstructions"
            name="transferInstructions"
            defaultValue={settings?.transfer_instructions ?? ""}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Tienda</h2>
        <div className="flex items-center justify-between">
          <Label htmlFor="storeEnabled">Tienda habilitada</Label>
          <Switch id="storeEnabled" name="storeEnabled" defaultChecked={settings?.store_enabled ?? true} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroTitle">Título de Home</Label>
          <Input id="heroTitle" name="heroTitle" defaultValue={settings?.hero_title ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroText">Texto del Hero</Label>
          <Textarea id="heroText" name="heroText" defaultValue={settings?.hero_text ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroCtaText">Texto del botón del Hero</Label>
          <Input id="heroCtaText" name="heroCtaText" defaultValue={settings?.hero_cta_text ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="heroCtaLink">Link del botón del Hero</Label>
          <Input id="heroCtaLink" name="heroCtaLink" defaultValue={settings?.hero_cta_link ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pickupInstructionsText">Instrucciones de retiro</Label>
          <Textarea
            id="pickupInstructionsText"
            name="pickupInstructionsText"
            defaultValue={settings?.pickup_instructions_text ?? ""}
          />
        </div>
      </section>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
