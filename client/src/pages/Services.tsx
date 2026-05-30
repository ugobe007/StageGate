import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import {
  Package, Warehouse, Zap, Wrench, Clock,
  GraduationCap, Monitor, TrendingUp, Shield,
  Radio, Battery, Users, BarChart2, CheckCircle2,
  ArrowRight, ChevronRight,
} from "lucide-react";

/* ── Palette ────────────────────────────────────────────────────────────── */
const BG      = "#1C1E22";
const CARD    = "#111111";
const BORDER  = "#222222";
const GREEN   = "#3ecf8e";
const TEXT_HI  = "#f1f5f9";
const TEXT_MID = "#94a3b8";
const TEXT_DIM = "#64748b";

/* ── Tier metadata ──────────────────────────────────────────────────────── */
const TIERS = [
  {
    key: "tier1",
    label: "Tier 1",
    name: "Deployment Essentials",
    tagline: "Everything your robot needs to go live.",
    description: "The core services every deployment requires — receiving, activation, live technical support, and storage. If your robot is shipping to a show or a new facility, this is where you start.",
    accent: "#3b82f6",
    pillColor: "#1d4ed8",
  },
  {
    key: "tier2",
    label: "Tier 2",
    name: "Ongoing Operations Infrastructure",
    tagline: "Always on. Always ready.",
    description: "The services that keep your robots deployment-ready between activations — remote monitoring, certification, charging infrastructure, insurance coordination, and a permanent Las Vegas showroom. Built for operators running multiple deployments per year.",
    accent: GREEN,
    pillColor: "#065f46",
  },
  {
    key: "tier3",
    label: "Tier 3",
    name: "Workforce & Market Development",
    tagline: "Build the team. Reach the market.",
    description: "Training programs that build certified robot technicians, and go-to-market services that connect your brand with US buyers, media, and distribution partners. For companies scaling beyond a single deployment.",
    accent: "#a78bfa",
    pillColor: "#4c1d95",
  },
];

/* ── Service config: icon + accent per slug ─────────────────────────────── */
const SVC_CONFIG: Record<string, { icon: React.ElementType; accent: string }> = {
  "robot-receiving-intake":          { icon: Package,       accent: "#3b82f6" },
  "activation-calibration":          { icon: Zap,           accent: GREEN },
  "live-technical-support":          { icon: Wrench,        accent: "#f59e0b" },
  "storage-fleet-management":        { icon: Warehouse,     accent: "#60a5fa" },
  "stagehand-operations-center":     { icon: Radio,         accent: GREEN },
  "stagegate-ready-certification":   { icon: Shield,        accent: "#22d3ee" },
  "robot-insurance-warranty":        { icon: Shield,        accent: "#f97316" },
  "battery-charging-infrastructure": { icon: Battery,       accent: "#facc15" },
  "robot-showroom-service":          { icon: Monitor,       accent: "#3b82f6" },
  "operator-staffing-network":       { icon: Users,         accent: "#a78bfa" },
  "stagepro-workforce-pipeline":     { icon: GraduationCap, accent: "#8b5cf6" },
  "deployment-analytics-telemetry":  { icon: BarChart2,     accent: "#10b981" },
  "robot-sales-marketing":           { icon: TrendingUp,    accent: "#ef4444" },
};

