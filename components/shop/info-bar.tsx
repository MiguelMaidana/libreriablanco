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
    <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
      Retirá gratis por nuestro local · ¿Necesitás envío? Consultanos por WhatsApp
    </div>
  );
}
