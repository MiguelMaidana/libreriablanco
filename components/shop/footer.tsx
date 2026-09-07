import Link from "next/link";

interface FooterSettings {
  businessName: string | null;
  address: string | null;
  phone: string | null;
  businessHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}

interface FooterProps {
  settings: FooterSettings;
}

function Facebook({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function Instagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.07 1.645.07 4.849 0 3.205-.012 3.584-.07 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z" />
    </svg>
  );
}

export function Footer({ settings }: FooterProps) {
  const { businessName, address, phone, businessHours, facebookUrl, instagramUrl } = settings;
  const hasSocialLinks = Boolean(facebookUrl || instagramUrl);

  return (
    <footer className="border-t p-6 text-sm text-muted-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 text-center md:grid-cols-3 md:text-left">
        <div>
          <p className="font-semibold text-foreground">{businessName ?? "Librería Blanco"}</p>
          <p className="mt-2">Retiro sin cargo en el local · Pago por transferencia · Mercado Pago próximamente</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-foreground">Navegación</p>
          <Link href="/productos" className="hover:underline">
            Productos
          </Link>
          <Link href="/carrito" className="hover:underline">
            Carrito
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-foreground">Contacto</p>
          {address && <p>{address}</p>}
          {businessHours && <p>{businessHours}</p>}
          {phone && <p>{phone}</p>}
          {hasSocialLinks && (
            <div className="mt-1 flex justify-center gap-3 md:justify-start">
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mt-6 text-center">{`© ${new Date().getFullYear()} Librería Blanco`}</p>
    </footer>
  );
}