/* ── Inline feature bullets per slug ────────────────────────────────────── */
const FEATURES: Record<string, string[]> = {
  "robot-receiving-intake": [
    "Airport pickup from Harry Reid International",
    "ATA Carnet & customs coordination",
    "Shock, damage & battery compliance inspection",
    "Full photo documentation & insurance verification",
    "Inventory logging with chain-of-custody record",
  ],
  "activation-calibration": [
    "Unpacking, assembly & crate management",
    "Firmware updates & sensor calibration",
    "WiFi, network & localization testing",
    "Motion validation & full safety checks",
    "Pre-show readiness sign-off before doors open",
  ],
  "live-technical-support": [
    "Dedicated technician on the show floor",
    "Daily startup / shutdown cycles",
    "Emergency troubleshooting & crash recovery",
    "Battery swaps & rapid parts replacement",
    "Multi-day show packages available",
  ],
  "storage-fleet-management": [
    "Climate-controlled, secure facility",
    "Year-round or per-show storage",
    "Charging maintenance & preventive diagnostics",
    "Firmware upkeep between deployments",
    "Redeployment prep & spare parts storage",
  ],
  "stagehand-operations-center": [
    "Remote diagnostics & fleet health monitoring",
    "OTA firmware coordination",
    "AI incident logging & deployment analytics",
    "Emergency dispatch with SLA guarantees",
    "Multi-robot fleet support & escalation paths",
  ],
  "stagegate-ready-certification": [
    "Trade-show, hospitality & airport ready",
    "Public-interaction & deployment-safe",
    "Battery-safe, ADA & network compliant",
    "Certification badge for marketing materials",
    "Annual renewal program",
  ],
  "robot-insurance-warranty": [
    "Deployment audits & operational verification",
    "Incident reports & failure logging",
    "Transport inspection records",
    "Warranty processing support",
    "Insurance partnership documentation",
  ],
  "battery-charging-infrastructure": [
    "Charging station design & installation",
    "Battery health monitoring & swap systems",
    "Thermal management & storage compliance",
    "Booth power provisioning for shows",
    "Fleet charging logistics coordination",
  ],
  "robot-showroom-service": [
    "Permanent Las Vegas showroom space",
    "Year-round demo & investor visit support",
    "Benchmarking labs & interoperability testing",
    "Staffed demo presentations & media access",
    "Annual lease discounts available",
  ],
  "operator-staffing-network": [
    "Certified & multilingual operators",
    "Hospitality-trained demo specialists",
    "Field technicians & roaming support teams",
    "FIRST Robotics & university pipelines",
    "On-demand or full-show deployment",
  ],
  "stagepro-workforce-pipeline": [
    "Learn by repairing real client robots",
    "Master technician supervision",
    "All brands & robot types covered",
    "1-day to 6-week programs",
    "Corporate cohort & recruiting placement",
  ],
  "deployment-analytics-telemetry": [
    "Failure rate tracking by robot model & environment",
    "Battery, network & uptime telemetry",
    "Average deployment time benchmarks",
    "Post-show operational reports",
    "Aggregate industry dataset (anonymized)",
  ],
  "robot-sales-marketing": [
    "US market distribution partnerships",
    "The Robot Guild™ brand activation",
    "StageGate Ready™ certification alignment",
    "Trade show booth marketing strategy",
    "Commission-based sales model",
  ],
};

/* ── Workflow steps ─────────────────────────────────────────────────────── */
const WORKFLOW = [
  { step: "01", title: "Intake", desc: "XBOT or a service form captures robot specs, show details, deadlines, contacts, and required support." },
  { step: "02", title: "Plan",   desc: "StageGate translates the request into a service scope, timeline, quote, risk notes, and owner assignments." },
  { step: "03", title: "Move",   desc: "Logistics, receiving, storage, booth delivery, and activation are coordinated against the show calendar." },
  { step: "04", title: "Support",desc: "The technician network handles demo readiness, troubleshooting, repair, and post-show handoff." },
];

