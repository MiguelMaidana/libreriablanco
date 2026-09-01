import { InfoBar } from "@/components/shop/info-bar";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { getSettings } from "@/lib/shop/settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <InfoBar storeEnabled={settings?.store_enabled ?? true} />
      <Header
        whatsappNumber={settings?.whatsapp_number ?? null}
        whatsappMessage={settings?.whatsapp_general_message ?? null}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
