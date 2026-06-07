import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  weight: ["400", "500", "600", "700", "800"]
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
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
    <html lang="es" className={`${plusJakarta.variable} ${dmSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
