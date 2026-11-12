import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

/**
 * Las dos familias de la marca estaban nombradas en `tailwind.config.ts` y en
 * `globals.css` como `var(--font-sans)` y `var(--font-serif)`, pero ningún
 * archivo las cargaba y esas variables nunca se definían. La página caía a
 * `system-ui`: San Francisco en Mac, Roboto en Android, Segoe en Windows. La
 * marca se veía distinta según quién entrara, y la tipografía es la mayor parte
 * de lo que significa "premium" en una página sin presupuesto fotográfico.
 *
 * `display: "swap"` muestra el texto desde el primer frame con la fuente del
 * sistema y cambia al terminar la descarga: en una consulta médica urgente,
 * texto visible tarde es peor que texto con la fuente equivocada un instante.
 */
const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"]
});

const fontSerif = DM_Serif_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: "400"
});

export const metadata: Metadata = {
  title: {
    default: "VITAEON | Plataforma médica premium",
    template: "%s | VITAEON"
  },
  description:
    "VITAEON conecta pacientes con especialistas médicos verificados, hospitales privados, agenda digital y experiencia clínica premium.",
  applicationName: "VITAEON",
  authors: [{ name: "VITAEON" }],
  robots: {
    index: true,
    follow: true
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png",   sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VITAEON"
  },
  openGraph: {
    title: "VITAEON | Medicina privada premium",
    description: "Especialistas verificados, agenda médica y experiencia digital de alto nivel.",
    type: "website",
    locale: "es_MX",
    siteName: "VITAEON",
    images: [{ url: "/og-logo.png", width: 1200, height: 630, alt: "VITAEON" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#071726",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${fontSans.variable} ${fontSerif.variable}`}>
      <body>
        {children}
        <Suspense fallback={null}><Analytics /></Suspense>
      </body>
    </html>
  );
}
