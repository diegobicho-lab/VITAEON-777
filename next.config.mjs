import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' es requerido por Next.js 15 App Router: el runtime inyecta
  // scripts de hidratación (__NEXT_DATA__, inline chunks) que no tienen nonce.
  // Eliminarlo sin implementar nonce-based CSP (middleware → layout → script tag)
  // rompe la app completa. Tarea futura: implementar nonce CSP cuando Next.js
  // exponga una API oficial para ello, o migrar a una solución de streaming pura.
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  // Imágenes propias + Supabase storage para fotos de médicos
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  // Stripe API + Vercel Analytics beacon + Supabase API
  "connect-src 'self' https://api.stripe.com https://vitals.vercel-insights.com https://*.supabase.co",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join("; ");

const nextConfig = {
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Allow next/image to optimize images served from Supabase Storage.
    // The *.supabase.co pattern covers both the project-specific URL
    // (e.g. abcxyz.supabase.co) and the custom-domain variant.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**"
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
        ]
      }
    ];
  }
};

export default nextConfig;