/* ── Parsers ────────────────────────────────────────────────────────────── */
function parsePricingTiers(value: unknown): Array<{ label: string; price?: number; unit?: string }> {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ── Service card ───────────────────────────────────────────────────────── */
function ServiceCard({ svc }: { svc: any }) {
  const cfg = SVC_CONFIG[svc.slug] ?? { icon: Package, accent: GREEN };
  const Icon = cfg.icon;
  const features = FEATURES[svc.slug] ?? [];
  const tiers = parsePricingTiers(svc.pricingTiers);

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
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2a2a2a"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
    >
      {/* Icon + badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "0.375rem", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${cfg.accent}16`, border: `1px solid ${cfg.accent}28`,
        }}>
          <Icon size={16} style={{ color: cfg.accent }} />
        </div>
        <span style={{
          fontSize: "0.625rem", fontWeight: 500, letterSpacing: "0.08em",
          textTransform: "uppercase", color: cfg.accent,
          fontFamily: "'JetBrains Mono', monospace",
          paddingTop: "2px",
        }}>
          {svc.priceUnit && svc.basePrice
            ? `from $${Number(svc.basePrice).toLocaleString()} / ${svc.priceUnit}`
            : "custom pricing"}
        </span>
      </div>

      {/* Name + description */}
      <div>
        <h3 style={{
          fontSize: "0.9375rem", fontWeight: 600, color: TEXT_HI,
          marginBottom: "0.375rem", letterSpacing: "-0.01em", lineHeight: 1.3,
        }}>
          {svc.name}
        </h3>
        <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: TEXT_MID, margin: 0 }}>
          {svc.description}
        </p>
      </div>

      {/* Features */}
      {features.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
          {features.map(f => (
            <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <CheckCircle2 size={11} style={{ color: cfg.accent, flexShrink: 0, marginTop: "0.2rem" }} />
              <span style={{ fontSize: "0.8125rem", color: TEXT_MID, lineHeight: 1.5 }}>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Pricing tiers */}
      {tiers.length > 0 && tiers.some(t => t.price) && (
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "0.875rem" }}>
          <p style={{
            fontSize: "0.625rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
            color: TEXT_DIM, marginBottom: "0.625rem", fontFamily: "'JetBrains Mono', monospace",
          }}>
            Pricing
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {tiers.map(tier => (
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

      {/* CTA */}
      <div style={{ marginTop: "auto" }}>
        <Link href="/order">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.8125rem", fontWeight: 500, color: cfg.accent, cursor: "pointer",
            textDecoration: "none",
          }}>
            Request this service <ChevronRight size={14} />
          </span>
        </Link>
      </div>
    </div>
  );
}

/* ── Tier section ───────────────────────────────────────────────────────── */
function TierSection({ tier, services }: { tier: typeof TIERS[number]; services: any[] }) {
  if (!services.length) return null;
  return (
    <section style={{ marginBottom: "4.5rem" }}>
      {/* Tier header */}
      <div style={{
        display: "flex", flexDirection: "column", gap: "0.5rem",
        padding: "1.5rem", borderRadius: "0.75rem",
        border: `1px solid ${tier.accent}22`,
        background: `${tier.accent}07`,
        marginBottom: "1.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{
            fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: tier.accent,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {tier.label}
          </span>
          <span style={{ width: "1px", height: "12px", background: `${tier.accent}44` }} />
          <span style={{ fontSize: "0.6875rem", color: TEXT_DIM, fontStyle: "italic" }}>
            {tier.tagline}
          </span>
        </div>
        <h2 style={{
          fontSize: "clamp(1.25rem, 2.5vw, 1.875rem)", fontWeight: 700,
          letterSpacing: "-0.03em", color: TEXT_HI, lineHeight: 1.15,
        }}>
          {tier.name}
        </h2>
        <p style={{ fontSize: "0.875rem", color: TEXT_MID, lineHeight: 1.65, maxWidth: "56rem", margin: 0 }}>
          {tier.description}
        </p>
      </div>

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "1rem",
      }}>
        {services.map(svc => (
          <ServiceCard key={svc.slug} svc={svc} />
        ))}
      </div>
    </section>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function Services() {
  const { data: allServices, isLoading } = trpc.services.list.useQuery();

  const tier1 = (allServices ?? []).filter(s => s.phase === "tier1" || s.phase === "phase1").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const tier2 = (allServices ?? []).filter(s => s.phase === "tier2").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const tier3 = (allServices ?? []).filter(s => s.phase === "tier3" || s.phase === "phase2").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT_HI, fontFamily: "'Inter', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif" }}>
      <Navbar />

      {/* ── Hero ── */}
      <div style={{ paddingTop: "7rem", paddingBottom: "4rem", borderBottom: `1px solid ${BORDER}`, background: "#09090b" }}>
        <div className="container" style={{ maxWidth: "64rem" }}>
          <p style={{
            fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.14em",
            textTransform: "uppercase", color: GREEN,
            fontFamily: "'JetBrains Mono', monospace", marginBottom: "1rem",
          }}>
            Service Architecture
          </p>
          <h1 style={{
            fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
            fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05,
            color: "#ffffff", marginBottom: "1.25rem",
          }}>
            Your robot performs.{" "}
            <span style={{ color: GREEN }}>We handle everything else.</span>
          </h1>
          <p style={{
            fontSize: "1.0625rem", lineHeight: 1.7, color: TEXT_MID, maxWidth: "44rem", marginBottom: "2rem",
          }}>
            Receiving, activation, live support, storage, certification, remote monitoring —
            every operational dependency a robot company needs, in one place, in Las Vegas.
          </p>

          {/* Strategic comparison row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "1px", border: `1px solid ${BORDER}`, borderRadius: "0.75rem", overflow: "hidden",
          }}>
            {[
              { industry: "Cloud computing", equiv: "AWS infrastructure" },
              { industry: "Aviation",         equiv: "Ground operations" },
              { industry: "Formula 1",        equiv: "Pit crews" },
              { industry: "Trade shows",      equiv: "Freeman / GES" },
              { industry: "Robotics",         equiv: "StageGate", highlight: true },
            ].map(row => (
              <div key={row.industry} style={{
                padding: "1rem 1.25rem",
                background: row.highlight ? `${GREEN}10` : CARD,
                borderLeft: row.highlight ? `2px solid ${GREEN}` : "none",
              }}>
                <div style={{ fontSize: "0.6875rem", color: TEXT_DIM, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {row.industry}
                </div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: row.highlight ? GREEN : TEXT_HI }}>
                  {row.equiv}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Photo strip ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", height: "clamp(160px, 22vw, 280px)" }}>
          {[
            { src: "/photos/fleet-robots.png", alt: "Humanoid robot fleet", caption: "Fleet deployment" },
            { src: "/photos/rokae-demo.png",   alt: "Robot demo activation",  caption: "Show activation" },
            { src: "/photos/unitree-show.png", alt: "Unitree humanoid at a trade show demo", caption: "Unitree · show floor" },
            { src: "/photos/tradeshow-floor.png", alt: "Trade show floor", caption: "Show-floor support" },
          ].map((img, i) => (
            <div key={i} style={{ position: "relative", overflow: "hidden", borderLeft: i === 0 ? "none" : `1px solid ${BORDER}` }}>
              <img src={img.src} alt={img.alt} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block", transition: "transform 0.4s ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,8,0.7) 0%, rgba(8,8,8,0.1) 50%, transparent 100%)" }} />
              <span style={{ position: "absolute", bottom: "0.75rem", left: "0.875rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)" }}>
                {img.caption}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="container" style={{ paddingTop: "3.5rem", paddingBottom: "5rem" }}>

        {/* ── Highest-value callout ── */}
        <div style={{
          marginBottom: "3.5rem", padding: "1.25rem 1.5rem",
          borderRadius: "0.75rem", border: `1px solid ${GREEN}22`,
          background: `${GREEN}08`,
          display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: "16rem" }}>
            <p style={{ fontSize: "0.6875rem", color: GREEN, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: "0.375rem" }}>
              Highest Strategic Value
            </p>
            <p style={{ fontSize: "0.875rem", color: TEXT_MID, margin: 0, lineHeight: 1.6 }}>
              Remote operations center · Certification · Storage & fleet · Deployment analytics · Workforce pipeline
            </p>
          </div>
          <div style={{ fontSize: "0.8125rem", color: TEXT_DIM, maxWidth: "28rem", lineHeight: 1.6 }}>
            Eventually every major city with robot deployments will need receiving, activation, charging, repair, storage, staffing, compliance, certification, and monitoring. You are building the first.
          </div>
        </div>

        {/* ── Workflow ── */}
        <div style={{ marginBottom: "3.5rem", padding: "1.5rem", borderRadius: "0.75rem", border: `1px solid ${BORDER}`, background: CARD }}>
          <p style={{
            fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
            color: GREEN, fontFamily: "'JetBrains Mono', monospace", marginBottom: "0.625rem",
          }}>
            Workflow Design
          </p>
          <h2 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.025em", color: TEXT_HI, marginBottom: "1.25rem" }}>
            One request becomes an operating plan.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
            {WORKFLOW.map((item, i) => (
              <div key={item.step} style={{ padding: "1rem", borderLeft: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.375rem", fontWeight: 700, color: `${GREEN}55`, marginBottom: "0.625rem" }}>
                  {item.step}
                </div>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: TEXT_HI, marginBottom: "0.375rem" }}>{item.title}</h3>
                <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: TEXT_MID, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Three tier sections ── */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: TEXT_DIM }}>Loading services…</div>
        ) : (
          <>
            {TIERS.map(tier => (
              <TierSection
                key={tier.key}
                tier={tier}
                services={tier.key === "tier1" ? tier1 : tier.key === "tier2" ? tier2 : tier3}
              />
            ))}
          </>
        )}

        {/* ── Bottom CTA ── */}
        <div style={{
          padding: "2.5rem", borderRadius: "0.75rem",
          border: `1px solid ${BORDER}`,
          background: CARD,
          textAlign: "center",
        }}>
          <p style={{
            fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
            color: GREEN, fontFamily: "'JetBrains Mono', monospace", marginBottom: "1rem",
          }}>
            Ready to deploy?
          </p>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.025em", color: TEXT_HI, marginBottom: "0.75rem" }}>
            One partner. Every deployment.
          </h2>
          <p style={{ fontSize: "0.9375rem", color: TEXT_MID, lineHeight: 1.7, maxWidth: "36rem", margin: "0 auto 2rem" }}>
            Whether it's your first trade show or your tenth enterprise deployment, StageGate handles the operational complexity so your team can focus on the robot.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/order">
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.625rem 1.25rem", borderRadius: "0.5rem",
                background: GREEN, color: "#000", fontSize: "0.875rem",
                fontWeight: 600, cursor: "pointer", textDecoration: "none",
              }}>
                Request a service <ArrowRight size={15} />
              </span>
            </Link>
            <Link href="/stagehand">
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.625rem 1.25rem", borderRadius: "0.5rem",
                border: `1px solid ${BORDER}`, color: TEXT_MID,
                fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", textDecoration: "none",
              }}>
                StageHand™ Operations Center
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
