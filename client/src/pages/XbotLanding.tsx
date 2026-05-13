import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const STEPS = [
  { num: "01", title: "Robot Profile", desc: "Make, model, dimensions, weight, power requirements, and special handling notes." },
  { num: "02", title: "Origin & Shipping", desc: "Origin country and city, shipping method (air/sea/ground), flight or vessel number, ETA, and port of entry." },
  { num: "03", title: "Customs", desc: "HS code (XBOT suggests if unknown), ATA Carnet eligibility, and customs broker preference." },
  { num: "04", title: "Target Show", desc: "Select your Las Vegas trade show, booth number, and setup/teardown dates." },
  { num: "05", title: "Services", desc: "Dockside handling, ground transport, warehousing, staging, activation, and promotional support." },
  { num: "06", title: "Contacts", desc: "Primary, on-site, and emergency contacts for the logistics team." },
];

const OUTPUTS = [
  { num: "A", title: "Logistics Timeline", desc: "Date-by-date plan from ship-by deadline through teardown, with critical milestones flagged." },
  { num: "B", title: "Customs Checklist", desc: "Required documents and steps for US customs clearance, specific to your robot type and origin country." },
  { num: "C", title: "Service Package", desc: "Confirmed list of StageGate services included in your logistics plan, with pricing guidance." },
  { num: "D", title: "Ground Transport Options", desc: "Vetted Las Vegas carriers with rate estimates and StageGate-managed drayage options." },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  brief_generated: "Brief Ready",
  submitted: "Submitted",
  in_progress: "In Progress",
  completed: "Completed",
};

const SESSION_KEY = "xbot_session_token";
const PROJECT_KEY = "xbot_project_id";
const BANNER_DISMISSED_KEY = "xbot_resume_banner_dismissed";

