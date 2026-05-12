import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import {
  Package, Warehouse, Zap, Wrench, Clock,
  GraduationCap, Monitor, TrendingUp, ArrowRight, CheckCircle2
} from "lucide-react";

/* ── Service visual config ─────────────────────────────────────────────────── */
const SVC_CONFIG: Record<string, {
  icon: React.ElementType;
  catClass: string;
  color: string;
  bg: string;
}> = {
  "inbound-logistics":       { icon: Package,       catClass: "svc-logistics",  color: "oklch(0.52 0.22 262)", bg: "oklch(0.52 0.22 262 / 0.08)" },
  "warehousing-storage":     { icon: Warehouse,     catClass: "svc-storage",    color: "oklch(0.55 0.20 295)", bg: "oklch(0.55 0.20 295 / 0.08)" },
  "staging-activation":      { icon: Zap,           catClass: "svc-activation", color: "oklch(0.45 0.18 145)", bg: "oklch(0.45 0.18 145 / 0.08)" },
  "live-technical-support":  { icon: Wrench,        catClass: "svc-support",    color: "oklch(0.58 0.17 55)",  bg: "oklch(0.58 0.17 55 / 0.08)"  },
  "stagehand-247":           { icon: Clock,         catClass: "svc-support",    color: "oklch(0.58 0.17 55)",  bg: "oklch(0.58 0.17 55 / 0.08)"  },
  "stagepro-training":       { icon: GraduationCap, catClass: "svc-storage",    color: "oklch(0.55 0.20 295)", bg: "oklch(0.55 0.20 295 / 0.08)" },
  "showroom-demo":           { icon: Monitor,       catClass: "svc-logistics",  color: "oklch(0.52 0.22 262)", bg: "oklch(0.52 0.22 262 / 0.08)" },
  "robot-sales-marketing":   { icon: TrendingUp,    catClass: "svc-marketing",  color: "oklch(0.55 0.20 20)",  bg: "oklch(0.55 0.20 20 / 0.08)"  },
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

/* ── Service card ───────────────────────────────────────────────────────────── */
function ServiceCard({ svc, phase }: { svc: any; phase: "phase1" | "phase2" }) {
  const cfg = SVC_CONFIG[svc.slug] || SVC_CONFIG["inbound-logistics"];
  const Icon = cfg.icon;
  const features = FEATURES[svc.slug] || [];
  const tiers: any[] = svc.pricingTiers ? JSON.parse(svc.pricingTiers) : [];
  const isPhase2 = phase === "phase2";

  return (
    <div
      className={`svc-card ${cfg.catClass} flex flex-col h-full`}
      style={{ opacity: isPhase2 ? 0.75 : 1 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.bg, border: `1px solid ${cfg.color.replace(")", " / 0.20)")}` }}
        >
          <Icon size={20} style={{ color: cfg.color }} />
        </div>
        <span
          className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border"
          style={isPhase2 ? {
            color: "oklch(0.55 0.010 240)",
            borderColor: "oklch(0.85 0.006 240)",
            background: "oklch(0.95 0.004 240)",
          } : {
            color: cfg.color,
            borderColor: cfg.color.replace(")", " / 0.25)"),
            background: cfg.bg,
          }}
        >
          {isPhase2 ? "Coming 2026" : "Available Now"}
        </span>
      </div>

      {/* Name */}
      <h3
        className="font-bold text-lg mb-2 leading-snug"
        style={{ color: "oklch(0.10 0.010 240)" }}
      >
        {svc.name}
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed mb-5" style={{ color: "oklch(0.48 0.010 240)" }}>
        {svc.description}
      </p>

      {/* Features */}
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "oklch(0.40 0.010 240)" }}>
            <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
            {f}
          </li>
        ))}
      </ul>

      {/* Pricing */}
      {tiers.length > 0 && (
        <div
          className="border-t pt-4"
          style={{ borderColor: "oklch(0.90 0.005 240)" }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "oklch(0.60 0.010 240)" }}
          >
            Pricing
          </div>
          <div className="flex flex-wrap gap-4">
            {tiers.map((tier: any) => (
              <div key={tier.label}>
                <div className="font-bold text-base" style={{ color: cfg.color }}>
                  {tier.price ? `$${Number(tier.price).toLocaleString()}` : "Custom"}
                </div>
                <div className="text-[11px]" style={{ color: "oklch(0.52 0.010 240)" }}>{tier.label}</div>
                {tier.unit && <div className="text-[10px]" style={{ color: "oklch(0.62 0.010 240)" }}>{tier.unit}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function Services() {
  const { data: services, isLoading } = trpc.services.list.useQuery();

  const phase1 = (services || []).filter(s => s.phase === "phase1");
  const phase2 = (services || []).filter(s => s.phase === "phase2");

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.98 0.002 240)", color: "oklch(0.10 0.010 240)" }}>
      <Navbar />

      {/* ── Page header ── */}
      <div
        className="pt-28 pb-16 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(1.00 0.000 0)" }}
      >
        <div className="container text-center">
          <div className="section-label mx-auto justify-center">Complete Service Catalog</div>
          <h1
            className="text-5xl lg:text-6xl font-extrabold mb-4"
            style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.035em" }}
          >
            Eight Services.{" "}
            <span style={{ color: "oklch(0.52 0.22 262)" }}>One Platform.</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "oklch(0.45 0.010 240)" }}>
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase"
              style={{
                color: "oklch(0.45 0.18 145)",
                borderColor: "oklch(0.45 0.18 145 / 0.30)",
                background: "oklch(0.45 0.18 145 / 0.06)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "oklch(0.45 0.18 145)" }} />
              Phase 1 — Available Now
            </div>
            <div className="flex-1 h-px" style={{ background: "oklch(0.88 0.006 240)" }} />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-80 rounded-2xl animate-pulse" style={{ background: "oklch(0.92 0.004 240)" }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {phase1.map(svc => <ServiceCard key={svc.id} svc={svc} phase="phase1" />)}
            </div>
          )}
        </div>

        {/* ── Phase 2 ── */}
        {phase2.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase"
                style={{
                  color: "oklch(0.55 0.010 240)",
                  borderColor: "oklch(0.85 0.006 240)",
                  background: "oklch(0.95 0.004 240)",
                }}
              >
                Phase 2 — Launching 2026
              </div>
              <div className="flex-1 h-px" style={{ background: "oklch(0.88 0.006 240)" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {phase2.map(svc => <ServiceCard key={svc.id} svc={svc} phase="phase2" />)}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div
          className="relative p-10 rounded-2xl border text-center"
          style={{
            borderColor: "oklch(0.52 0.22 262 / 0.20)",
            background: "oklch(0.10 0.010 240)",
          }}
        >
          <div className="section-label mx-auto justify-center mb-4" style={{ color: "oklch(0.52 0.22 262)" }}>
            Get Started
          </div>
          <h2
            className="text-3xl font-extrabold mb-3"
            style={{ color: "oklch(0.97 0.002 240)", letterSpacing: "-0.03em" }}
          >
            Ready to Book Services?
          </h2>
          <p className="mb-6" style={{ color: "oklch(0.60 0.010 240)" }}>
            Register your company for free, then select your show and services.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <button className="btn-primary">
                Register Free <ArrowRight size={15} />
              </button>
            </Link>
            <Link href="/order">
              <button
                className="btn-default"
                style={{
                  background: "oklch(1.00 0.000 0 / 0.08)",
                  borderColor: "oklch(1.00 0.000 0 / 0.20)",
                  color: "oklch(0.88 0.005 240)",
                }}
              >
                Book Services Now
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
