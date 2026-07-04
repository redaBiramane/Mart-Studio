import type { Metadata } from "next";
import "./globals.css";
import ErrorReporter from "./components/ErrorReporter";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://martstudio.it.com";
const TITLE = "Mart Studio — Atelier IA de conception Data Product";
const DESCRIPTION =
  "Concevez votre Data Product avec l'accompagnement d'un Senior Data Architect IA. Modélisation, MCD/ERD, SQL, dbt, documentation et préparation DAD.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — Mart Studio" },
  description: DESCRIPTION,
  applicationName: "Mart Studio",
  keywords: ["Data Product", "data modeling", "MCD", "ERD", "SQL", "dbt", "Snowflake", "data architecture", "IA", "Sofinco"],
  authors: [{ name: "Mart Studio" }],
  icons: { icon: "/icon.svg", apple: "/mart-icon.svg" },
  openGraph: {
    type: "website",
    siteName: "Mart Studio",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
