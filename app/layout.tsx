import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Vitrina CR | Catálogo de Jean Carlos",
  description: "Cartas de Magic: The Gathering disponibles en Costa Rica, con precios en colones y consulta directa por WhatsApp.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className="antialiased">{children}</body></html>;
}
