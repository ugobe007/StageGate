import { ChevronDown } from "lucide-react";
import { HEIF_BENCHMARK, HEIR_PULL_QUOTES, HEIR_REPORTS } from "@/content/heir2026";
import { BRAND } from "@/lib/brand";

/** Collapsed-by-default HEIR appendix — full detail stays in the PDFs. */
export default function HeirResearchAppendix() {
  return (
    <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "3rem 0" }}>
      <div className="container">
        <details style={{ maxWidth: "56rem" }}>
          <summary
            style={{
              display: "flex",
              cursor: "pointer",
              listStyle: "none",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div>
              <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                HEIR 2026 research
              </p>
              <h2 style={{ marginTop: "0.25rem", fontSize: "1.125rem", fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>
                Engineering maturity framework
              </h2>
              <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.40)" }}>
                Demo culture vs deployment reality — HEIF scores, readiness funnel, and vendor analysis in the PDF.
              </p>
            </div>
            <ChevronDown size={20} style={{ color: "rgba(255,255,255,0.30)", flexShrink: 0 }} className="heir-chevron" />
          </summary>

          <div style={{ marginTop: "2rem", fontSize: "0.875rem", lineHeight: 1.7, color: "rgba(255,255,255,0.42)" }}>
            <p style={{ maxWidth: "48rem" }}>
              HEIR measures humanoids by engineering maturity, not demo choreography. The Humanoid Engineering
              Intelligence Framework (HEIF) scores mobility, manipulation, cognition, safety, data pipeline, and
              production readiness from public evidence. No vendor leads every category today.
            </p>

            <ul style={{ marginTop: "1.5rem", maxWidth: "48rem", padding: 0, listStyle: "none" }}>
              {HEIR_PULL_QUOTES.map((q) => (
                <li key={q} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", color: "rgba(255,255,255,0.55)" }}>
                  <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>
                  <span>&ldquo;{q}&rdquo;</span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.8125rem" }}>
              {HEIR_REPORTS.map((r) => (
                <a
                  key={r.href}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 600, color: BRAND.emerald, textDecoration: "underline", textUnderlineOffset: "4px" }}
                >
                  Download {r.title} ↗
                </a>
              ))}
            </div>

            <div style={{ marginTop: "2rem" }}>
              <p style={{ marginBottom: "0.75rem", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)" }}>
                HEIF snapshot · scores out of 4.0 · May 2026
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "32rem", borderCollapse: "collapse", fontSize: "0.75rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.10)", fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.35)" }}>
                      <th style={{ padding: "0.5rem 1rem 0.5rem 0", fontWeight: 500 }}>Company</th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 500 }}>Mob</th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 500 }}>Manip</th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 500 }}>Cog</th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 500 }}>Safety</th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 500 }}>Data</th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 500 }}>Prod</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HEIF_BENCHMARK.map((row) => (
                      <tr key={row.company} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "0.625rem 1rem 0.625rem 0", color: "rgba(255,255,255,0.75)" }}>{row.company}</td>
                        <td style={{ padding: "0.625rem 0.5rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.45)" }}>{row.mobility.toFixed(1)}</td>
                        <td style={{ padding: "0.625rem 0.5rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.45)" }}>{row.manipulation.toFixed(1)}</td>
                        <td style={{ padding: "0.625rem 0.5rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.45)" }}>{row.cognition.toFixed(1)}</td>
                        <td style={{ padding: "0.625rem 0.5rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.45)" }}>{row.safety.toFixed(1)}</td>
                        <td style={{ padding: "0.625rem 0.5rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.45)" }}>{row.dataPipeline.toFixed(1)}</td>
                        <td style={{ padding: "0.625rem 0.5rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.45)" }}>{row.production.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </details>
      </div>

      <style>{`
        details[open] .heir-chevron { transform: rotate(180deg); }
        summary::-webkit-details-marker { display: none; }
      `}</style>
    </section>
  );
}
