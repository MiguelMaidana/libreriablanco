import { getSettings } from "@/lib/shop/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { SettingsImageUpload } from "@/components/admin/settings-image-upload";
import { uploadLogo, uploadHeroImage } from "./image-actions";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <main className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl">Configuración</h1>
      <SettingsForm settings={settings} />
      <section className="flex max-w-2xl flex-col gap-6 border-t pt-6">
        <h2 className="text-lg font-medium">Imágenes</h2>
        <SettingsImageUpload
          label="Logo"
          currentUrl={settings?.logo_url ?? null}
          uploadAction={uploadLogo}
        />
        <SettingsImageUpload
          label="Imagen del Hero"
          currentUrl={settings?.hero_image_url ?? null}
          uploadAction={uploadHeroImage}
        />
      </section>
    </main>
  );
}
