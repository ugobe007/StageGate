import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowRight, Package, Warehouse, Zap, Headphones, Clock,
  GraduationCap, Monitor, TrendingUp, MapPin, ChevronRight,
  Star, CheckCircle2, Shield
} from "lucide-react";
import ShowSearchBar from "@/components/ShowSearchBar";
import GetQuoteModal from "@/components/GetQuoteModal";

/* ── Palette ─────────────────────────────────────────────────────────────── */
const BG        = "oklch(0.11 0.012 262)";
const CARD      = "oklch(0.14 0.014 262)";
const BORDER    = "oklch(0.22 0.016 262)";
const INDIGO    = "oklch(0.72 0.20 262)";
const INDIGO_DIM= "oklch(0.62 0.24 262 / 0.55)";
const INDIGO_BG = "oklch(0.62 0.24 262 / 0.08)";
const CYAN      = "oklch(0.75 0.18 200)";
const TEXT_HI   = "oklch(0.93 0.005 240)";
const TEXT_MID  = "oklch(0.70 0.008 240)";
const TEXT_DIM  = "oklch(0.50 0.010 240)";

/* ── Animated counter hook ─────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1600, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setValue(target); return; }
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setValue(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

/* ── Service meta ─────────────────────────────────────────────────────── */
const SERVICE_META: Record<string, { icon: React.ElementType; color: string }> = {
  "Inbound Logistics":       { icon: Package,       color: INDIGO },
  "Warehousing & Storage":   { icon: Warehouse,     color: "oklch(0.65 0.20 295)" },
  "Staging & Activation":    { icon: Zap,           color: CYAN },
  "Live Technical Support":  { icon: Headphones,    color: "oklch(0.70 0.17 55)" },
  "StageHand 24/7™":         { icon: Clock,         color: "oklch(0.70 0.17 55)" },
  "StagePro Training™":      { icon: GraduationCap, color: "oklch(0.65 0.20 295)" },
  "Showroom & Demo":         { icon: Monitor,       color: INDIGO },
  "Robot Sales & Marketing": { icon: TrendingUp,    color: "oklch(0.62 0.20 20)" },
};

const MARQUEE_ITEMS = [
  "CES 2026", "Manifest 2026", "MINExpo", "IAAPA Expo", "InfoComm",
  "Automate", "IMTS", "World Petroleum Congress", "NAB Show",
  "MODEX", "ProMat", "PACK EXPO", "AWS re:Invent", "GTC",
];

const CITIES = [
  { city: "Las Vegas, NV", shows: "CES · Manifest · MINExpo",    status: "Live"  },
  { city: "Orlando, FL",   shows: "IAAPA · InfoComm · HIMSS",    status: "2026"  },
  { city: "Chicago, IL",   shows: "Automate · IMTS · PACK EXPO", status: "2026"  },
  { city: "Houston, TX",   shows: "OTC · World Petroleum",       status: "2027"  },
];

const BRAND_CARDS = [
  {
    slug: "/services",
    label: "Core Platform",
    name: "StageGate",
    tm: false,
    desc: "End-to-end trade show infrastructure. Inbound logistics, warehousing, staging, activation, and live technical support for every show.",
    color: INDIGO,
    icon: Zap,
    cta: "Explore Services",
  },
  {
    slug: "/stagehand",
    label: "24/7 Technical Support",
    name: "StageHand",
    tm: true,
    desc: "Ongoing remote and on-site technical support for robots in the field. Monthly retainers, SLA contracts, and emergency response.",
    color: "oklch(0.70 0.17 55)",
    icon: Clock,
    cta: "Learn More",
  },
  {
    slug: "/stagepro",
    label: "Workforce Training",
    name: "StagePro",
    tm: true,
    desc: "Hands-on robot technician training under master supervision. 1-day workshops to 6-week certifications.",
    color: "oklch(0.65 0.20 295)",
    icon: GraduationCap,
    cta: "Learn More",
  },
];

