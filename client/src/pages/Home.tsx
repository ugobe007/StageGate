import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
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
const SERVICE_META: Record<string, { icon: React.ElementType; cat: string; color: string; textColor: string }> = {
  "Inbound Logistics":       { icon: Package,       cat: "svc-logistics",  color: "oklch(0.65 0.18 245)", textColor: "oklch(0.75 0.15 245)" },
  "Warehousing & Storage":   { icon: Warehouse,     cat: "svc-storage",    color: "oklch(0.60 0.20 295)", textColor: "oklch(0.72 0.18 295)" },
  "Staging & Activation":    { icon: Zap,           cat: "svc-activation", color: "oklch(0.72 0.21 145)", textColor: "oklch(0.72 0.21 145)" },
  "Live Technical Support":  { icon: Headphones,    cat: "svc-support",    color: "oklch(0.78 0.17 70)",  textColor: "oklch(0.78 0.17 70)"  },
  "StageHand 24/7™":         { icon: Clock,         cat: "svc-support",    color: "oklch(0.78 0.17 70)",  textColor: "oklch(0.78 0.17 70)"  },
  "StagePro Training™":      { icon: GraduationCap, cat: "svc-storage",    color: "oklch(0.60 0.20 295)", textColor: "oklch(0.72 0.18 295)" },
  "Showroom & Demo":         { icon: Monitor,       cat: "svc-logistics",  color: "oklch(0.65 0.18 245)", textColor: "oklch(0.75 0.15 245)" },
  "Robot Sales & Marketing": { icon: TrendingUp,    cat: "svc-marketing",  color: "oklch(0.68 0.20 20)",  textColor: "oklch(0.75 0.18 20)"  },
};

const MARQUEE_ITEMS = [
  "CES 2026", "Manifest 2026", "MINExpo", "IAAPA Expo", "InfoComm",
  "Automate", "IMTS", "World Petroleum Congress", "NAB Show",
  "MODEX", "ProMat", "PACK EXPO", "AWS re:Invent", "GTC",
];

const CITIES = [
  { city: "Las Vegas, NV", shows: "CES · Manifest · MINExpo", status: "Live",  statusClass: "text-emerald-400 border-emerald-400/30 bg-emerald-400/8" },
  { city: "Orlando, FL",   shows: "IAAPA · InfoComm · HIMSS", status: "2026",  statusClass: "text-blue-400 border-blue-400/30 bg-blue-400/8" },
  { city: "Chicago, IL",   shows: "Automate · IMTS · PACK EXPO", status: "2026", statusClass: "text-blue-400 border-blue-400/30 bg-blue-400/8" },
  { city: "Houston, TX",   shows: "OTC · World Petroleum",     status: "2027",  statusClass: "text-purple-400 border-purple-400/30 bg-purple-400/8" },
];

