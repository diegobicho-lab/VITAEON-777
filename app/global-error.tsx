"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ padding: 32, fontFamily: "monospace", background: "#f8f9fa" }}>
        <h2 style={{ color: "#c0392b", marginBottom: 16 }}>🔴 Error capturado — diagnóstico VITAEON</h2>
        <p><strong>Mensaje:</strong> {error.message || "(sin mensaje)"}</p>
        {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
        <pre style={{
          background: "#1e1e1e", color: "#f8f8f2", padding: 16,
          borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 11,
          maxWidth: "100%", overflow: "auto", marginTop: 16
        }}>
          {error.stack || "(sin stack trace)"}
        </pre>
        <button
          onClick={reset}
          style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
