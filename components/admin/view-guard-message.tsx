interface ViewGuardMessageProps {
  title: string;
  message: string;
}

export function ViewGuardMessage({ title, message }: ViewGuardMessageProps) {
  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl">{title}</h1>
      <p className="text-destructive">{message}</p>
    </main>
  );
}
