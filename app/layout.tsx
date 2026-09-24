import type { Metadata } from "next";
import "./globals.css";
import "./home-carousel-fixes.css";
import "./card-finishes.css";
import CardFinishEffects from "@/components/CardFinishEffects";
import PrivateRouteBoundary from "@/components/PrivateRouteBoundary";
import AppBackground from "@/components/AppBackground";

export const metadata: Metadata = {
  title: "MTG Display CR | Magic Card Marketplace Costa Rica",
  description: "Create, manage and share your Magic: The Gathering card catalog in Costa Rica.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

const themeScript = `
(function () {
  try {
    var storedTheme = localStorage.getItem("mtg-display-cr-theme");
    var theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;
const languageScript = `
(function () {
  try {
    var storedLanguage = localStorage.getItem("mtg-display-cr-language");
    document.documentElement.lang = storedLanguage === "en" ? "en" : "es";
  } catch (error) { document.documentElement.lang = "es"; }
})();
`;

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="es" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/><script dangerouslySetInnerHTML={{__html:languageScript}}/></head><body className="antialiased"><AppBackground variant="rings-right"/><div className="app-content-layer"><PrivateRouteBoundary>{children}</PrivateRouteBoundary><CardFinishEffects/></div></body></html>;
}
