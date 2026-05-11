import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Clock, Shield, ArrowRight, Wrench, AlertCircle,
  Activity, Phone, CheckCircle2
} from "lucide-react";

const AMBER = "oklch(0.78 0.17 70)";
const AMBER_MUTED = "oklch(0.78 0.17 70 / 0.12)";
const AMBER_BORDER = "oklch(0.78 0.17 70 / 0.22)";

const TIERS = [
  {
    name: "Standard Retainer",
    price: "$1,200",
    unit: "/month",
    features: [
      "Remote diagnostics & monitoring",
      "48-hour response SLA",
      "Up to 2 robots",
      "Monthly health reports",
      "Email & chat support",
    ],
    highlight: false,
  },
  {
    name: "Enterprise SLA",
    price: "$2,500",
    unit: "/month",
    features: [
      "24/7 remote & on-site support",
      "4-hour emergency response SLA",
      "Unlimited robots",
      "Dedicated technician",
      "Priority parts sourcing",
      "Quarterly on-site inspections",
    ],
    highlight: true,
  },
];

const USE_CASES = [
  { icon: AlertCircle, title: "Emergency Repair",       desc: "Robot breaks down mid-demo at a trade show. StageHand™ dispatches a technician within hours." },
  { icon: Activity,    title: "Deployment Monitoring",  desc: "Robots deployed in hotels, airports, or retail locations monitored 24/7 with proactive alerts." },
  { icon: Wrench,      title: "Scheduled Maintenance",  desc: "Quarterly on-site inspections, firmware updates, and preventive maintenance to avoid failures." },
  { icon: Phone,       title: "Remote Diagnostics",     desc: "Most issues resolved remotely in under 30 minutes via secure connection to your robot's systems." },
];

export default function StageHandPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.08_0.006_240)] text-[oklch(0.97_0.002_240)]">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 relative overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.20 0.008 240 / 0.35) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.20 0.008 240 / 0.35) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 70% 50% at 50% 0%, black 30%, transparent 100%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          {/* Icon badge */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: AMBER_MUTED, border: `1px solid ${AMBER_BORDER}` }}
          >
            <Clock size={26} style={{ color: AMBER }} />
          </div>

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6"
            style={{ color: AMBER, borderColor: AMBER_BORDER, background: AMBER_MUTED }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: AMBER }} />
            <span className="font-mono text-[11px] tracking-widest uppercase">24/7 Technical Support</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white mb-4">
            StageHand<sup className="text-xl font-normal align-super">™</sup>
          </h1>
          <p className="text-lg text-[oklch(0.55_0.008_240)] max-w-2xl mx-auto mb-8 leading-relaxed">
            Ongoing remote and on-site technical support for robots in the field.
            When your robot needs help, we're already there.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <span className="btn-primary">Get Started Free <ArrowRight size={14} /></span>
            </Link>
            <Link href="/order">
              <span className="btn-default">Book Support Now</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      <div className="border-y border-[oklch(0.16_0.008_240)] bg-[oklch(0.09_0.006_240)]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "24/7",  label: "Always Available" },
              { value: "<4hr",  label: "Emergency Response SLA" },
              { value: "All",   label: "Robot Brands Supported" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl font-bold tracking-tight mb-1" style={{ color: AMBER }}>{value}</div>
                <div className="text-xs text-[oklch(0.50_0.008_240)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Use Cases ─────────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label" style={{ color: AMBER }}>Use Cases</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">When You Need StageHand™</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {USE_CASES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="sg-card flex gap-4"
                style={{ borderColor: AMBER_BORDER }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: AMBER_MUTED, border: `1px solid ${AMBER_BORDER}` }}
                >
                  <Icon size={16} style={{ color: AMBER }} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                  <p className="text-xs text-[oklch(0.52_0.008_240)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label" style={{ color: AMBER }}>Pricing</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">StageHand™ Plans</h2>
            <p className="text-[oklch(0.52_0.008_240)] mt-1 text-sm">Monthly retainers with flexible SLA options.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="sg-card flex flex-col"
                style={{
                  borderColor: tier.highlight ? AMBER_BORDER : "oklch(0.18 0.008 240)",
                  borderTopColor: tier.highlight ? AMBER : "oklch(0.18 0.008 240)",
                  borderTopWidth: tier.highlight ? "2px" : "1px",
                }}
              >
                {tier.highlight && (
                  <div
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold tracking-widest uppercase mb-3 px-2 py-0.5 rounded-full border w-fit"
                    style={{ color: AMBER, borderColor: AMBER_BORDER, background: AMBER_MUTED }}
                  >
                    <Shield size={9} /> Most Popular
                  </div>
                )}
                <h3 className="font-semibold text-white mb-2">{tier.name}</h3>
                <div className="mb-5">
                  <span className="text-3xl font-bold tracking-tight" style={{ color: AMBER }}>{tier.price}</span>
                  <span className="text-[oklch(0.45_0.008_240)] text-sm ml-1">{tier.unit}</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[oklch(0.58_0.008_240)]">
                      <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: AMBER }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <span className={tier.highlight ? "btn-primary w-full justify-center" : "btn-default w-full justify-center"}>
                    Get Started Free
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="sg-card text-center py-14 px-8">
            <div className="section-label mx-auto justify-center mb-4" style={{ color: AMBER }}>Get Started</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white mb-3">
              Your Robot Deserves Always-On Support
            </h2>
            <p className="text-[oklch(0.52_0.008_240)] mb-7 max-w-md mx-auto text-sm leading-relaxed">
              Register your company for free and add StageHand™ to your service plan.
              No commitment until you're ready.
            </p>
            <Link href="/register">
              <span className="btn-primary">
                Register Free Today <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