/* ── Component ────────────────────────────────────────────────────────── */
export default function Home() {
  const { isAuthenticated } = useAuth();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const { data: services } = trpc.services.list.useQuery();

  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const c1 = useCountUp(25, 1600, statsVisible);
  const c2 = useCountUp(72, 1600, statsVisible);
  const ctaHref = isAuthenticated ? "/dashboard" : "/register";

  return (
    <>
    <div className="min-h-screen overflow-x-hidden" style={{ background: BG, color: TEXT_HI }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: Copy */}
            <div>
              {/* Eyebrow badge — stroke only */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-7"
                style={{ borderColor: INDIGO_DIM, background: INDIGO_BG }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INDIGO }} />
                <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: INDIGO }}>
                  Robotics Trade Show Infrastructure
                </span>
              </div>

              {/* Headline */}
              <h1
                className="text-5xl sm:text-6xl font-bold leading-[1.05] mb-6"
                style={{ color: TEXT_HI, letterSpacing: "-0.03em" }}
              >
                We Turn Shipped Robots{" "}
                <span
                  style={{
                    background: `linear-gradient(90deg, ${INDIGO} 0%, ${CYAN} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Into Live Experiences
                </span>
              </h1>

              <p className="text-base leading-relaxed mb-8 max-w-lg" style={{ color: TEXT_MID }}>
                End-to-end logistics, warehousing, staging, activation, and technical support
                for robots at trade shows.{" "}
                <span style={{ color: TEXT_HI }}>
                  Your engineers stay home. Your robot performs perfectly.
                </span>
              </p>

              {/* CTAs — stroke only */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Link href={ctaHref}>
                  <span className="btn-primary">
                    Start free <ArrowRight size={14} />
                  </span>
                </Link>
                <button onClick={() => setQuoteOpen(true)} className="btn-default">
                  Get a quote <ChevronRight size={14} />
                </button>
                <Link href="/services">
                  <span className="btn-default">
                    View services <ChevronRight size={14} />
                  </span>
                </Link>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap gap-5 text-sm" style={{ color: TEXT_DIM }}>
                {[
                  { icon: CheckCircle2, text: "Free registration" },
                  { icon: Shield,       text: "No credit card required" },
                  { icon: MapPin,       text: "Las Vegas-based" },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5">
                    <Icon size={12} style={{ color: INDIGO }} />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Hero image */}
            <div className="hidden lg:block relative">
              <div
                className="relative rounded-xl overflow-hidden"
                style={{
                  aspectRatio: "4/3",
                  border: `1px solid ${BORDER}`,
                }}
              >
                <img
                  src="/manus-storage/robot-crate-hero_ad5ce8ec.jpg"
                  alt="Humanoid robot standing in an open wooden shipping crate inside a warehouse"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute bottom-0 left-0 right-0 p-4"
                  style={{ background: "linear-gradient(to top, oklch(0.08 0.012 262 / 0.90) 0%, transparent 100%)" }}
                >
                  <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "oklch(0.60 0.010 240)" }}>
                    Humanoid robot · Inbound logistics · Las Vegas
                  </p>
                </div>
              </div>
              {/* Floating stat — stroke card */}
              <div
                className="absolute -bottom-4 -left-4 rounded-lg px-4 py-3"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="text-2xl font-bold" style={{ color: TEXT_HI }}>8</div>
                <div className="text-xs" style={{ color: TEXT_DIM }}>Service Lines</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SHOW SEARCH ──────────────────────────────────────────────────── */}
      <section className="py-12 border-y" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <p className="section-label mx-auto justify-center mb-2">Find Your Show</p>
            <h2 className="text-xl font-bold" style={{ color: TEXT_HI }}>
              Search upcoming Las Vegas trade shows
            </h2>
            <p className="text-sm mt-1" style={{ color: TEXT_DIM }}>
              Select your event to see available services and book your robot's spot.
            </p>
          </div>
          <ShowSearchBar showCityFilter={true} />
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────────── */}
      <div className="border-b py-3 overflow-hidden" style={{ borderColor: BORDER }}>
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3 mx-8">
              <span className="w-1 h-1 rounded-full" style={{ background: INDIGO_DIM }} />
              <span className="font-mono text-[11px] tracking-widest uppercase" style={{ color: TEXT_DIM }}>
                {item}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-20 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2">The Problem We Solve</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              Trade Shows Are Brutal for Robot Companies
            </h2>
          </div>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden border"
            style={{ borderColor: BORDER }}
          >
            {[
              { value: `$${c1}K–$80K`, label: "Cost per show to fly in engineers", accent: true },
              { value: `${c2} hrs`,    label: "Average robot recovery time without local support", accent: false },
              { value: "1 in 3",       label: "Robots arrive at shows damaged or unprepared", accent: false },
              { value: "0",            label: "Dedicated robotics trade show infrastructure providers — until now", accent: true },
            ].map(({ value, label, accent }, i) => (
              <div
                key={label}
                className="p-8"
                style={{
                  background: CARD,
                  borderRight: i < 3 ? `1px solid ${BORDER}` : "none",
                }}
              >
                <div
                  className="text-3xl font-bold mb-2"
                  style={{
                    color: accent ? INDIGO : TEXT_HI,
                    letterSpacing: "-0.03em",
                    background: accent
                      ? `linear-gradient(90deg, ${INDIGO} 0%, ${CYAN} 100%)`
                      : "none",
                    WebkitBackgroundClip: accent ? "text" : "unset",
                    WebkitTextFillColor: accent ? "transparent" : "unset",
                    backgroundClip: accent ? "text" : "unset",
                  }}
                >
                  {value}
                </div>
                <p className="text-xs leading-snug" style={{ color: TEXT_DIM }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────── */}
      <section className="py-24 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <p className="section-label mb-2">Service Catalog</p>
              <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
                Everything Your Robot Needs,{" "}
                <span
                  style={{
                    background: `linear-gradient(90deg, ${INDIGO} 0%, ${CYAN} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  From Crate to Stage
                </span>
              </h2>
            </div>
            <Link href="/services">
              <span className="btn-default text-sm flex-shrink-0">
                View all services <ArrowRight size={13} />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(services || []).map((svc) => {
              const meta = SERVICE_META[svc.name] || { icon: Star, color: INDIGO };
              const Icon = meta.icon;
              return (
                <div
                  key={svc.id}
                  className="rounded-xl border p-5 flex flex-col gap-3 transition-colors"
                  style={{ background: BG, borderColor: BORDER }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.38 0.020 262)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
                >
                  {/* Icon — stroke badge */}
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center"
                    style={{ border: `1px solid ${meta.color}55`, background: `${meta.color}0d` }}
                  >
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <h3 className="font-semibold text-sm leading-snug" style={{ color: TEXT_HI }}>
                    {svc.name}
                  </h3>
                  <p className="text-xs leading-relaxed flex-1 line-clamp-3" style={{ color: TEXT_DIM }}>
                    {svc.description}
                  </p>
                  <div className="font-mono text-xs" style={{ color: meta.color }}>
                    From {svc.basePrice ? `$${Number(svc.basePrice).toLocaleString()}` : "—"}{" "}
                    <span style={{ color: TEXT_DIM }}>{svc.priceUnit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-24 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <p className="section-label mb-2">Process</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              How StageGate Works
            </h2>
            <p className="mt-2 text-sm" style={{ color: TEXT_DIM }}>
              Four steps from registration to a live robot on the show floor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Register Free",    desc: "Create your company profile and tell us about your robots. No commitment required.", icon: CheckCircle2 },
              { step: "02", title: "Select Your Show", desc: "Choose from upcoming trade shows in Las Vegas and beyond. We cover the major venues.", icon: MapPin },
              { step: "03", title: "Book Services",    desc: "Select the service bundle that fits your needs — logistics, activation, support, or all three.", icon: Package },
              { step: "04", title: "Show Up & Demo",   desc: "Your robot is unpacked, tested, and ready. You walk in and present. We handle the rest.", icon: Star },
            ].map(({ step, title, desc, icon: Icon }, i) => (
              <div key={step} className="relative">
                {i < 3 && (
                  <div
                    className="hidden lg:block absolute top-5 left-[calc(100%+0.5rem)] w-[calc(100%-1rem)] h-px z-10"
                    style={{ background: `linear-gradient(to right, ${BORDER}, transparent)` }}
                  />
                )}
                <div
                  className="h-full rounded-xl border p-5 flex flex-col gap-3"
                  style={{ background: CARD, borderColor: BORDER }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs" style={{ color: INDIGO }}>{step}</span>
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center"
                      style={{ border: `1px solid ${INDIGO}44`, background: INDIGO_BG }}
                    >
                      <Icon size={13} style={{ color: INDIGO }} />
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm" style={{ color: TEXT_HI }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: TEXT_DIM }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BRAND ARCHITECTURE ───────────────────────────────────────────── */}
      <section className="py-24 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <p className="section-label mb-2">Brand Architecture</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              Three Brands, One Platform
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {BRAND_CARDS.map(({ slug, label, name, tm, desc, color, icon: Icon, cta }) => (
              <div
                key={name}
                className="rounded-xl border p-6 flex flex-col gap-4 transition-colors"
                style={{ background: BG, borderColor: BORDER, borderTopColor: color, borderTopWidth: "1px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.38 0.020 262)"; (e.currentTarget as HTMLElement).style.borderTopColor = color; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.borderTopColor = color; }}
              >
                <div
                  className="w-9 h-9 rounded flex items-center justify-center"
                  style={{ border: `1px solid ${color}44`, background: `${color}0d` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{ color }}>
                    {label}
                  </p>
                  <h3 className="text-xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.02em" }}>
                    {name}{tm && <sup className="text-xs font-normal">™</sup>}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: TEXT_DIM }}>{desc}</p>
                <Link href={slug}>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70" style={{ color }}>
                    {cta} <ArrowRight size={13} />
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITIES ───────────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2">Expansion</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              Expanding Across Convention Cities
            </h2>
            <p className="mt-2 text-sm" style={{ color: TEXT_DIM }}>
              Starting in Las Vegas, growing to every major trade show market.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CITIES.map(({ city, shows, status }) => {
              const isLive = status === "Live";
              const statusColor = isLive ? "oklch(0.62 0.18 145)" : INDIGO;
              return (
                <div
                  key={city}
                  className="rounded-xl border p-5 transition-colors"
                  style={{ background: CARD, borderColor: BORDER }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <MapPin size={13} style={{ color: `${INDIGO}88`, marginTop: "2px" }} />
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                      style={{ color: statusColor, borderColor: `${statusColor}44`, background: `${statusColor}0d` }}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="font-semibold text-sm mb-1" style={{ color: TEXT_HI }}>{city}</div>
                  <div className="text-[11px] leading-relaxed" style={{ color: TEXT_DIM }}>{shows}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="section-label mx-auto justify-center mb-4">Get Started</p>
          <h2 className="text-4xl font-bold mb-4" style={{ color: TEXT_HI, letterSpacing: "-0.03em" }}>
            Ready to Bring Your Robot{" "}
            <span
              style={{
                background: `linear-gradient(90deg, ${INDIGO} 0%, ${CYAN} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              to the Show Floor?
            </span>
          </h2>
          <p className="mb-8 max-w-md mx-auto text-sm leading-relaxed" style={{ color: TEXT_DIM }}>
            Register your company for free. No credit card, no commitment.
            Just your robot and our infrastructure.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={ctaHref}>
              <span className="btn-primary">
                Register free today <ArrowRight size={14} />
              </span>
            </Link>
            <Link href="/services">
              <span className="btn-default">View pricing</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t py-10" style={{ borderColor: BORDER, background: BG }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ border: `1.5px solid ${INDIGO}`, color: INDIGO }}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L2 8h5l-1 5 6-7H7l1-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: TEXT_HI, letterSpacing: "-0.02em" }}>StageGate</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs" style={{ color: TEXT_DIM }}>
            <Link href="/services"><span className="hover:opacity-80 transition-opacity cursor-pointer">Services</span></Link>
            <Link href="/stagehand"><span className="hover:opacity-80 transition-opacity cursor-pointer">StageHand™</span></Link>
            <Link href="/stagepro"><span className="hover:opacity-80 transition-opacity cursor-pointer">StagePro™</span></Link>
            <Link href="/register"><span className="hover:opacity-80 transition-opacity cursor-pointer">Register</span></Link>
          </div>
          <p className="text-xs" style={{ color: "oklch(0.38 0.010 262)" }}>
            © 2026 StageGate. StageHand™ and StagePro™ are trademarks of StageGate.
          </p>
        </div>
      </footer>
    </div>
    <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  );
}
