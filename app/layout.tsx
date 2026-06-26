import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mart Studio — Atelier IA de conception Data Product",
  description: "Concevez votre Data Product avec l'accompagnement d'un Senior Data Architect IA. Modélisation, documentation, gouvernance et préparation DAD.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
