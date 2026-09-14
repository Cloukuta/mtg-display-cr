import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Display CR | Jean Carlos's Card Catalog",
  description: "Magic: The Gathering cards available in Costa Rica, priced in colones with direct WhatsApp inquiries.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
