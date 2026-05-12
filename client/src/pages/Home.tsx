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

/* ── Animated counter hook ─────────────────────────────────────────────────── */
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

/* ── Service definitions ────────────────────────────────────────────────────── */
const SERVICE_META: Record<string, { icon: React.ElementType; cat: string; color: string; bg: string }> = {
  "Inbound Logistics":       { icon: Package,       cat: "svc-logistics",  color: "oklch(0.52 0.22 262)", bg: "oklch(0.52 0.22 262 / 0.08)" },
  "Warehousing & Storage":   { icon: Warehouse,     cat: "svc-storage",    color: "oklch(0.55 0.20 295)", bg: "oklch(0.55 0.20 295 / 0.08)" },
  "Staging & Activation":    { icon: Zap,           cat: "svc-activation", color: "oklch(0.55 0.18 145)", bg: "oklch(0.55 0.18 145 / 0.08)" },
  "Live Technical Support":  { icon: Headphones,    cat: "svc-support",    color: "oklch(0.62 0.17 55)",  bg: "oklch(0.62 0.17 55 / 0.08)"  },
  "StageHand 24/7™":         { icon: Clock,         cat: "svc-support",    color: "oklch(0.62 0.17 55)",  bg: "oklch(0.62 0.17 55 / 0.08)"  },
  "StagePro Training™":      { icon: GraduationCap, cat: "svc-storage",    color: "oklch(0.55 0.20 295)", bg: "oklch(0.55 0.20 295 / 0.08)" },
  "Showroom & Demo":         { icon: Monitor,       cat: "svc-logistics",  color: "oklch(0.52 0.22 262)", bg: "oklch(0.52 0.22 262 / 0.08)" },
  "Robot Sales & Marketing": { icon: TrendingUp,    cat: "svc-marketing",  color: "oklch(0.58 0.20 20)",  bg: "oklch(0.58 0.20 20 / 0.08)"  },
};

const MARQUEE_ITEMS = [
  "CES 2026", "Manifest 2026", "MINExpo", "IAAPA Expo", "InfoComm",
  "Automate", "IMTS", "World Petroleum Congress", "NAB Show",
  "MODEX", "ProMat", "PACK EXPO", "AWS re:Invent", "GTC",
];

const CITIES = [
  { city: "Las Vegas, NV", shows: "CES · Manifest · MINExpo",    status: "Live",  statusColor: "oklch(0.45 0.18 145)", statusBg: "oklch(0.45 0.18 145 / 0.08)", statusBorder: "oklch(0.45 0.18 145 / 0.25)" },
  { city: "Orlando, FL",   shows: "IAAPA · InfoComm · HIMSS",    status: "2026",  statusColor: "oklch(0.52 0.22 262)", statusBg: "oklch(0.52 0.22 262 / 0.08)", statusBorder: "oklch(0.52 0.22 262 / 0.25)" },
  { city: "Chicago, IL",   shows: "Automate · IMTS · PACK EXPO", status: "2026",  statusColor: "oklch(0.52 0.22 262)", statusBg: "oklch(0.52 0.22 262 / 0.08)", statusBorder: "oklch(0.52 0.22 262 / 0.25)" },
  { city: "Houston, TX",   shows: "OTC · World Petroleum",       status: "2027",  statusColor: "oklch(0.52 0.18 295)", statusBg: "oklch(0.52 0.18 295 / 0.08)", statusBorder: "oklch(0.52 0.18 295 / 0.25)" },
];

const BRAND_CARDS = [
  {
    slug: "/services",
    label: "Core Platform",
    name: "StageGate",
    tm: false,
    desc: "End-to-end trade show infrastructure. Inbound logistics, warehousing, staging, activation, and live technical support for every show.",
    color: "oklch(0.52 0.22 262)",
    bg: "oklch(0.52 0.22 262 / 0.06)",
    icon: Zap,
    cta: "Explore Services",
  },
  {
    slug: "/stagehand",
    label: "24/7 Technical Support",
    name: "StageHand",
    tm: true,
    desc: "Ongoing remote and on-site technical support for robots in the field. Monthly retainers, SLA contracts, and emergency response.",
    color: "oklch(0.62 0.17 55)",
    bg: "oklch(0.62 0.17 55 / 0.06)",
    icon: Clock,
    cta: "Learn More",
  },
  {
    slug: "/stagepro",
    label: "Workforce Training",
    name: "StagePro",
    tm: true,
    desc: "Hands-on robot technician training under master supervision. 1-day workshops to 6-week certifications.",
    color: "oklch(0.55 0.20 295)",
    bg: "oklch(0.55 0.20 295 / 0.06)",
    icon: GraduationCap,
    cta: "Learn More",
  },
];

