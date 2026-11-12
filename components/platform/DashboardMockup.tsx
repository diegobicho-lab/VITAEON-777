"use client";

/**
 * DashboardMockup — Miniatura de la interfaz VITAEON para el hero.
 * JSX puro, sin Canvas. Escala con CSS transform para verse nítido
 * en todos los tamaños del blob de fondo.
 */

export default function DashboardMockup() {
  return (
    <div
      className="h-full w-full overflow-hidden flex flex-col"
      style={{ fontFamily: "inherit" }}
    >
      {/* ── Barra superior ─────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
        {/* Logo wordmark */}
        <span
          className="font-bold tracking-tight text-white"
          style={{ fontSize: "10px", letterSpacing: "0.08em" }}
        >
          VITAEON
        </span>
        {/* Avatar */}
        <div
          className="rounded-full bg-[#1e9bd4]/60 flex items-center justify-center font-semibold text-white/90 border border-white/20"
          style={{ width: 22, height: 22, fontSize: "7px" }}
        >
          DP
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3 py-2.5 flex-1 min-h-0">

        {/* ── Greeting ───────────────────────────────────── */}
        <div>
          <p style={{ fontSize: "7px" }} className="text-white/45 uppercase tracking-widest">
            Bienvenido de vuelta
          </p>
          <p style={{ fontSize: "11px" }} className="font-semibold text-white mt-0.5">
            Dr. Diego Peña
          </p>
        </div>

        {/* ── Próxima cita ────────────────────────────────── */}
        <div
          className="rounded-xl border border-[#1e9bd4]/35 flex flex-col gap-1.5 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg,rgba(30,155,212,0.18) 0%,rgba(7,23,38,0.55) 100%)",
            padding: "9px 10px",
          }}
        >
          {/* Glow accent */}
          <div
            className="absolute -top-4 -right-4 rounded-full bg-[#1e9bd4]/20 blur-xl"
            style={{ width: 48, height: 48 }}
          />

          <p
            style={{ fontSize: "6.5px" }}
            className="text-[#7dd3fc]/80 uppercase tracking-widest font-medium"
          >
            Próxima cita
          </p>

          <div className="flex items-center gap-2">
            {/* Avatar médico */}
            <div
              className="rounded-full bg-[#1e9bd4]/40 border border-[#7dd3fc]/30 flex items-center justify-center text-white/80 font-bold flex-shrink-0"
              style={{ width: 28, height: 28, fontSize: "8px" }}
            >
              ✓
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: "9px" }} className="font-semibold text-white leading-tight">
                Cardiología
              </p>
              <p style={{ fontSize: "7px" }} className="text-white/55 leading-tight mt-0.5">
                Mañana · 10:30 AM
              </p>
            </div>
            {/* Badge */}
            <span
              className="rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/25 flex-shrink-0"
              style={{ fontSize: "6px", padding: "2px 5px" }}
            >
              Confirmada
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-white/8 pt-1.5">
            <div className="flex items-center gap-1">
              {/* Location dot */}
              <div className="h-1.5 w-1.5 rounded-full bg-[#1e9bd4]/80 flex-shrink-0" />
              <p style={{ fontSize: "6.5px" }} className="text-white/45 truncate">
                Consultorio verificado
              </p>
            </div>
          </div>
        </div>

        {/* ── Especialidades ──────────────────────────────── */}
        <div>
          <p
            style={{ fontSize: "6.5px" }}
            className="text-white/45 uppercase tracking-widest mb-1.5"
          >
            Especialidades
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: "Cardiología",  color: "bg-rose-400/15   border-rose-400/25   text-rose-200"   },
              { label: "Neurología",   color: "bg-violet-400/15 border-violet-400/25 text-violet-200" },
              { label: "Pediatría",    color: "bg-sky-400/15    border-sky-400/25    text-sky-200"    },
              { label: "Ortopedia",   color: "bg-amber-400/15  border-amber-400/25  text-amber-200"  },
            ].map(({ label, color }) => (
              <span
                key={label}
                className={`rounded-full border ${color}`}
                style={{ fontSize: "6.5px", padding: "2.5px 7px" }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/*
          Aquí había dos médicos inventados con calificación y número de reseñas,
          y debajo una barra que afirmaba "127 Médicos · 4.9★ · 36 Especialidades".
          La propia página admite seiscientos píxeles más abajo que está
          incorporando especialistas a la beta privada, así que el visitante leía
          la promesa y el desmentido en el mismo scroll.

          En su lugar va lo que sí es cierto y además es la tesis del producto:
          nadie aparece sin que administración revise su cédula.
        */}
        <div className="flex-1 min-h-0 flex flex-col">
          <p
            style={{ fontSize: "6.5px" }}
            className="text-white/45 uppercase tracking-widest mb-1.5"
          >
            Antes de aparecer aquí
          </p>
          <div className="flex flex-col gap-1">
            {[
              "Cédula profesional revisada",
              "Hospital y consultorio confirmados",
              "Pago protegido hasta la consulta"
            ].map((linea) => (
              <div
                key={linea}
                className="rounded-lg border border-white/10 flex items-center gap-1.5"
                style={{ background: "rgba(255,255,255,0.05)", padding: "6px 7px" }}
              >
                <span
                  className="rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center flex-shrink-0"
                  style={{ width: 11, height: 11, fontSize: "7px" }}
                >
                  ✓
                </span>
                <p style={{ fontSize: "7px" }} className="text-white/70 leading-tight">
                  {linea}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Una sola línea cierta, en lugar de tres cifras que no lo son. */}
        <div
          className="rounded-xl border border-white/8 mt-auto flex items-center justify-center gap-1.5"
          style={{ background: "rgba(255,255,255,0.04)", padding: "7px 4px" }}
        >
          <span className="h-1 w-1 rounded-full bg-emerald-400 flex-shrink-0" />
          <span style={{ fontSize: "6.5px" }} className="text-white/55 tracking-wide">
            Red privada · León, Gto.
          </span>
        </div>

      </div>

      {/* ── Bottom nav bar ──────────────────────────────── */}
      <div
        className="flex items-center justify-around border-t border-white/8"
        style={{ padding: "6px 0 8px" }}
      >
        {[
          /* home */
          <svg key="home" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e9bd4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
          /* calendar */
          <svg key="cal" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
          /* search */
          <svg key="srch" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
          /* person */
          <svg key="pers" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
        ].map((icon) => (
          <div key={(icon as React.ReactElement).key} className="p-1">
            {icon}
          </div>
        ))}
      </div>
    </div>
  );
}
