import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import {
  Package, Warehouse, Zap, Wrench, Clock,
  GraduationCap, Monitor, TrendingUp, ArrowRight, CheckCircle2
} from "lucide-react";

/* ── Palette ─────────────────────────────────────────────────────────── */
const BG      = "#080808";
const CARD    = "#111111";
const BORDER  = "#222222";
const GREEN   = "#3ecf8e";
const TEXT_HI  = "#f1f5f9";
const TEXT_MID = "#94a3b8";
const TEXT_DIM = "#64748b";

const SVC_CONFIG: Record<string, { icon: React.ElementType; accent: string }> = {
  "inbound-logistics":       { icon: Package,       accent: "#3b82f6" },
  "warehousing-storage":     { icon: Warehouse,     accent: "#8b5cf6" },
  "staging-activation":      { icon: Zap,           accent: GREEN },
  "live-technical-support":  { icon: Wrench,        accent: "#f59e0b" },
  "stagehand-247":           { icon: Clock,         accent: "#f59e0b" },
  "stagepro-training":       { icon: GraduationCap, accent: "#8b5cf6" },
  "showroom-demo":           { icon: Monitor,       accent: "#3b82f6" },
  "robot-sales-marketing":   { icon: TrendingUp,    accent: "#ef4444" },
};

const FEATURES: Record<string, string[]> = {
  "inbound-logistics":       ["Airport pickup from Harry Reid International", "ATA Carnet & customs coordination", "Climate-controlled receiving", "Full arrival inspection & documentation", "Concierge white-glove service available"],
  "warehousing-storage":     ["Secure, climate-controlled facility", "Pre-show and post-show storage", "Year-round storage available", "Inventory management system", "Insurance-ready documentation"],
  "staging-activation":      ["Unpacking & crate management", "Bench testing & diagnostics", "Firmware updates & calibration", "Booth delivery & assembly", "Full pre-show readiness check"],
  "live-technical-support":  ["On-call technician on the show floor", "Daily startup & shutdown cycles", "Real-time troubleshooting", "Rapid repair during live demos", "Multi-day packages available"],
  "stagehand-247":           ["Remote monitoring & diagnostics", "On-site emergency dispatch", "Monthly SLA contracts", "Multi-robot fleet support", "Post-sales deployment support"],
  "stagepro-training":       ["Learn by repairing real client robots", "Master technician supervision", "All robot brands & types covered", "1-day to 6-week programs", "Corporate cohort pricing available"],
  "showroom-demo":           ["Permanent Las Vegas showroom space", "Year-round demo availability", "Investor & media visit support", "Staffed demo presentations", "Annual lease discounts"],
  "robot-sales-marketing":   ["US market distribution partnerships", "The Robot Guild™ brand activation", "StageGate Ready™ certification", "Trade show booth marketing", "Commission-based sales model"],
};

const SERVICE_WORKFLOW = [
  { step: "01", title: "Intake", desc: "XBOT or a service form captures robot specs, show details, deadlines, contacts, and required support." },
  { step: "02", title: "Plan", desc: "StageGate translates the request into a service scope, timeline, quote, risk notes, and owner assignments." },
  { step: "03", title: "Move", desc: "Logistics, receiving, storage, booth delivery, and activation are coordinated against the show calendar." },
  { step: "04", title: "Support", desc: "Max and the technician network handle demo readiness, troubleshooting, repair, and post-show handoff." },
];

const SERVICE_GROUPS = [
  { title: "Move the robot", desc: "Inbound logistics, customs coordination, ground transport, warehousing, and show delivery." },
  { title: "Make it demo-ready", desc: "Unpack, inspect, stage, power, calibrate, activate, and support live demonstrations." },
  { title: "Keep it working", desc: "StageHand™ remote support, emergency dispatch, maintenance, and field escalation." },
  { title: "Build capability", desc: "StagePro™ training, showroom demos, market support, and sales enablement." },
];

