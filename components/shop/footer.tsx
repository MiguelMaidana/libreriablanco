export function Footer() {
  return (
    <footer className="border-t p-6 text-center text-sm text-muted-foreground">
      <p>Retiro sin cargo en el local · Pago por transferencia · Mercado Pago próximamente</p>
      <p className="mt-2">{`© ${new Date().getFullYear()} Librería Blanco`}</p>
    </footer>
  );
}
