import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Clock, Shield, ArrowRight, Wrench, AlertCircle,
  Activity, Phone, CheckCircle2
} from "lucide-react";

const AMBER = "oklch(0.78 0.18 70)";
const AMBER_GLOW = "oklch(0.78 0.18 70 / 0.25)";
const AMBER_DIM  = "oklch(0.78 0.18 70 / 0.10)";
const AMBER_BORDER = "oklch(0.78 0.18 70 / 0.25)";

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
  { icon: AlertCircle, title: "Emergency Repair", desc: "Robot breaks down mid-demo at a trade show. StageHand™ dispatches a technician within hours." },
  { icon: Activity,    title: "Deployment Monitoring", desc: "Robots deployed in hotels, airports, or retail locations monitored 24/7 with proactive alerts." },
  { icon: Wrench,      title: "Scheduled Maintenance", desc: "Quarterly on-site inspections, firmware updates, and preventive maintenance to avoid failures." },
  { icon: Phone,       title: "Remote Diagnostics", desc: "Most issues resolved remotely in under 30 minutes via secure connection to your robot's systems." },
];

export default function StageHandPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-28 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: "oklch(0.78 0.18 70 / 0.06)" }}
        />
        <div className="container relative z-10 text-center">
          {/* Icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: AMBER_DIM,
              border: `1px solid ${AMBER_BORDER}`,
              boxShadow: `0 0 30px ${AMBER_GLOW}`,
            }}
          >
            <Clock size={30} style={{ color: AMBER }} />
          </div>

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6"
            style={{ color: AMBER, borderColor: AMBER_BORDER, background: AMBER_DIM }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: AMBER }} />
            <span className="font-mono text-xs tracking-widest uppercase">24/7 Technical Support</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-4">
            StageHand<sup className="text-2xl font-normal">™</sup>
          </h1>
          <p className="text-xl text-[oklch(0.60_0.010_240)] max-w-2xl mx-auto mb-8 leading-relaxed">
            Ongoing remote and on-site technical support for robots in the field.
            When your robot needs help, we're already there.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <button
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-display font-bold text-sm transition-all duration-200"
                style={{
                  background: AMBER,
                  color: "oklch(0.06 0.008 240)",
                  boxShadow: `0 0 24px ${AMBER_GLOW}`,
                }}
              >
                Get Started Free <ArrowRight size={15} />
              </button>
            </Link>
            <Link href="/order">
              <button
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-display font-semibold text-sm border transition-all duration-200"
                style={{ borderColor: AMBER_BORDER, color: AMBER, background: "transparent" }}
              >
                Book Support Now
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section
        className="py-10 border-y"
        style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.09 0.008 240)" }}
      >
        <div className="container">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "24/7", label: "Always Available" },
              { value: "<4hr", label: "Emergency Response SLA" },
              { value: "All", label: "Robot Brands Supported" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="font-display font-bold text-3xl mb-1" style={{ color: AMBER }}>{value}</div>
                <div className="text-xs text-[oklch(0.52_0.010_240)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <div className="section-label mx-auto justify-center" style={{ color: AMBER }}>
              <span className="w-6 h-px mr-2 inline-block" style={{ background: AMBER }} />
              Use Cases
            </div>
            <h2 className="text-3xl font-display font-bold text-white">When You Need StageHand™</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {USE_CASES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-4 p-6 rounded-xl border transition-all duration-200 group hover:border-[oklch(0.78_0.18_70/0.30)]"
                style={{
                  borderColor: "oklch(0.78 0.18 70 / 0.15)",
                  background: "oklch(0.78 0.18 70 / 0.04)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}` }}
                >
                  <Icon size={18} style={{ color: AMBER }} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm text-[oklch(0.58_0.010_240)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        className="py-20 border-y"
        style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.08 0.008 240)" }}
      >
        <div className="container">
          <div className="text-center mb-12">
            <div className="section-label mx-auto justify-center" style={{ color: AMBER }}>
              <span className="w-6 h-px mr-2 inline-block" style={{ background: AMBER }} />
              Pricing
            </div>
            <h2 className="text-3xl font-display font-bold text-white mb-2">StageHand™ Plans</h2>
            <p className="text-[oklch(0.55_0.010_240)]">Monthly retainers with flexible SLA options.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="relative p-8 rounded-2xl border overflow-hidden"
                style={{
                  borderColor: tier.highlight ? "oklch(0.78 0.18 70 / 0.40)" : "oklch(0.20 0.010 240)",
                  background: tier.highlight
                    ? "linear-gradient(135deg, oklch(0.78 0.18 70 / 0.08) 0%, oklch(0.10 0.010 240) 100%)"
                    : "oklch(0.10 0.010 240)",
                }}
              >
                {tier.highlight && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.78_0.18_70/0.60)] to-transparent" />
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold tracking-widest uppercase mb-4"
                      style={{ color: AMBER, borderColor: AMBER_BORDER, background: AMBER_DIM }}
                    >
                      <Shield size={10} />
                      Most Popular
                    </div>
                  </>
                )}
                <h3 className="font-display font-bold text-lg text-white mb-2">{tier.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-display font-bold" style={{ color: AMBER }}>{tier.price}</span>
                  <span className="text-[oklch(0.50_0.010_240)] text-sm ml-1">{tier.unit}</span>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[oklch(0.60_0.010_240)]">
                      <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: AMBER }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <button
                    className="w-full py-2.5 rounded-lg font-display font-bold text-sm transition-all duration-200"
                    style={tier.highlight
                      ? { background: AMBER, color: "oklch(0.06 0.008 240)", boxShadow: `0 0 20px ${AMBER_GLOW}` }
                      : { background: "transparent", border: `1px solid ${AMBER_BORDER}`, color: AMBER }
                    }
                  >
                    Get Started Free
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-3xl font-display font-bold text-white mb-4">
            Your Robot Deserves<br />
            <span style={{ color: AMBER }}>Always-On Support</span>
          </h2>
          <p className="text-[oklch(0.55_0.010_240)] mb-8 max-w-xl mx-auto">
            Register your company for free and add StageHand™ to your service plan.
            No commitment until you're ready.
          </p>
          <Link href="/register">
            <button
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-display font-bold text-base transition-all duration-200"
              style={{
                background: AMBER,
                color: "oklch(0.06 0.008 240)",
                boxShadow: `0 0 28px ${AMBER_GLOW}`,
              }}
            >
              Register Free Today <ArrowRight size={18} />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
