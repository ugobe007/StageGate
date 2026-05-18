import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Clock, Shield, ArrowRight, Wrench, AlertCircle,
  Activity, Phone, CheckCircle2
} from "lucide-react";

/* ── Palette ─────────────────────────────────────────────────────────── */
const BG     = "oklch(0.11 0.012 262)";
const CARD   = "oklch(0.14 0.014 262)";
const BORDER = "oklch(0.22 0.016 262)";
const AMBER  = "oklch(0.70 0.17 55)";
const TEXT_HI  = "oklch(0.93 0.005 240)";
const TEXT_MID = "oklch(0.70 0.008 240)";
const TEXT_DIM = "oklch(0.50 0.010 240)";

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
      "Dedicated technician: Max",
      "Priority parts sourcing",
      "Quarterly on-site inspections",
    ],
    highlight: true,
  },
];

const USE_CASES = [
  { icon: AlertCircle, title: "Emergency Repair",       desc: "Robot breaks down mid-demo at a trade show. Max coordinates a technician within hours." },
  { icon: Activity,    title: "Deployment Monitoring",  desc: "Robots deployed in hotels, airports, or retail locations monitored 24/7 with proactive alerts." },
  { icon: Wrench,      title: "Scheduled Maintenance",  desc: "Quarterly on-site inspections, firmware updates, and preventive maintenance to avoid failures." },
  { icon: Phone,       title: "Remote Diagnostics",     desc: "Most issues resolved remotely in under 30 minutes via secure connection to your robot's systems." },
];

const WORKFLOW = [
  { step: "01", title: "Capture the issue", desc: "Submit the robot model, location, error state, urgency, and any photos or logs from the field." },
  { step: "02", title: "Max triages", desc: "Max separates software, operator, hardware, and show-floor problems so the right response starts fast." },
  { step: "03", title: "Remote first", desc: "StageGate attempts diagnostics, reset guidance, firmware review, and operator coaching before dispatching." },
  { step: "04", title: "Dispatch if needed", desc: "If the robot needs hands-on support, a technician is coordinated for show-floor or customer-site service." },
  { step: "05", title: "Close the loop", desc: "You receive the fix summary, parts notes, next maintenance recommendation, and follow-up schedule." },
];

export default function StageHandPage() {
  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT_HI }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-36 pb-20 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Icon — stroke only */}
          <div
            className="w-12 h-12 rounded flex items-center justify-center mx-auto mb-6"
            style={{ border: `1px solid ${AMBER}55`, background: `${AMBER}0d` }}
          >
            <Clock size={22} style={{ color: AMBER }} />
          </div>

          {/* Eyebrow — stroke badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6"
            style={{ color: AMBER, borderColor: `${AMBER}55`, background: `${AMBER}0d` }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: AMBER }} />
            <span className="font-mono text-[10px] tracking-widest uppercase">24/7 Technical Support</span>
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold mb-4"
            style={{ color: TEXT_HI, letterSpacing: "-0.035em" }}
          >
            StageHand<sup className="text-xl font-normal align-super">™</sup>
          </h1>
          <p className="text-base max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: TEXT_MID }}>
            StageHand™ is the support layer for robots already in the field: remote diagnostics,
            show-floor triage, emergency dispatch, and maintenance planning led by Max.
            When your robot needs help, the workflow is already defined.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <span className="btn-primary">Get started free <ArrowRight size={14} /></span>
            </Link>
            <Link href="/order">
              <span className="btn-default">Book support now</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Definition ─────────────────────────────────────────────────────── */}
      <section className="py-16 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-10">
            <div>
              <p className="section-label mb-3" style={{ color: AMBER }}>Definition</p>
              <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
                Technical support after the sale.
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: TEXT_MID }}>
              <p>
                StageHand™ gives robot companies and operators a named service path when something breaks,
                stalls, or needs expert attention. It is designed for trade shows, showroom demos, pilots,
                and deployed customer environments where downtime is expensive.
              </p>
              <p>
                Max handles the technical question first: what failed, who needs to act, what can be solved
                remotely, and when a technician needs to be on site.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow ───────────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2" style={{ color: AMBER }}>Workflow</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              From issue report to resolution record.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
            {WORKFLOW.map((item, index) => (
              <div
                key={item.step}
                className="p-5 border-t md:border-t-0"
                style={{ borderColor: BORDER, borderLeft: index === 0 ? "none" : `1px solid ${BORDER}` }}
              >
                <div className="font-mono text-2xl font-bold mb-4" style={{ color: `${AMBER}66` }}>{item.step}</div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: TEXT_HI }}>{item.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: TEXT_DIM }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "24/7",  label: "Always Available" },
              { value: "<4hr",  label: "Emergency Response SLA" },
              { value: "All",   label: "Robot Brands Supported" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div
                  className="text-3xl font-bold tracking-tight mb-1"
                  style={{ color: AMBER, letterSpacing: "-0.03em" }}
                >
                  {value}
                </div>
                <div className="text-xs" style={{ color: TEXT_DIM }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Use Cases ─────────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2" style={{ color: AMBER }}>Use Cases</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              When You Need StageHand™
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {USE_CASES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border p-5 flex gap-4 transition-colors"
                style={{ background: CARD, borderColor: BORDER }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${AMBER}44`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
              >
                <div
                  className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                  style={{ border: `1px solid ${AMBER}44`, background: `${AMBER}0d` }}
                >
                  <Icon size={15} style={{ color: AMBER }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: TEXT_HI }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: TEXT_DIM }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2" style={{ color: AMBER }}>Pricing</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              StageHand™ Plans
            </h2>
            <p className="mt-1 text-sm" style={{ color: TEXT_DIM }}>
              Monthly retainers with flexible SLA options.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="rounded-xl border p-6 flex flex-col gap-4"
                style={{
                  background: BG,
                  borderColor: tier.highlight ? `${AMBER}55` : BORDER,
                }}
              >
                {tier.highlight && (
                  <div
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full border w-fit"
                    style={{ color: AMBER, borderColor: `${AMBER}44`, background: `${AMBER}0d` }}
                  >
                    <Shield size={9} /> Most Popular
                  </div>
                )}
                <h3 className="font-semibold" style={{ color: TEXT_HI }}>{tier.name}</h3>
                <div>
                  <span className="text-3xl font-bold tracking-tight" style={{ color: AMBER, letterSpacing: "-0.03em" }}>
                    {tier.price}
                  </span>
                  <span className="text-sm ml-1" style={{ color: TEXT_DIM }}>{tier.unit}</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: TEXT_MID }}>
                      <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: AMBER }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <span className={`${tier.highlight ? "btn-primary" : "btn-default"} w-full justify-center`}
                    style={tier.highlight ? { borderColor: `${AMBER}55`, color: AMBER, background: `${AMBER}0d` } : {}}
                  >
                    Get started free
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="section-label mx-auto justify-center mb-4" style={{ color: AMBER }}>Get Started</p>
          <h2 className="text-3xl font-bold mb-3" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
            Your Robot Deserves Always-On Support
          </h2>
          <p className="mb-7 max-w-md mx-auto text-sm leading-relaxed" style={{ color: TEXT_DIM }}>
            Register your company for free and add StageHand™ to your service plan.
            No commitment until you're ready.
          </p>
          <Link href="/register">
            <span className="btn-primary" style={{ borderColor: `${AMBER}55`, color: AMBER, background: `${AMBER}0d` }}>
              Register free today <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