function parsePricingTiers(value: unknown): any[] {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ServiceCard({ svc, phase }: { svc: any; phase: "phase1" | "phase2" }) {
  const cfg = SVC_CONFIG[svc.slug] || { icon: Package, accent: GREEN };
  const Icon = cfg.icon;
  const features = FEATURES[svc.slug] || [];
  const tiers = parsePricingTiers(svc.pricingTiers);
  const isPhase2 = phase === "phase2";

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: "0.75rem",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        opacity: isPhase2 ? 0.65 : 1,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => { if (!isPhase2) (e.currentTarget as HTMLElement).style.borderColor = "#333333"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "0.375rem", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${cfg.accent}18`, border: `1px solid ${cfg.accent}30`,
        }}>
          <Icon size={16} style={{ color: cfg.accent }} />
        </div>
        <span style={{
          fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.04em",
          color: isPhase2 ? TEXT_DIM : GREEN,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>
          {isPhase2 ? "2026" : "LIVE"}
        </span>
      </div>

      {/* Name + description */}
      <div>
        <h3 style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: TEXT_HI,
          marginBottom: "0.375rem",
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
        }}>
          {svc.name}
        </h3>
        <p style={{
          fontSize: "0.8125rem",
          lineHeight: 1.6,
          color: TEXT_MID,
          margin: 0,
        }}>
          {svc.description}
        </p>
      </div>

      {/* Feature list */}
      {features.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
          {features.map((f) => (
            <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <CheckCircle2 size={11} style={{ color: cfg.accent, flexShrink: 0, marginTop: "0.2rem" }} />
              <span style={{ fontSize: "0.8125rem", color: TEXT_MID, lineHeight: 1.5 }}>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Pricing tiers */}
      {tiers.length > 0 && (
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "0.875rem" }}>
          <p style={{
            fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.08em",
            textTransform: "uppercase", color: TEXT_DIM,
            marginBottom: "0.625rem",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>
            Pricing
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {tiers.map((tier: any) => (
              <div key={tier.label}>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: cfg.accent, fontFamily: "'JetBrains Mono', monospace" }}>
                  {tier.price ? `$${Number(tier.price).toLocaleString()}` : "Custom"}
                </div>
                <div style={{ fontSize: "0.75rem", color: TEXT_DIM, marginTop: "0.125rem" }}>{tier.label}</div>
                {tier.unit && <div style={{ fontSize: "0.6875rem", color: TEXT_DIM }}>{tier.unit}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Services() {
  const { data: services, isLoading } = trpc.services.list.useQuery();

  const phase1 = (services || []).filter(s => s.phase === "phase1");
  const phase2 = (services || []).filter(s => s.phase === "phase2");

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT_HI, fontFamily: "'Inter', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}>
      <Navbar />

      {/* ── Page header ── */}
      <div style={{ paddingTop: "7rem", paddingBottom: "3.5rem", borderBottom: `1px solid ${BORDER}`, background: "#0a0a0a" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <p style={{
            fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.12em",
            textTransform: "uppercase", color: GREEN,
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: "0.875rem",
          }}>
            Complete Service Catalog
          </p>
          <h1 style={{
            fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            color: "#ffffff",
            marginBottom: "1rem",
          }}>
            Eight Services.{" "}
            <span style={{ color: GREEN }}>One Platform.</span>
          </h1>
          <p style={{
            fontSize: "1rem",
            lineHeight: 1.65,
            color: TEXT_MID,
            maxWidth: "38rem",
            margin: "0 auto",
          }}>
            StageGate is the operating layer for robot trade shows: logistics,
            staging, technical support, training, showroom demos, and sales activation
            connected through one workflow.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: "3.5rem", paddingBottom: "4rem" }}>

        {/* ── Definition ── */}
        <div style={{ marginBottom: "3.5rem", display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: "3rem", alignItems: "start" }}>
          <div>
            <p style={{
              fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.12em",
              textTransform: "uppercase", color: GREEN,
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: "0.875rem",
            }}>
              Definition
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#ffffff" }}>
              Services organized around the robot's journey.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            {SERVICE_GROUPS.map(group => (
              <div key={group.title} style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "1rem" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: TEXT_HI, marginBottom: "0.4rem" }}>{group.title}</h3>
                <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: TEXT_MID, margin: 0 }}>{group.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Workflow ── */}
        <div style={{ marginBottom: "3.5rem", padding: "1.5rem", borderRadius: "0.75rem", border: `1px solid ${BORDER}`, background: CARD }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{
              fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.12em",
              textTransform: "uppercase", color: GREEN,
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: "0.625rem",
            }}>
              Workflow Design
            </p>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.025em", color: TEXT_HI }}>
              One request becomes an operating plan.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
            {SERVICE_WORKFLOW.map((item, index) => (
              <div key={item.step} style={{ padding: "1rem", borderLeft: index === 0 ? "none" : `1px solid ${BORDER}` }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.5rem", fontWeight: 700, color: `${GREEN}66`, marginBottom: "0.75rem" }}>{item.step}</div>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: TEXT_HI, marginBottom: "0.4rem" }}>{item.title}</h3>
                <p style={{ fontSize: "0.8125rem", color: TEXT_MID, lineHeight: 1.55, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Phase 1 ── */}
        <div style={{ marginBottom: "3.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              border: `1px solid ${GREEN}40`,
              background: `${GREEN}0d`,
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: GREEN,
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: "nowrap",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: GREEN, animation: "pulse 2s infinite" }} />
              Phase 1 — Available Now
            </div>
            <div style={{ flex: 1, height: "1px", background: BORDER }} />
          </div>

          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ height: "20rem", borderRadius: "0.75rem", background: CARD, border: `1px solid ${BORDER}`, animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
              {phase1.map(svc => <ServiceCard key={svc.id} svc={svc} phase="phase1" />)}
            </div>
          )}
        </div>

        {/* ── Phase 2 ── */}
        {phase2.length > 0 && (
          <div style={{ marginBottom: "3.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                border: `1px solid ${BORDER}`,
                fontSize: "0.6875rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: TEXT_DIM,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: "nowrap",
              }}>
                Phase 2 — Launching 2026
              </div>
              <div style={{ flex: 1, height: "1px", background: BORDER }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
              {phase2.map(svc => <ServiceCard key={svc.id} svc={svc} phase="phase2" />)}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div style={{
          padding: "2.5rem",
          borderRadius: "0.75rem",
          border: `1px solid #3ecf8e30`,
          background: "#0d1a14",
          textAlign: "center",
        }}>
          <p style={{
            fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.12em",
            textTransform: "uppercase", color: GREEN,
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: "0.75rem",
          }}>
            Get Started
          </p>
          <h2 style={{
            fontSize: "clamp(1.5rem, 3vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            marginBottom: "0.625rem",
          }}>
            Ready to Book Services?
          </h2>
          <p style={{ fontSize: "0.875rem", color: TEXT_MID, marginBottom: "1.5rem" }}>
            Register your company for free, then select your show and services.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
            <Link href="/register">
              <button className="btn-primary">
                Register free <ArrowRight size={14} />
              </button>
            </Link>
            <Link href="/order">
              <button className="btn-default">Book services now</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
