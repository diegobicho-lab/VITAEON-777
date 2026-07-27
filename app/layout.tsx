import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
    <html lang="es">
      <body>
        {children}
        <Suspense fallback={null}><Analytics /></Suspense>
      </body>
    </html>
  );
}
