import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Librería Blanco",
  description: "Útiles, papelería y más — Librería Blanco",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