/* ── Main component ─────────────────────────────────────────────────────────── */
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
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "oklch(0.98 0.002 240)", color: "oklch(0.10 0.010 240)" }}
    >

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(oklch(0.80 0.008 240) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)",
          }}
        />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: Copy */}
            <div className="animate-fade-in-up">
              {/* Eyebrow */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-7"
                style={{
                  borderColor: "oklch(0.52 0.22 262 / 0.25)",
                  background: "oklch(0.52 0.22 262 / 0.06)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "oklch(0.52 0.22 262)" }}
                />
                <span
                  className="font-mono text-[10px] tracking-widest uppercase font-semibold"
                  style={{ color: "oklch(0.52 0.22 262)" }}
                >
                  Robotics Trade Show Infrastructure
                </span>
              </div>

              {/* Headline */}
              <h1
                className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6"
                style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.035em" }}
              >
                We Turn Shipped Robots{" "}
                <span style={{ color: "oklch(0.52 0.22 262)" }}>
                  Into Live Experiences
                </span>
              </h1>

              <p
                className="text-lg leading-relaxed mb-8 max-w-lg"
                style={{ color: "oklch(0.42 0.010 240)" }}
              >
                End-to-end logistics, warehousing, staging, activation, and technical support
                for robots at trade shows.{" "}
                <span style={{ color: "oklch(0.15 0.010 240)", fontWeight: 600 }}>
                  Your engineers stay home. Your robot performs perfectly.
                </span>
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Link href={ctaHref}>
                  <span className="btn-primary">
                    Register Free
                    <ArrowRight size={15} />
                  </span>
                </Link>
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="btn-default"
                >
                  Get a Quote
                  <ChevronRight size={15} />
                </button>
                <Link href="/services">
                  <span className="btn-default">
                    View Services
                    <ChevronRight size={15} />
                  </span>
                </Link>
              </div>

              {/* Trust signals */}
              <div
                className="flex flex-wrap gap-5 text-sm"
                style={{ color: "oklch(0.52 0.010 240)" }}
              >
                {[
                  { icon: CheckCircle2, text: "Free registration" },
                  { icon: Shield,       text: "No credit card required" },
                  { icon: MapPin,       text: "Las Vegas-based" },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5">
                    <Icon size={13} style={{ color: "oklch(0.52 0.22 262)" }} />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Hero image */}
            <div className="hidden lg:block animate-fade-in-up-delay relative">
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  aspectRatio: "4/3",
                  border: "1px solid oklch(0.88 0.006 240)",
                  boxShadow: "0 20px 60px oklch(0 0 0 / 0.12), 0 4px 16px oklch(0 0 0 / 0.06)",
                }}
              >
                <img
                  src="/manus-storage/robot-crate-hero_ad5ce8ec.jpg"
                  alt="Humanoid robot standing in an open wooden shipping crate inside a warehouse"
                  className="w-full h-full object-cover"
                />
                {/* Caption overlay */}
                <div
                  className="absolute bottom-0 left-0 right-0 p-4"
                  style={{
                    background: "linear-gradient(to top, oklch(0.10 0.010 240 / 0.85) 0%, transparent 100%)",
                  }}
                >
                  <p className="font-mono text-[10px] tracking-wider uppercase text-white/70">
                    Humanoid robot · Inbound logistics · Las Vegas
                  </p>
                </div>
              </div>
              {/* Floating stat badge */}
              <div
                className="absolute -bottom-4 -left-4 rounded-xl px-4 py-3"
                style={{
                  background: "oklch(1.00 0.000 0)",
                  border: "1px solid oklch(0.88 0.006 240)",
                  boxShadow: "0 8px 24px oklch(0 0 0 / 0.10)",
                }}
              >
                <div
                  className="text-2xl font-extrabold tracking-tight"
                  style={{ color: "oklch(0.10 0.010 240)" }}
                >
                  8
                </div>
                <div className="text-xs" style={{ color: "oklch(0.52 0.010 240)" }}>Service Lines</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SHOW SEARCH ──────────────────────────────────────────────────────── */}
      <section
        className="py-12 border-y"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(1.00 0.000 0)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <div className="section-label mx-auto justify-center mb-2">Find Your Show</div>
            <h2
              className="text-xl font-bold tracking-tight"
              style={{ color: "oklch(0.10 0.010 240)" }}
            >
              Search upcoming Las Vegas trade shows
            </h2>
            <p className="text-sm mt-1" style={{ color: "oklch(0.50 0.010 240)" }}>
              Select your event to see available services and book your robot's spot.
            </p>
          </div>
          <ShowSearchBar showCityFilter={true} />
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────────────── */}
      <div
        className="border-b py-3 overflow-hidden"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(0.97 0.003 240)" }}
      >
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3 mx-8">
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: "oklch(0.52 0.22 262 / 0.40)" }}
              />
              <span
                className="font-mono text-[11px] tracking-widest uppercase"
                style={{ color: "oklch(0.55 0.010 240)" }}
              >
                {item}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section
        ref={statsRef}
        className="py-20 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label">The Problem We Solve</div>
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
            >
              Trade Shows Are Brutal for Robot Companies
            </h2>
          </div>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl overflow-hidden border"
            style={{ borderColor: "oklch(0.88 0.006 240)" }}
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
                  background: "oklch(1.00 0.000 0)",
                  borderRight: i < 3 ? "1px solid oklch(0.90 0.005 240)" : "none",
                }}
              >
                <div
                  className="stat-number mb-2"
                  style={{ color: accent ? "oklch(0.52 0.22 262)" : "oklch(0.08 0.010 240)" }}
                >
                  {value}
                </div>
                <p className="text-xs leading-snug" style={{ color: "oklch(0.52 0.010 240)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────────── */}
      <section
        className="py-24 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(0.97 0.003 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <div className="section-label">Service Catalog</div>
              <h2
                className="text-3xl font-extrabold tracking-tight"
                style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
              >
                Everything Your Robot Needs,{" "}
                <span style={{ color: "oklch(0.52 0.22 262)" }}>From Crate to Stage</span>
              </h2>
            </div>
            <Link href="/services">
              <span className="btn-default text-sm flex-shrink-0">
                View all services
                <ArrowRight size={14} />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(services || []).map((svc) => {
              const meta = SERVICE_META[svc.name] || { icon: Star, cat: "svc-activation", color: "oklch(0.52 0.22 262)", bg: "oklch(0.52 0.22 262 / 0.08)" };
              const Icon = meta.icon;
              return (
                <div key={svc.id} className={`svc-card ${meta.cat}`}>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: meta.bg, border: `1px solid ${meta.color.replace(")", " / 0.20)")}` }}
                  >
                    <Icon size={16} style={{ color: meta.color }} />
                  </div>
                  <h3
                    className="font-bold text-sm mb-2 leading-snug"
                    style={{ color: "oklch(0.10 0.010 240)" }}
                  >
                    {svc.name}
                  </h3>
                  <p
                    className="text-xs leading-relaxed mb-4 flex-1 line-clamp-3"
                    style={{ color: "oklch(0.50 0.010 240)" }}
                  >
                    {svc.description}
                  </p>
                  <div className="font-mono text-xs" style={{ color: meta.color }}>
                    From {svc.basePrice ? `$${Number(svc.basePrice).toLocaleString()}` : "—"}{" "}
                    <span style={{ color: "oklch(0.60 0.010 240)", fontFamily: "inherit" }}>{svc.priceUnit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section
        className="py-24 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <div className="section-label">Process</div>
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
            >
              How StageGate Works
            </h2>
            <p className="mt-2 text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>
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
                    style={{ background: "linear-gradient(to right, oklch(0.85 0.006 240), transparent)" }}
                  />
                )}
                <div className="sg-card h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color: "oklch(0.52 0.22 262)" }}
                    >
                      {step}
                    </span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: "oklch(0.52 0.22 262 / 0.08)",
                        border: "1px solid oklch(0.52 0.22 262 / 0.18)",
                      }}
                    >
                      <Icon size={14} style={{ color: "oklch(0.52 0.22 262)" }} />
                    </div>
                  </div>
                  <h3
                    className="font-bold text-sm mb-2"
                    style={{ color: "oklch(0.10 0.010 240)" }}
                  >
                    {title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.50 0.010 240)" }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE BRANDS ─────────────────────────────────────────────────────── */}
      <section
        className="py-24 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(0.97 0.003 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <div className="section-label">Brand Architecture</div>
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
            >
              Three Brands, One Platform
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {BRAND_CARDS.map(({ slug, label, name, tm, desc, color, bg, icon: Icon, cta }) => (
              <div
                key={name}
                className="sg-card group flex flex-col"
                style={{ borderTopColor: color, borderTopWidth: "3px" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: bg, border: `1px solid ${color.replace(")", " / 0.20)")}` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div
                  className="font-mono text-[10px] tracking-widest uppercase font-semibold mb-1"
                  style={{ color }}
                >
                  {label}
                </div>
                <h3
                  className="text-xl font-extrabold mb-3"
                  style={{ color: "oklch(0.10 0.010 240)", letterSpacing: "-0.025em" }}
                >
                  {name}{tm && <sup className="text-xs font-normal">™</sup>}
                </h3>
                <p
                  className="text-sm leading-relaxed mb-6 flex-1"
                  style={{ color: "oklch(0.45 0.010 240)" }}
                >
                  {desc}
                </p>
                <Link href={slug}>
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all"
                    style={{ color }}
                  >
                    {cta} <ArrowRight size={13} />
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITIES ───────────────────────────────────────────────────────────── */}
      <section
        className="py-20 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label">Expansion</div>
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
            >
              Expanding Across Convention Cities
            </h2>
            <p className="mt-2 text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>
              Starting in Las Vegas, growing to every major trade show market.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CITIES.map(({ city, shows, status, statusColor, statusBg, statusBorder }) => (
              <div key={city} className="sg-card">
                <div className="flex items-start justify-between mb-3">
                  <MapPin size={14} style={{ color: "oklch(0.52 0.22 262 / 0.60)", marginTop: "2px" }} />
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                    style={{ color: statusColor, background: statusBg, borderColor: statusBorder }}
                  >
                    {status}
                  </span>
                </div>
                <div
                  className="font-bold text-sm mb-1"
                  style={{ color: "oklch(0.10 0.010 240)" }}
                >
                  {city}
                </div>
                <div className="text-[11px] leading-relaxed" style={{ color: "oklch(0.52 0.010 240)" }}>
                  {shows}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "oklch(0.10 0.010 240)" }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div
            className="section-label mx-auto justify-center mb-4"
            style={{ color: "oklch(0.52 0.22 262)" }}
          >
            Get Started
          </div>
          <h2
            className="text-4xl font-extrabold tracking-tight mb-4"
            style={{ color: "oklch(0.97 0.002 240)", letterSpacing: "-0.035em" }}
          >
            Ready to Bring Your Robot{" "}
            <span style={{ color: "oklch(0.68 0.20 262)" }}>to the Show Floor?</span>
          </h2>
          <p className="mb-8 max-w-md mx-auto text-sm leading-relaxed" style={{ color: "oklch(0.62 0.010 240)" }}>
            Register your company for free. No credit card, no commitment.
            Just your robot and our infrastructure.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={ctaHref}>
              <span className="btn-primary">
                Register Free Today
                <ArrowRight size={15} />
              </span>
            </Link>
            <Link href="/services">
              <span
                className="btn-default"
                style={{
                  background: "oklch(1.00 0.000 0 / 0.08)",
                  borderColor: "oklch(1.00 0.000 0 / 0.20)",
                  color: "oklch(0.90 0.005 240)",
                }}
              >
                View Pricing
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer
        className="border-t py-10"
        style={{ borderColor: "oklch(0.20 0.010 240)", background: "oklch(0.10 0.010 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: "oklch(0.52 0.22 262)" }}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L2 8h5l-1 5 6-7H7l1-5z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-sm tracking-tight" style={{ color: "oklch(0.95 0.003 240)" }}>
              StageGate
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs" style={{ color: "oklch(0.52 0.010 240)" }}>
            <Link href="/services"><span className="hover:text-white transition-colors cursor-pointer">Services</span></Link>
            <Link href="/stagehand"><span className="hover:text-white transition-colors cursor-pointer">StageHand™</span></Link>
            <Link href="/stagepro"><span className="hover:text-white transition-colors cursor-pointer">StagePro™</span></Link>
            <Link href="/register"><span className="hover:text-white transition-colors cursor-pointer">Register</span></Link>
          </div>
          <p className="text-xs" style={{ color: "oklch(0.38 0.008 240)" }}>
            © 2026 StageGate. StageHand™ and StagePro™ are trademarks of StageGate.
          </p>
        </div>
      </footer>
    </div>
    <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  );
}
