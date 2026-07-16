"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <p style={{ fontSize: 48, margin: 0 }}>🩺</p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#071726", marginTop: "1rem" }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#64748b", marginTop: "0.75rem", lineHeight: 1.6 }}>
            Ocurrió un error inesperado en VITAEON. Nuestro equipo ya fue notificado. Puedes intentar de nuevo o contactar a soporte.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: "1.5rem", padding: "0.625rem 1.5rem", borderRadius: 999, background: "#315f7c", color: "#fff", border: "none", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
