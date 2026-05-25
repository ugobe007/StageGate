import StageGateLogo from "@/components/StageGateLogo";
import { BRAND } from "@/lib/brand";

export default function LogoPreview() {
  return (
    <div style={{ minHeight: "100vh", background: BRAND.nearBlack, color: BRAND.white, padding: "2rem" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.35rem", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
        StageGate brand mark
      </h1>
      <p style={{ color: BRAND.midGray, marginBottom: "2rem", fontSize: "0.9rem" }}>
        Official [S/G] icon and STAGE/GATE lockup · Emerald {BRAND.emerald}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", maxWidth: "960px" }}>
        {[
          { label: "Nav icon · 32px", props: { size: 32, variant: "icon" as const } },
          { label: "Footer lockup · 64px", props: { size: 64, variant: "lockup" as const } },
          { label: "Hero lockup · 128px", props: { size: 128, variant: "lockup" as const } },
        ].map(({ label, props }) => (
          <div
            key={label}
            style={{
              border: `1px solid ${BRAND.lightGray}22`,
              borderRadius: "12px",
              padding: "1.5rem",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              minHeight: "150px",
              justifyContent: "center",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.midGray }}>
              {label}
            </span>
            <StageGateLogo theme="dark" {...props} />
          </div>
        ))}

        <div
          style={{
            border: `1px solid ${BRAND.lightGray}`,
            borderRadius: "12px",
            padding: "1.5rem",
            background: BRAND.white,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            minHeight: "150px",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.midGray }}>
            Light · lockup 64px
          </span>
          <StageGateLogo size={64} variant="lockup" theme="light" />
        </div>

        <div
          style={{
            borderRadius: "12px",
            padding: "1.5rem",
            background: BRAND.deepGreen,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            minHeight: "150px",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
            Deep green · icon 32px
          </span>
          <StageGateLogo size={32} variant="icon" theme="dark" />
        </div>
      </div>

      <div
        style={{
          marginTop: "2rem",
          maxWidth: "960px",
          border: `1px solid ${BRAND.lightGray}22`,
          borderRadius: "16px",
          padding: "2.5rem",
          background: `linear-gradient(105deg, ${BRAND.nearBlack}f7, ${BRAND.nearBlack}88)`,
        }}
      >
        <StageGateLogo size={128} variant="lockup" theme="dark" style={{ display: "block", marginBottom: "1.5rem" }} />
        <p style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.05em", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Your Robot
          <br />
          <span style={{ color: BRAND.emerald }}>Performs.</span>
        </p>
      </div>
    </div>
  );
}