const BRAND_CARDS = [
  {
    slug: "/services",
    label: "Core Platform",
    name: "StageGate",
    tm: false,
    desc: "End-to-end trade show infrastructure. Inbound logistics, warehousing, staging, activation, and live technical support for every show.",
    color: "oklch(0.72 0.21 145)",
    icon: Zap,
    cta: "Explore Services",
  },
  {
    slug: "/stagehand",
    label: "24/7 Technical Support",
    name: "StageHand",
    tm: true,
    desc: "Ongoing remote and on-site technical support for robots in the field. Monthly retainers, SLA contracts, and emergency response.",
    color: "oklch(0.78 0.17 70)",
    icon: Clock,
    cta: "Learn More",
  },
  {
    slug: "/stagepro",
    label: "Workforce Training",
    name: "StagePro",
    tm: true,
    desc: "Hands-on robot technician training under master supervision. 1-day workshops to 6-week certifications.",
    color: "oklch(0.60 0.20 295)",
    icon: GraduationCap,
    cta: "Learn More",
  },
];

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function Home() {
  const { user, isAuthenticated } = useAuth();
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
    <div className="min-h-screen bg-[oklch(0.08_0.006_240)] text-[oklch(0.97_0.002_240)] overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.20 0.008 240 / 0.4) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.20 0.008 240 / 0.4) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          }}
        />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: Copy */}
            <div className="animate-fade-in-up">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[oklch(0.72_0.21_145/0.30)] bg-[oklch(0.72_0.21_145/0.07)] mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.21_145)] animate-pulse" />
                <span className="font-mono text-[11px] tracking-widest uppercase text-[oklch(0.72_0.21_145)]">
                  Robotics Trade Show Infrastructure
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.1] mb-5">
                We Turn Shipped Robots{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, oklch(0.72 0.21 145) 0%, oklch(0.86 0.16 160) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Into Live Experiences
                </span>
              </h1>

              <p className="text-[oklch(0.58_0.010_240)] text-lg leading-relaxed mb-8 max-w-lg">
                End-to-end logistics, warehousing, staging, activation, and technical support
                for robots at trade shows.{" "}
                <span className="text-[oklch(0.80_0.005_240)] font-medium">
                  Your engineers stay home. Your robot performs perfectly.
                </span>
              </p>

              {/* CTAs — Supabase style */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Link href={ctaHref}>
                  <span className="btn-primary text-sm font-medium">
                    Register Free
                    <ArrowRight size={15} />
                  </span>
                </Link>
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="btn-default text-sm"
                >
                  Get a Quote
                  <ChevronRight size={15} />
                </button>
                <Link href="/services">
                  <span className="btn-default text-sm">
                    View Services
                    <ChevronRight size={15} />
                  </span>
                </Link>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap gap-5 text-sm text-[oklch(0.45_0.008_240)]">
                {[
                  { icon: CheckCircle2, text: "Free registration" },
                  { icon: Shield,       text: "No credit card required" },
                  { icon: MapPin,       text: "Las Vegas-based" },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5">
                    <Icon size={13} className="text-[oklch(0.72_0.21_145)]" />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Real image */}
            <div className="hidden lg:block animate-fade-in-up-delay relative">
              <div
                className="relative rounded-2xl overflow-hidden border border-[oklch(0.20_0.008_240)]"
                style={{ aspectRatio: "4/3" }}
              >
                <img
                  src="/manus-storage/robot-crate-hero_ad5ce8ec.jpg"
                  alt="Humanoid robot standing in an open wooden shipping crate inside a warehouse — the kind of logistics challenge StageGate solves"
                  className="w-full h-full object-cover"
                  style={{ filter: "brightness(0.88) contrast(1.05)" }}
                />
                {/* Overlay caption */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[oklch(0.06_0.006_240/0.90)] to-transparent">
                  <p className="font-mono text-[11px] tracking-wider text-[oklch(0.72_0.21_145)] uppercase">
                    Humanoid robot · Inbound logistics · Las Vegas
                  </p>
                </div>
              </div>
              {/* Floating stat badge */}
              <div className="absolute -bottom-4 -left-4 bg-[oklch(0.11_0.008_240)] border border-[oklch(0.22_0.008_240)] rounded-xl px-4 py-3 shadow-xl">
                <div className="text-2xl font-bold text-white tracking-tight">8</div>
                <div className="text-xs text-[oklch(0.52_0.010_240)] mt-0.5">Service Lines</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SHOW SEARCH ──────────────────────────────────────────────────────── */}
      <section className="py-12 border-b border-[oklch(0.16_0.008_240)] bg-[oklch(0.09_0.006_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <div className="section-label mx-auto justify-center mb-2">
              Find Your Show
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Search upcoming Las Vegas trade shows
            </h2>
            <p className="text-sm text-[oklch(0.50_0.008_240)] mt-1">
              Select your event to see available services and book your robot's spot.
            </p>
          </div>
          <ShowSearchBar showCityFilter={true} />
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────────────── */}
      <div className="border-y border-[oklch(0.16_0.008_240)] bg-[oklch(0.09_0.006_240)] py-3 overflow-hidden">
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3 mx-8">
              <span className="w-1 h-1 rounded-full bg-[oklch(0.72_0.21_145/0.50)]" />
              <span className="font-mono text-[11px] tracking-widest text-[oklch(0.42_0.008_240)] uppercase">
                {item}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-20 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label">The Problem We Solve</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Trade Shows Are Brutal for Robot Companies
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[oklch(0.16_0.008_240)] rounded-xl overflow-hidden border border-[oklch(0.16_0.008_240)]">
            {[
              { value: `$${c1}K–$80K`, label: "Cost per show to fly in engineers", accent: true },
              { value: `${c2} hrs`,    label: "Average robot recovery time without local support", accent: false },
              { value: "1 in 3",       label: "Robots arrive at shows damaged or unprepared", accent: false },
              { value: "0",            label: "Dedicated robotics trade show infrastructure providers — until now", accent: true },
            ].map(({ value, label, accent }) => (
              <div key={label} className="bg-[oklch(0.11_0.008_240)] p-6">
                <div
                  className="stat-number mb-2"
                  style={{ color: accent ? "oklch(0.72 0.21 145)" : "oklch(0.92 0.004 240)" }}
                >
                  {value}
                </div>
                <p className="text-xs text-[oklch(0.50_0.008_240)] leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────────── */}
      <section className="py-24 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <div className="section-label">Service Catalog</div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Everything Your Robot Needs,{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, oklch(0.72 0.21 145) 0%, oklch(0.86 0.16 160) 100%)",
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
                View all services
                <ArrowRight size={14} />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(services || []).map((svc) => {
              const meta = SERVICE_META[svc.name] || { icon: Star, cat: "svc-activation", color: "oklch(0.72 0.21 145)", textColor: "oklch(0.72 0.21 145)" };
              const Icon = meta.icon;
              return (
                <div key={svc.id} className={`svc-card ${meta.cat}`}>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                    style={{
                      background: `color-mix(in oklch, ${meta.color} 12%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${meta.color} 22%, transparent)`,
                    }}
                  >
                    <Icon size={16} style={{ color: meta.textColor }} />
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-2 leading-snug">{svc.name}</h3>
                  <p className="text-xs text-[oklch(0.50_0.008_240)] leading-relaxed mb-4 flex-1 line-clamp-3">
                    {svc.description}
                  </p>
                  <div className="font-mono text-xs" style={{ color: meta.textColor }}>
                    From {svc.basePrice ? `$${Number(svc.basePrice).toLocaleString()}` : "—"}{" "}
                    <span className="text-[oklch(0.40_0.006_240)] font-normal">{svc.priceUnit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section className="py-24 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <div className="section-label">Process</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">How StageGate Works</h2>
            <p className="text-[oklch(0.52_0.008_240)] mt-2 text-sm">
              Four steps from registration to a live robot on the show floor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Register Free",   desc: "Create your company profile and tell us about your robots. No commitment required.", icon: CheckCircle2 },
              { step: "02", title: "Select Your Show", desc: "Choose from upcoming trade shows in Las Vegas and beyond. We cover the major venues.", icon: MapPin },
              { step: "03", title: "Book Services",    desc: "Select the service bundle that fits your needs — logistics, activation, support, or all three.", icon: Package },
              { step: "04", title: "Show Up & Demo",   desc: "Your robot is unpacked, tested, and ready. You walk in and present. We handle the rest.", icon: Star },
            ].map(({ step, title, desc, icon: Icon }, i) => (
              <div key={step} className="relative">
                {i < 3 && (
                  <div className="hidden lg:block absolute top-5 left-[calc(100%+0.5rem)] w-[calc(100%-1rem)] h-px bg-gradient-to-r from-[oklch(0.22_0.008_240)] to-transparent z-10" />
                )}
                <div className="sg-card h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-xs text-[oklch(0.35_0.008_240)]">{step}</span>
                    <div className="w-8 h-8 rounded-lg bg-[oklch(0.72_0.21_145/0.10)] border border-[oklch(0.72_0.21_145/0.18)] flex items-center justify-center">
                      <Icon size={14} className="text-[oklch(0.72_0.21_145)]" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                  <p className="text-xs text-[oklch(0.50_0.008_240)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE BRANDS ─────────────────────────────────────────────────────── */}
      <section className="py-24 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <div className="section-label">Brand Architecture</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">Three Brands, One Platform</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {BRAND_CARDS.map(({ slug, label, name, tm, desc, color, icon: Icon, cta }) => (
              <div
                key={name}
                className="sg-card group flex flex-col"
                style={{ borderTopColor: color, borderTopWidth: "2px" }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-5"
                  style={{
                    background: `color-mix(in oklch, ${color} 10%, transparent)`,
                    border: `1px solid color-mix(in oklch, ${color} 20%, transparent)`,
                  }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{ color }}>
                  {label}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {name}{tm && <sup className="text-xs font-normal">™</sup>}
                </h3>
                <p className="text-sm text-[oklch(0.52_0.008_240)] leading-relaxed mb-6 flex-1">{desc}</p>
                <Link href={slug}>
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-all"
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
      <section className="py-20 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label">Expansion</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Expanding Across Convention Cities
            </h2>
            <p className="text-[oklch(0.52_0.008_240)] mt-2 text-sm">
              Starting in Las Vegas, growing to every major trade show market.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {CITIES.map(({ city, shows, status, statusClass }) => (
              <div key={city} className="sg-card">
                <div className="flex items-start justify-between mb-3">
                  <MapPin size={14} className="text-[oklch(0.72_0.21_145/0.60)] mt-0.5" />
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}>
                    {status}
                  </span>
                </div>
                <div className="font-semibold text-white text-sm mb-1">{city}</div>
                <div className="text-[11px] text-[oklch(0.42_0.006_240)] leading-relaxed">{shows}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="sg-card text-center py-16 px-8 border-[oklch(0.22_0.008_240)]">
            <div className="section-label mx-auto justify-center mb-4">Get Started</div>
            <h2 className="text-4xl font-semibold tracking-tight text-white mb-4">
              Ready to Bring Your Robot{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, oklch(0.72 0.21 145) 0%, oklch(0.86 0.16 160) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                to the Show Floor?
              </span>
            </h2>
            <p className="text-[oklch(0.52_0.008_240)] mb-8 max-w-md mx-auto text-sm leading-relaxed">
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
                <span className="btn-default">
                  View Pricing
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[oklch(0.16_0.008_240)] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[oklch(0.72_0.21_145)] flex items-center justify-center">
              <Zap size={13} className="text-[oklch(0.08_0.006_240)]" />
            </div>
            <span className="font-semibold text-sm text-white tracking-tight">StageGate</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-[oklch(0.42_0.006_240)]">
            <Link href="/services"><span className="hover:text-white transition-colors">Services</span></Link>
            <Link href="/stagehand"><span className="hover:text-white transition-colors">StageHand™</span></Link>
            <Link href="/stagepro"><span className="hover:text-white transition-colors">StagePro™</span></Link>
            <Link href="/register"><span className="hover:text-white transition-colors">Register</span></Link>
          </div>
          <p className="text-xs text-[oklch(0.35_0.006_240)]">
            © 2026 StageGate. StageHand™ and StagePro™ are trademarks of StageGate.
          </p>
        </div>
      </footer>
    </div>
    <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  );
}
