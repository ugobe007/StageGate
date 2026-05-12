import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import {
  Package, Warehouse, Zap, Wrench, Clock,
  GraduationCap, Monitor, TrendingUp, ArrowRight, CheckCircle2
} from "lucide-react";

/* ── Palette ─────────────────────────────────────────────────────────── */
const BG     = "oklch(0.11 0.012 262)";
const CARD   = "oklch(0.14 0.014 262)";
const BORDER = "oklch(0.22 0.016 262)";
const INDIGO = "oklch(0.72 0.20 262)";
const CYAN   = "oklch(0.75 0.18 200)";
const TEXT_HI  = "oklch(0.93 0.005 240)";
const TEXT_MID = "oklch(0.70 0.008 240)";
const TEXT_DIM = "oklch(0.50 0.010 240)";

const SVC_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  "inbound-logistics":       { icon: Package,       color: INDIGO },
  "warehousing-storage":     { icon: Warehouse,     color: "oklch(0.65 0.20 295)" },
  "staging-activation":      { icon: Zap,           color: CYAN },
  "live-technical-support":  { icon: Wrench,        color: "oklch(0.70 0.17 55)" },
  "stagehand-247":           { icon: Clock,         color: "oklch(0.70 0.17 55)" },
  "stagepro-training":       { icon: GraduationCap, color: "oklch(0.65 0.20 295)" },
  "showroom-demo":           { icon: Monitor,       color: INDIGO },
  "robot-sales-marketing":   { icon: TrendingUp,    color: "oklch(0.62 0.20 20)" },
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

function ServiceCard({ svc, phase }: { svc: any; phase: "phase1" | "phase2" }) {
  const cfg = SVC_CONFIG[svc.slug] || { icon: Package, color: INDIGO };
  const Icon = cfg.icon;
  const features = FEATURES[svc.slug] || [];
  const tiers: any[] = svc.pricingTiers ? JSON.parse(svc.pricingTiers) : [];
  const isPhase2 = phase === "phase2";
  const statusColor = isPhase2 ? TEXT_DIM : "oklch(0.62 0.18 145)";
  const statusLabel = isPhase2 ? "Coming 2026" : "Available Now";

  return (
    <div
      className="rounded-xl border p-6 flex flex-col gap-4 transition-colors"
      style={{ background: CARD, borderColor: BORDER, opacity: isPhase2 ? 0.75 : 1 }}
      onMouseEnter={e => { if (!isPhase2) (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.38 0.020 262)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded flex items-center justify-center"
          style={{ border: `1px solid ${cfg.color}44`, background: `${cfg.color}0d` }}
        >
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{ color: statusColor, borderColor: `${statusColor}44`, background: `${statusColor}0d` }}
        >
          {statusLabel}
        </span>
      </div>

      <div>
        <h3 className="font-semibold text-base mb-2" style={{ color: TEXT_HI }}>{svc.name}</h3>
        <p className="text-sm leading-relaxed" style={{ color: TEXT_DIM }}>{svc.description}</p>
      </div>

      {/* Features */}
      {features.length > 0 && (
        <ul className="space-y-1.5 flex-1">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs" style={{ color: TEXT_MID }}>
              <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* Pricing */}
      {tiers.length > 0 && (
        <div className="border-t pt-4" style={{ borderColor: BORDER }}>
          <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: TEXT_DIM }}>
            Pricing
          </p>
          <div className="flex flex-wrap gap-4">
            {tiers.map((tier: any) => (
              <div key={tier.label}>
                <div className="font-mono text-sm font-semibold" style={{ color: cfg.color }}>
                  {tier.price ? `$${Number(tier.price).toLocaleString()}` : "Custom"}
                </div>
                <div className="text-[11px]" style={{ color: TEXT_DIM }}>{tier.label}</div>
                {tier.unit && <div className="text-[10px]" style={{ color: TEXT_DIM }}>{tier.unit}</div>}
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
    <div className="min-h-screen" style={{ background: BG, color: TEXT_HI }}>
      <Navbar />

      {/* ── Page header ── */}
      <div className="pt-28 pb-16 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="container text-center">
          <p className="section-label mx-auto justify-center mb-3">Complete Service Catalog</p>
          <h1
            className="text-5xl lg:text-6xl font-bold mb-4"
            style={{ color: TEXT_HI, letterSpacing: "-0.035em" }}
          >
            Eight Services.{" "}
            <span
              style={{
                background: `linear-gradient(90deg, ${INDIGO} 0%, ${CYAN} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              One Platform.
            </span>
          </h1>
          <p className="text-base max-w-2xl mx-auto" style={{ color: TEXT_MID }}>
            From the moment your robot ships to the moment it's back in storage,
            StageGate covers every step of the trade show lifecycle.
          </p>
        </div>
      </div>

      <div className="container py-16">

        {/* ── Phase 1 ── */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono tracking-widest uppercase"
              style={{
                color: "oklch(0.62 0.18 145)",
                borderColor: "oklch(0.62 0.18 145 / 0.30)",
                background: "oklch(0.62 0.18 145 / 0.06)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "oklch(0.62 0.18 145)" }} />
              Phase 1 — Available Now
            </div>
            <div className="flex-1 h-px" style={{ background: BORDER }} />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-80 rounded-xl animate-pulse" style={{ background: CARD, border: `1px solid ${BORDER}` }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {phase1.map(svc => <ServiceCard key={svc.id} svc={svc} phase="phase1" />)}
            </div>
          )}
        </div>

        {/* ── Phase 2 ── */}
        {phase2.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono tracking-widest uppercase"
                style={{ color: TEXT_DIM, borderColor: BORDER, background: "transparent" }}
              >
                Phase 2 — Launching 2026
              </div>
              <div className="flex-1 h-px" style={{ background: BORDER }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {phase2.map(svc => <ServiceCard key={svc.id} svc={svc} phase="phase2" />)}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div
          className="p-10 rounded-xl border text-center"
          style={{ borderColor: "oklch(0.72 0.20 262 / 0.20)", background: CARD }}
        >
          <p className="section-label mx-auto justify-center mb-4">Get Started</p>
          <h2 className="text-3xl font-bold mb-3" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
            Ready to Book Services?
          </h2>
          <p className="mb-6 text-sm" style={{ color: TEXT_DIM }}>
            Register your company for free, then select your show and services.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