export default function XbotLanding() {
  const { user, isAuthenticated } = useAuth();
  const { data: projectsData } = trpc.xbot.listProjects.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Resume banner: detect unfinished draft in localStorage
  const [resumeBanner, setResumeBanner] = useState<{
    projectId: number;
    token: string;
  } | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(BANNER_DISMISSED_KEY)) return;
    const token = localStorage.getItem(SESSION_KEY);
    const rawId = localStorage.getItem(PROJECT_KEY);
    if (token && rawId) {
      const projectId = parseInt(rawId, 10);
      if (!isNaN(projectId)) {
        setResumeBanner({ projectId, token });
        setBannerVisible(true);
      }
    }
  }, []);

  function dismissBanner() {
    setBannerVisible(false);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "1");
  }

  return (
    <div style={{ background: "#080808", color: "#ececec", minHeight: "100vh" }}>
      <Navbar />

      {/* ── Resume Banner ─────────────────────────────────────────────────── */}
      {bannerVisible && resumeBanner && (
        <div
          style={{
            borderBottom: "1px solid rgba(0,255,135,0.18)",
            background: "rgba(0,255,135,0.04)",
            padding: "0.75rem 0",
          }}
        >
          <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.625rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#00ff87",
                  flexShrink: 0,
                }}
              >
                Draft saved
              </span>
              <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.65)" }}>
                You have an unfinished logistics plan. Pick up where you left off.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
              <Link href={`/xbot/project/${resumeBanner.projectId}`}>
                <button
                  className="btn-primary"
                  style={{ padding: "0.4rem 1rem", fontSize: "0.75rem" }}
                >
                  Continue <ArrowRight size={13} />
                </button>
              </Link>
              <button
                onClick={dismissBanner}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.30)",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.70)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.30)")}
                aria-label="Dismiss banner"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO — problem statement ─────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0 6rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "start" }}>
            {/* Left — editorial problem statement */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2.5rem" }}>
                <span className="badge-emerald">XBOT</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                  Automated Logistics Intelligence
                </span>
              </div>

              <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.05em", marginBottom: "2.5rem" }}>
                Your robot is<br />
                sitting in a crate.<br />
                <span style={{ color: "rgba(255,255,255,0.28)" }}>Customs paperwork</span><br />
                <span style={{ color: "rgba(255,255,255,0.28)" }}>is missing.</span>
              </h1>

              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: "1rem", maxWidth: "46ch" }}>
                The show opens in 72 hours. Your freight broker has never handled a humanoid. The ATA Carnet is in the wrong format. Ground transport hasn't confirmed.
              </p>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: "46ch" }}>
                XBOT fixes this. Tell it about your robot and your route. In under 60 seconds it generates a complete logistics brief — customs checklist, timeline, service package, and ground transport options — tailored to your specific hardware.
              </p>

              <Link href="/xbot/new">
                <button className="btn-primary" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem" }}>
                  Start Logistics Intake <ArrowRight size={15} />
                </button>
              </Link>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "rgba(255,255,255,0.18)", marginTop: "1rem" }}>
                No account required · Auto-saved to your browser
              </p>
            </div>

            {/* Right — what you get, inline text */}
            <div style={{ paddingTop: "5rem" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)", marginBottom: "1.5rem" }}>
                What XBOT generates
              </p>
              {OUTPUTS.map((out, i) => (
                <div key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "1.25rem 0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "1.25rem", marginBottom: "0.4rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(0,255,135,0.45)", flexShrink: 0, minWidth: "1rem" }}>{out.num}</span>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#fff" }}>{out.title}</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.6, paddingLeft: "2.25rem" }}>{out.desc}</p>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "1.25rem" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "rgba(255,255,255,0.20)", fontStyle: "italic" }}>
                  Generated in under 60 seconds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6-STEP INTAKE ────────────────────────────────────────────────────── */}
      <section style={{ padding: "7rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1rem" }}>
            The Intake Process
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "4rem", maxWidth: "28ch" }}>
            Six steps. One brief. Complete logistics clarity.
          </h2>

          {/* Horizontal ruled list — no cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{
                borderLeft: i % 3 === 0 ? "none" : "1px solid rgba(255,255,255,0.07)",
                borderTop: i >= 3 ? "1px solid rgba(255,255,255,0.07)" : "none",
                padding: "2rem " + (i % 3 < 2 ? "2rem" : "0") + " 2rem " + (i % 3 === 0 ? "0" : "2rem"),
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.75rem", fontWeight: 700, color: "rgba(255,255,255,0.05)", letterSpacing: "-0.05em", lineHeight: 1, marginBottom: "1.25rem" }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>{step.title}</h3>
                <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <Link href="/xbot/new">
              <button className="btn-primary">Begin Intake <ArrowRight size={14} /></button>
            </Link>
            <a href="http://www.meetup.com/events/ical/12604938/a97f35faab6d3193ae3a0a599d9fc521a423f275/going?t=1376143930" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.75rem 1.5rem", border: "1px solid #f59e0b", color: "#f59e0b", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}>
              Schedule a Call <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — inline, no cards ──────────────────────────────────── */}
      <section style={{ padding: "7rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "start" }}>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1rem" }}>
                How XBOT Works
              </p>
              <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 2.75rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "1.5rem" }}>
                AI-generated logistics intelligence, not a generic form.
              </h2>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.40)", lineHeight: 1.7, maxWidth: "44ch" }}>
                XBOT doesn't just collect your information — it reasons about your specific robot, route, and show to generate a logistics brief that a human expert would produce after hours of research. Customs requirements change by country, by robot type, by show. XBOT knows this.
              </p>
            </div>
            <div>
              {[
                { label: "Customs intelligence", desc: "HS code suggestions, ATA Carnet eligibility checks, and country-specific import requirements — all pre-computed for your robot type." },
                { label: "Timeline generation", desc: "Working backwards from your show date, XBOT calculates every ship-by, clear-by, and setup deadline with buffer for delays." },
                { label: "Service matching", desc: "Based on your robot's specs and your selected show, XBOT recommends the right StageGate service package." },
                { label: "Transport options", desc: "Las Vegas drayage, warehouse-to-booth ground transport, and vetted carrier options with rate estimates." },
              ].map((item, i) => (
                <div key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "1.25rem 0" }}>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#fff", marginBottom: "0.35rem" }}>{item.label}</div>
                  <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.65 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SAVED PROJECTS (authenticated users) ─────────────────────────────── */}
      {isAuthenticated && projectsData && projectsData.projects.length > 0 && (
        <section style={{ padding: "6rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="container">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "0.75rem" }}>
                  Your Projects
                </p>
                <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                  Saved logistics briefs
                </h2>
              </div>
              <Link href="/xbot/new">
                <button className="btn-primary" style={{ fontSize: "0.75rem", padding: "0.5rem 1.25rem" }}>New Intake <ArrowRight size={12} /></button>
              </Link>
            </div>

            <div>
              {projectsData.projects.map((project, i) => (
                <div key={project.id} style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "1.25rem 0", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.18)", minWidth: "1.5rem" }}>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#fff", marginBottom: "0.2rem" }}>
                        {project.robotMake || "Unnamed Robot"} {project.robotModel || ""}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "rgba(255,255,255,0.25)" }}>
                        {STATUS_LABELS[project.status] ?? project.status} · {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </div>
                    </div>
                  </div>
                  <Link href={`/xbot/project/${project.id}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#00ff87", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    View brief <ArrowUpRight size={12} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1.5rem" }}>
            Ready?
          </p>
          <h2 style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.05em", marginBottom: "2rem", maxWidth: "18ch" }}>
            Stop scrambling.<br />
            <span style={{ color: "#00ff87" }}>Start with XBOT.</span>
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.35)", maxWidth: "44ch", lineHeight: 1.65, marginBottom: "2.5rem" }}>
            No account required. Complete the 6-step intake and get your logistics brief in under 60 seconds.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/xbot/new">
              <button className="btn-primary" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem" }}>
                Start Logistics Intake <ArrowRight size={15} />
              </button>
            </Link>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Back to StageGate <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
