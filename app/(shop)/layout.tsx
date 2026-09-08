import { InfoBar } from "@/components/shop/info-bar";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { WhatsAppFloatingButton } from "@/components/shop/whatsapp-floating-button";
import { CartProvider } from "@/components/shop/cart-provider";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/shop/settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [settings, { data: categories }] = await Promise.all([
    getSettings(),
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <InfoBar storeEnabled={settings?.store_enabled ?? true} />
        <Header logoUrl={settings?.logo_url ?? null} categories={categories ?? []} />
        <main className="flex-1">{children}</main>
        <Footer
          settings={{
            businessName: settings?.business_name ?? null,
            address: settings?.address ?? null,
            phone: settings?.phone ?? null,
            businessHours: settings?.business_hours ?? null,
            facebookUrl: settings?.facebook_url ?? null,
            instagramUrl: settings?.instagram_url ?? null,
          }}
        />
        <WhatsAppFloatingButton
          phoneNumber={settings?.whatsapp_number ?? null}
          message={settings?.whatsapp_general_message ?? "Hola! Quería hacer una consulta."}
        />
      </div>
    </CartProvider>
  );
}
