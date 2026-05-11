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
  iconColor: string;
  iconBg: string;
  iconBorder: string;
  badgeColor: string;
}> = {
  "inbound-logistics": {
    icon: Package,
    catClass: "svc-logistics",
    iconColor: "#7eb8f7",
    iconBg: "oklch(0.65 0.20 245 / 0.10)",
    iconBorder: "oklch(0.65 0.20 245 / 0.25)",
    badgeColor: "oklch(0.65 0.20 245)",
  },
  "warehousing-storage": {
    icon: Warehouse,
    catClass: "svc-storage",
    iconColor: "#b89cf7",
    iconBg: "oklch(0.62 0.22 295 / 0.10)",
    iconBorder: "oklch(0.62 0.22 295 / 0.25)",
    badgeColor: "oklch(0.62 0.22 295)",
  },
  "staging-activation": {
    icon: Zap,
    catClass: "svc-activation",
    iconColor: "#4ade80",
    iconBg: "oklch(0.74 0.23 145 / 0.10)",
    iconBorder: "oklch(0.74 0.23 145 / 0.25)",
    badgeColor: "oklch(0.74 0.23 145)",
  },
  "live-technical-support": {
    icon: Wrench,
    catClass: "svc-support",
    iconColor: "#fbbf24",
    iconBg: "oklch(0.78 0.18 70 / 0.10)",
    iconBorder: "oklch(0.78 0.18 70 / 0.25)",
    badgeColor: "oklch(0.78 0.18 70)",
  },
  "stagehand-247": {
    icon: Clock,
    catClass: "svc-support",
    iconColor: "#fbbf24",
    iconBg: "oklch(0.78 0.18 70 / 0.10)",
    iconBorder: "oklch(0.78 0.18 70 / 0.25)",
    badgeColor: "oklch(0.78 0.18 70)",
  },
  "stagepro-training": {
    icon: GraduationCap,
    catClass: "svc-storage",
    iconColor: "#b89cf7",
    iconBg: "oklch(0.62 0.22 295 / 0.10)",
    iconBorder: "oklch(0.62 0.22 295 / 0.25)",
    badgeColor: "oklch(0.62 0.22 295)",
  },
  "showroom-demo": {
    icon: Monitor,
    catClass: "svc-logistics",
    iconColor: "#7eb8f7",
    iconBg: "oklch(0.65 0.20 245 / 0.10)",
    iconBorder: "oklch(0.65 0.20 245 / 0.25)",
    badgeColor: "oklch(0.65 0.20 245)",
  },
  "robot-sales-marketing": {
    icon: TrendingUp,
    catClass: "svc-marketing",
    iconColor: "#f87171",
    iconBg: "oklch(0.70 0.22 20 / 0.10)",
    iconBorder: "oklch(0.70 0.22 20 / 0.25)",
    badgeColor: "oklch(0.70 0.22 20)",
  },
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
      style={{ opacity: isPhase2 ? 0.88 : 1 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5 relative z-10">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.iconBg, border: `1px solid ${cfg.iconBorder}` }}
        >
          <Icon size={20} style={{ color: cfg.iconColor }} />
        </div>
        <span
          className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border"
          style={{
            color: isPhase2 ? "oklch(0.50 0.010 240)" : cfg.badgeColor,
            borderColor: isPhase2 ? "oklch(0.22 0.010 240)" : `${cfg.badgeColor.replace(")", " / 0.25)")}`,
            background: isPhase2 ? "oklch(0.14 0.010 240)" : `${cfg.badgeColor.replace(")", " / 0.08)")}`,
          }}
        >
          {isPhase2 ? "Coming 2026" : "Available Now"}
        </span>
      </div>

      {/* Name */}
      <h3 className="font-display font-bold text-lg text-white mb-2 relative z-10 leading-snug">
        {svc.name}
      </h3>

      {/* Description */}
      <p className="text-sm text-[oklch(0.58_0.010_240)] leading-relaxed mb-5 relative z-10">
        {svc.description}
      </p>

      {/* Features */}
      <ul className="space-y-2 mb-6 relative z-10 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[oklch(0.60_0.010_240)]">
            <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: cfg.iconColor }} />
            {f}
          </li>
        ))}
      </ul>

      {/* Pricing */}
      {tiers.length > 0 && (
        <div
          className="border-t pt-4 relative z-10"
          style={{ borderColor: "oklch(0.18 0.010 240)" }}
        >
          <div className="font-mono text-[10px] text-[oklch(0.45_0.008_240)] uppercase tracking-widest mb-3">Pricing</div>
          <div className="flex flex-wrap gap-4">
            {tiers.map((tier: any) => (
              <div key={tier.label}>
                <div className="font-display font-bold text-base" style={{ color: cfg.iconColor }}>
                  {tier.price ? `$${Number(tier.price).toLocaleString()}` : "Custom"}
                </div>
                <div className="text-[11px] text-[oklch(0.50_0.010_240)]">{tier.label}</div>
                {tier.unit && <div className="text-[10px] text-[oklch(0.40_0.008_240)]">{tier.unit}</div>}
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
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ── Page header ── */}
      <div className="pt-28 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[oklch(0.74_0.23_145/0.04)] blur-[80px] pointer-events-none" />
        <div className="container relative z-10 text-center">
          <div className="section-label mx-auto justify-center">Complete Service Catalog</div>
          <h1 className="text-5xl lg:text-6xl font-display font-bold text-white mb-4">
            Eight Services.{" "}
            <span style={{
              background: "linear-gradient(135deg, oklch(0.74 0.23 145) 0%, oklch(0.88 0.18 165) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              One Platform.
            </span>
          </h1>
          <p className="text-[oklch(0.58_0.010_240)] text-lg max-w-2xl mx-auto">
            From the moment your robot ships to the moment it's back in storage,
            StageGate covers every step of the trade show lifecycle.
          </p>
        </div>
      </div>

      <div className="container pb-24">

        {/* ── Phase 1 ── */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase"
              style={{
                color: "oklch(0.74 0.23 145)",
                borderColor: "oklch(0.74 0.23 145 / 0.30)",
                background: "oklch(0.74 0.23 145 / 0.06)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.74_0.23_145)] animate-pulse" />
              Phase 1 — Available Now
            </div>
            <div className="flex-1 h-px" style={{ background: "oklch(0.18 0.010 240)" }} />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-80 rounded-2xl animate-pulse" style={{ background: "oklch(0.10 0.010 240)" }} />
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
                  color: "oklch(0.50 0.010 240)",
                  borderColor: "oklch(0.22 0.010 240)",
                  background: "oklch(0.12 0.010 240)",
                }}
              >
                Phase 2 — Launching 2026
              </div>
              <div className="flex-1 h-px" style={{ background: "oklch(0.18 0.010 240)" }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {phase2.map(svc => <ServiceCard key={svc.id} svc={svc} phase="phase2" />)}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div
          className="relative p-10 rounded-2xl border text-center overflow-hidden"
          style={{
            borderColor: "oklch(0.74 0.23 145 / 0.25)",
            background: "linear-gradient(135deg, oklch(0.10 0.010 240) 0%, oklch(0.08 0.008 240) 100%)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.74_0.23_145/0.50)] to-transparent" />
          <div className="absolute inset-0 bg-[oklch(0.74_0.23_145/0.02)]" />
          <div className="relative z-10">
            <div className="section-label mx-auto justify-center mb-4">Get Started</div>
            <h2 className="text-3xl font-display font-bold text-white mb-3">Ready to Book Services?</h2>
            <p className="text-[oklch(0.58_0.010_240)] mb-6">
              Register your company for free, then select your show and services.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register">
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-display font-bold text-sm transition-all duration-200"
                  style={{
                    background: "oklch(0.74 0.23 145)",
                    color: "oklch(0.06 0.008 240)",
                    boxShadow: "0 0 20px oklch(0.74 0.23 145 / 0.28)",
                  }}
                >
                  Register Free <ArrowRight size={15} />
                </button>
              </Link>
              <Link href="/order">
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-display font-semibold text-sm border transition-all duration-200"
                  style={{
                    borderColor: "oklch(0.25 0.010 240)",
                    color: "oklch(0.75 0.010 240)",
                    background: "transparent",
                  }}
                >
                  Book Services Now
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
