import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { FavoritesProvider } from "@/contexts/FavoritesContext";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#7c7c7b",
};

export const metadata: Metadata = {
  title: "Bageatteria — Меню",
  description: "Кофейня Bageatteria. Свежая выпечка и ароматный кофе.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${montserrat.variable} font-sans antialiased`}>
        <FavoritesProvider>{children}</FavoritesProvider>
      </body>
    </html>
  );
}
