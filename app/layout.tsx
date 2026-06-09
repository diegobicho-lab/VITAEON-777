import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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
  openGraph: {
    title: "VITAEON | Medicina privada premium",
    description: "Especialistas verificados, agenda médica y experiencia digital de alto nivel.",
    type: "website",
    locale: "es_MX",
    siteName: "VITAEON"
  }
};

export const viewport: Viewport = {
  themeColor: "#071726",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
