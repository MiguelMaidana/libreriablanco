export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl">Tu cuenta no tiene acceso</h1>
      <p className="text-muted-foreground">
        Iniciaste sesión, pero tu usuario no está habilitado en Librería
        Blanco. Consultá con quien administra el sistema.
      </p>
    </main>
  );
}
