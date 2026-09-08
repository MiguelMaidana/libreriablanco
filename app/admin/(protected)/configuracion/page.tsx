import { getSettings } from "@/lib/shop/settings";
import { getViewAccess } from "@/lib/auth/permissions";
import { SettingsForm } from "@/components/admin/settings-form";
import { SettingsImageUpload } from "@/components/admin/settings-image-upload";
import { ViewGuardMessage } from "@/components/admin/view-guard-message";
import { uploadLogo, uploadHeroImage } from "./image-actions";

export default async function SettingsPage() {
  const { allowed, admin } = await getViewAccess("configuracion");
  if (!admin) {
    return <ViewGuardMessage title="Configuración" message="No pudimos verificar tu sesión." />;
  }
  if (!allowed) {
    return (
      <ViewGuardMessage title="Configuración" message="No tenés permiso para ver esta página." />
    );
  }

  const settings = await getSettings();

  if (!settings) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl">Configuración</h1>
        <p className="text-destructive">
          No pudimos cargar la configuración. Recargá la página para volver a intentar.
        </p>
      </main>
    );
  }

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
