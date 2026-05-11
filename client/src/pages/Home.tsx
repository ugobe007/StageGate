import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  ArrowRight, Package, Warehouse, Zap, Headphones, Clock,
  GraduationCap, Monitor, TrendingUp, MapPin, ChevronRight,
  Bot, Shield, Star, CheckCircle2
} from "lucide-react";

/* ── Animated counter hook ─────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

/* ── Service definitions ────────────────────────────────────────────────────── */
const SERVICE_META: Record<string, { icon: React.ElementType; cat: string; color: string; textColor: string }> = {
  "Inbound Logistics":       { icon: Package,       cat: "svc-logistics",  color: "oklch(0.65 0.20 245)", textColor: "#7eb8f7" },
  "Warehousing & Storage":   { icon: Warehouse,     cat: "svc-storage",    color: "oklch(0.62 0.22 295)", textColor: "#b89cf7" },
  "Staging & Activation":    { icon: Zap,           cat: "svc-activation", color: "oklch(0.74 0.23 145)", textColor: "#4ade80" },
  "Live Technical Support":  { icon: Headphones,    cat: "svc-support",    color: "oklch(0.78 0.18 70)",  textColor: "#fbbf24" },
  "StageHand 24/7™":         { icon: Clock,         cat: "svc-support",    color: "oklch(0.78 0.18 70)",  textColor: "#fbbf24" },
  "StagePro Training™":      { icon: GraduationCap, cat: "svc-storage",    color: "oklch(0.62 0.22 295)", textColor: "#b89cf7" },
  "Showroom & Demo":         { icon: Monitor,       cat: "svc-logistics",  color: "oklch(0.65 0.20 245)", textColor: "#7eb8f7" },
  "Robot Sales & Marketing": { icon: TrendingUp,    cat: "svc-marketing",  color: "oklch(0.70 0.22 20)",  textColor: "#f87171" },
};

/* ── Marquee items ──────────────────────────────────────────────────────────── */
const MARQUEE_ITEMS = [
  "CES 2026", "Manifest 2026", "MINExpo", "IAAPA Expo", "InfoComm",
  "Automate", "IMTS", "World Petroleum Congress", "NAB Show",
  "MODEX", "ProMat", "PACK EXPO", "AWS re:Invent", "GTC",
];

/* ── City data ──────────────────────────────────────────────────────────────── */
const CITIES = [
  { city: "Las Vegas, NV", shows: "CES · Manifest · MINExpo", status: "Live", statusColor: "text-green-400 bg-green-400/10 border-green-400/30" },
  { city: "Orlando, FL",   shows: "IAAPA · InfoComm · HIMSS", status: "2026", statusColor: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  { city: "Chicago, IL",   shows: "Automate · IMTS · PACK EXPO", status: "2026", statusColor: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  { city: "Houston, TX",   shows: "OTC · World Petroleum", status: "2027", statusColor: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
];

/* ── Tech grid SVG ──────────────────────────────────────────────────────────── */
function TechGrid() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.74 0.23 145)" strokeWidth="0.5" />
        </pattern>
        <radialGradient id="gridFade" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="gridMask">
          <rect width="100%" height="100%" fill="url(#gridFade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
    </svg>
  );
}

/* ── Robot silhouette SVG ───────────────────────────────────────────────────── */
function RobotGraphic() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outer ring */}
      <div className="absolute w-72 h-72 rounded-full border border-[oklch(0.74_0.23_145/0.15)] animate-[spin_20s_linear_infinite]" />
      <div className="absolute w-52 h-52 rounded-full border border-[oklch(0.74_0.23_145/0.10)] animate-[spin_15s_linear_infinite_reverse]" />

      {/* Center glow orb */}
      <div className="absolute w-40 h-40 rounded-full bg-[oklch(0.74_0.23_145/0.06)] blur-2xl" />
      <div className="absolute w-20 h-20 rounded-full bg-[oklch(0.74_0.23_145/0.15)] blur-xl" />

      {/* Robot icon */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[oklch(0.74_0.23_145/0.12)] border border-[oklch(0.74_0.23_145/0.30)] flex items-center justify-center shadow-[0_0_30px_oklch(0.74_0.23_145/0.25)]">
          <Bot size={32} className="text-[oklch(0.74_0.23_145)]" />
        </div>
        <div className="font-mono text-xs text-[oklch(0.74_0.23_145)] tracking-widest opacity-70">UNIT READY</div>
      </div>

      {/* Orbit dots */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div
          key={deg}
          className="absolute w-2 h-2 rounded-full bg-[oklch(0.74_0.23_145/0.5)]"
          style={{
            transform: `rotate(${deg}deg) translateX(9rem)`,
            boxShadow: "0 0 6px oklch(0.74 0.23 145 / 0.6)",
          }}
        />
      ))}

      {/* Status indicators */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {["LOGISTICS", "STAGING", "SUPPORT"].map((label, i) => (
          <div key={label} className="flex items-center gap-1.5" style={{ animationDelay: `${i * 0.4}s` }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.74_0.23_145)] animate-pulse" />
            <span className="font-mono text-[9px] text-[oklch(0.74_0.23_145/0.6)] tracking-widest">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: services } = trpc.services.list.useQuery();

  // Intersection observer for stats animation
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const c1 = useCountUp(25, 1600, statsVisible);
  const c2 = useCountUp(72, 1600, statsVisible);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden clip-diagonal">
        {/* Background layers */}
        <div className="absolute inset-0 bg-[oklch(0.06_0.008_240)]" />
        <TechGrid />
        {/* Radial green glow */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[oklch(0.74_0.23_145/0.04)] blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[oklch(0.65_0.20_245/0.04)] blur-[100px] pointer-events-none" />

        <div className="container relative z-10 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: Copy */}
            <div className="animate-fade-in-up">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[oklch(0.74_0.23_145/0.30)] bg-[oklch(0.74_0.23_145/0.06)] mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.74_0.23_145)] animate-pulse" />
                <span className="font-mono text-xs text-[oklch(0.74_0.23_145)] tracking-widest uppercase">
                  The Infrastructure Layer for Robotics at Trade Shows
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-display font-bold leading-[1.08] tracking-tight mb-6">
                <span className="text-white">We Turn</span>
                <br />
                <span className="text-white">Shipped Robots</span>
                <br />
                <span
                  className="text-gradient"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.74 0.23 145) 0%, oklch(0.88 0.18 165) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 20px oklch(0.74 0.23 145 / 0.4))",
                  }}
                >
                  Into Live Experiences
                </span>
              </h1>

              <p className="text-lg text-[oklch(0.65_0.012_240)] leading-relaxed mb-8 max-w-xl">
                End-to-end logistics, warehousing, staging, activation, and technical support
                for robots at trade shows. Your engineers stay home.{" "}
                <strong className="text-[oklch(0.85_0.010_240)] font-semibold">Your robot performs perfectly.</strong>
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                  <button
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-display font-bold text-[0.9375rem] transition-all duration-200"
                    style={{
                      background: "oklch(0.74 0.23 145)",
                      color: "oklch(0.06 0.008 240)",
                      boxShadow: "0 0 24px oklch(0.74 0.23 145 / 0.35), 0 4px 16px oklch(0 0 0 / 0.3)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px oklch(0.74 0.23 145 / 0.55), 0 6px 24px oklch(0 0 0 / 0.4)";
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px oklch(0.74 0.23 145 / 0.35), 0 4px 16px oklch(0 0 0 / 0.3)";
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    }}
                  >
                    Register Your Company Free
                    <ArrowRight size={16} />
                  </button>
                </Link>
                <Link href="/services">
                  <button className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-display font-semibold text-[0.9375rem] border border-[oklch(0.25_0.010_240)] text-[oklch(0.80_0.010_240)] bg-transparent transition-all duration-200 hover:border-[oklch(0.74_0.23_145/0.40)] hover:text-[oklch(0.74_0.23_145)] hover:bg-[oklch(0.74_0.23_145/0.05)]">
                    Explore Services
                    <ChevronRight size={16} />
                  </button>
                </Link>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-[oklch(0.45_0.010_240)]">
                {[
                  { icon: CheckCircle2, text: "Free registration" },
                  { icon: Shield, text: "No credit card required" },
                  { icon: MapPin, text: "Las Vegas-based" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5">
                    <Icon size={13} className="text-[oklch(0.74_0.23_145/0.7)]" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Graphic */}
            <div className="hidden lg:flex items-center justify-center animate-fade-in-up-delay-2">
              <div className="relative w-[420px] h-[420px]">
                <RobotGraphic />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-y border-[oklch(0.16_0.010_240)] bg-[oklch(0.08_0.008_240)] py-3">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3 mx-6">
              <span className="w-1 h-1 rounded-full bg-[oklch(0.74_0.23_145/0.5)]" />
              <span className="font-mono text-xs tracking-widest text-[oklch(0.50_0.010_240)] uppercase">{item}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-20 bg-[oklch(0.08_0.008_240)] relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-30" />
        <div className="container relative z-10">
          <div className="text-center mb-12">
            <div className="section-label mx-auto justify-center">The Problem We Solve</div>
            <h2 className="text-3xl font-display font-bold text-white">
              Trade Shows Are Brutal for Robot Companies
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { value: `$${c1}K–$80K`, label: "Cost per show to fly in engineers", highlight: true },
              { value: `${c2} hrs`, label: "Average robot recovery time without local support", highlight: false },
              { value: "1 in 3", label: "Robots arrive at shows damaged or unprepared", highlight: false },
              { value: "0", label: "Dedicated robotics trade show infrastructure providers — until now", highlight: true },
            ].map(({ value, label, highlight }) => (
              <div
                key={label}
                className="relative p-6 rounded-xl border text-center overflow-hidden transition-all duration-200 hover:border-[oklch(0.74_0.23_145/0.30)] group"
                style={{
                  background: "oklch(0.10 0.010 240)",
                  borderColor: highlight ? "oklch(0.74 0.23 145 / 0.20)" : "oklch(0.20 0.010 240)",
                }}
              >
                {highlight && (
                  <div className="absolute inset-0 bg-[oklch(0.74_0.23_145/0.03)] rounded-xl" />
                )}
                <div
                  className="stat-number mb-2 relative z-10"
                  style={{ color: highlight ? "oklch(0.74 0.23 145)" : "oklch(0.90 0.005 240)" }}
                >
                  {value}
                </div>
                <div className="text-xs text-[oklch(0.55_0.010_240)] leading-snug relative z-10">{label}</div>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.74_0.23_145/0.20)] to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-background relative">
        <div className="container">
          <div className="text-center mb-14">
            <div className="section-label mx-auto justify-center">Service Catalog</div>
            <h2 className="text-4xl font-display font-bold text-white mb-4">
              Everything Your Robot Needs,<br />
              <span style={{
                background: "linear-gradient(135deg, oklch(0.74 0.23 145) 0%, oklch(0.88 0.18 165) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                From Crate to Stage
              </span>
            </h2>
            <p className="text-[oklch(0.58_0.012_240)] max-w-xl mx-auto">
              Eight integrated service lines covering the complete trade show lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(services || []).map((svc) => {
              const meta = SERVICE_META[svc.name] || { icon: Star, cat: "svc-activation", color: "oklch(0.74 0.23 145)", textColor: "#4ade80" };
              const Icon = meta.icon;
              return (
                <div key={svc.id} className={`svc-card ${meta.cat} group`}>
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 relative z-10"
                    style={{
                      background: `${meta.color.replace(")", " / 0.12)")}`,
                      border: `1px solid ${meta.color.replace(")", " / 0.25)")}`,
                    }}
                  >
                    <Icon size={18} style={{ color: meta.textColor }} />
                  </div>

                  {/* Name */}
                  <h3 className="font-display font-semibold text-sm text-white mb-2 relative z-10 leading-snug">
                    {svc.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-[oklch(0.55_0.010_240)] leading-relaxed mb-4 relative z-10 line-clamp-3">
                    {svc.description}
                  </p>

                  {/* Price */}
                  <div className="relative z-10 mt-auto">
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color: meta.textColor }}
                    >
                      From {svc.basePrice ? `$${Number(svc.basePrice).toLocaleString()}` : "—"}{" "}
                      <span className="font-normal text-[oklch(0.45_0.008_240)]">{svc.priceUnit}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link href="/services">
              <button
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-display font-semibold text-sm transition-all duration-200"
                style={{
                  background: "oklch(0.74 0.23 145)",
                  color: "oklch(0.06 0.008 240)",
                  boxShadow: "0 0 20px oklch(0.74 0.23 145 / 0.25)",
                }}
              >
                View Full Service Details & Pricing
                <ArrowRight size={15} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[oklch(0.08_0.008_240)] relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div className="container relative z-10">
          <div className="text-center mb-14">
            <div className="section-label mx-auto justify-center">Process</div>
            <h2 className="text-4xl font-display font-bold text-white">How StageGate Works</h2>
            <p className="text-[oklch(0.55_0.010_240)] mt-3">Four steps from registration to a live robot on the show floor.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Register Free", desc: "Create your company profile and tell us about your robots. No commitment required.", icon: CheckCircle2 },
              { step: "02", title: "Select Your Show", desc: "Choose from upcoming trade shows in Las Vegas and beyond. We cover the major venues.", icon: MapPin },
              { step: "03", title: "Book Services", desc: "Select the service bundle that fits your needs — logistics, activation, support, or all three.", icon: Package },
              { step: "04", title: "Show Up & Demo", desc: "Your robot is unpacked, tested, and ready. You walk in and present. We handle the rest.", icon: Star },
            ].map(({ step, title, desc, icon: Icon }, i) => (
              <div key={step} className="relative">
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(100%_-_1rem)] w-8 h-px bg-gradient-to-r from-[oklch(0.74_0.23_145/0.30)] to-[oklch(0.74_0.23_145/0.10)] z-10" />
                )}
                <div className="p-6 rounded-xl border border-[oklch(0.18_0.010_240)] bg-[oklch(0.10_0.010_240)] hover:border-[oklch(0.74_0.23_145/0.25)] transition-all duration-200 group">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="font-mono text-3xl font-bold text-[oklch(0.74_0.23_145/0.20)] leading-none group-hover:text-[oklch(0.74_0.23_145/0.40)] transition-colors">
                      {step}
                    </span>
                    <div className="w-9 h-9 rounded-lg bg-[oklch(0.74_0.23_145/0.10)] border border-[oklch(0.74_0.23_145/0.20)] flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-[oklch(0.74_0.23_145)]" />
                    </div>
                  </div>
                  <h3 className="font-display font-semibold text-white mb-2">{title}</h3>
                  <p className="text-xs text-[oklch(0.55_0.010_240)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE BRANDS ─────────────────────────────────────────────────────── */}
      <section className="py-24 bg-background relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-[oklch(0.74_0.23_145/0.03)] blur-[100px] pointer-events-none" />
        <div className="container relative z-10">
          <div className="text-center mb-14">
            <div className="section-label mx-auto justify-center">Brand Architecture</div>
            <h2 className="text-4xl font-display font-bold text-white">Three Brands, One Platform</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* StageGate */}
            <div className="relative p-8 rounded-2xl border border-[oklch(0.74_0.23_145/0.20)] overflow-hidden group hover:border-[oklch(0.74_0.23_145/0.40)] transition-all duration-300"
              style={{ background: "linear-gradient(135deg, oklch(0.10 0.010 240) 0%, oklch(0.08 0.008 240) 100%)" }}>
              <div className="absolute inset-0 bg-[oklch(0.74_0.23_145/0.03)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.74_0.23_145/0.50)] to-transparent" />
              <div className="w-12 h-12 rounded-xl bg-[oklch(0.74_0.23_145/0.12)] border border-[oklch(0.74_0.23_145/0.25)] flex items-center justify-center mb-6 relative z-10">
                <Zap size={22} className="text-[oklch(0.74_0.23_145)]" />
              </div>
              <div className="relative z-10">
                <div className="font-mono text-[10px] text-[oklch(0.74_0.23_145)] tracking-widest uppercase mb-1">Core Platform</div>
                <h3 className="font-display text-2xl font-bold text-white mb-3">StageGate</h3>
                <p className="text-sm text-[oklch(0.58_0.010_240)] leading-relaxed mb-6">
                  The core trade show infrastructure platform. Inbound logistics, warehousing, staging, activation, and live technical support for every show.
                </p>
                <Link href="/services">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[oklch(0.74_0.23_145)] hover:gap-2.5 transition-all">
                    Explore Services <ArrowRight size={14} />
                  </span>
                </Link>
              </div>
            </div>

            {/* StageHand */}
            <div className="relative p-8 rounded-2xl border border-[oklch(0.78_0.18_70/0.20)] overflow-hidden group hover:border-[oklch(0.78_0.18_70/0.40)] transition-all duration-300"
              style={{ background: "linear-gradient(135deg, oklch(0.10 0.010 240) 0%, oklch(0.08 0.008 240) 100%)" }}>
              <div className="absolute inset-0 bg-[oklch(0.78_0.18_70/0.03)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.78_0.18_70/0.50)] to-transparent" />
              <div className="w-12 h-12 rounded-xl bg-[oklch(0.78_0.18_70/0.12)] border border-[oklch(0.78_0.18_70/0.25)] flex items-center justify-center mb-6 relative z-10">
                <Clock size={22} className="text-[oklch(0.78_0.18_70)]" />
              </div>
              <div className="relative z-10">
                <div className="font-mono text-[10px] text-[oklch(0.78_0.18_70)] tracking-widest uppercase mb-1">24/7 Technical Support</div>
                <h3 className="font-display text-2xl font-bold text-white mb-3">
                  StageHand<sup className="text-sm font-normal">™</sup>
                </h3>
                <p className="text-sm text-[oklch(0.58_0.010_240)] leading-relaxed mb-6">
                  Ongoing remote and on-site technical support for robots in the field. Monthly retainers, SLA contracts, and emergency response for deployed robots.
                </p>
                <Link href="/stagehand">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[oklch(0.78_0.18_70)] hover:gap-2.5 transition-all">
                    Learn More <ArrowRight size={14} />
                  </span>
                </Link>
              </div>
            </div>

            {/* StagePro */}
            <div className="relative p-8 rounded-2xl border border-[oklch(0.62_0.22_295/0.20)] overflow-hidden group hover:border-[oklch(0.62_0.22_295/0.40)] transition-all duration-300"
              style={{ background: "linear-gradient(135deg, oklch(0.10 0.010 240) 0%, oklch(0.08 0.008 240) 100%)" }}>
              <div className="absolute inset-0 bg-[oklch(0.62_0.22_295/0.03)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.62_0.22_295/0.50)] to-transparent" />
              <div className="w-12 h-12 rounded-xl bg-[oklch(0.62_0.22_295/0.12)] border border-[oklch(0.62_0.22_295/0.25)] flex items-center justify-center mb-6 relative z-10">
                <GraduationCap size={22} className="text-[oklch(0.62_0.22_295)]" />
              </div>
              <div className="relative z-10">
                <div className="font-mono text-[10px] text-[oklch(0.62_0.22_295)] tracking-widest uppercase mb-1">Workforce Training</div>
                <h3 className="font-display text-2xl font-bold text-white mb-3">
                  StagePro<sup className="text-sm font-normal">™</sup>
                </h3>
                <p className="text-sm text-[oklch(0.58_0.010_240)] leading-relaxed mb-6">
                  Hands-on robot technician training. Learn by repairing real client robots under master technician supervision. 1-day workshops to 6-week certifications.
                </p>
                <Link href="/stagepro">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[oklch(0.62_0.22_295)] hover:gap-2.5 transition-all">
                    Learn More <ArrowRight size={14} />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CITIES ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[oklch(0.08_0.008_240)] relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div className="container relative z-10">
          <div className="text-center mb-12">
            <div className="section-label mx-auto justify-center">Expansion</div>
            <h2 className="text-3xl font-display font-bold text-white">Expanding Across Convention Cities</h2>
            <p className="text-[oklch(0.55_0.010_240)] mt-3">Starting in Las Vegas, growing to every major trade show market.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CITIES.map(({ city, shows, status, statusColor }) => (
              <div
                key={city}
                className="p-5 rounded-xl border border-[oklch(0.18_0.010_240)] bg-[oklch(0.10_0.010_240)] hover:border-[oklch(0.74_0.23_145/0.20)] transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <MapPin size={16} className="text-[oklch(0.74_0.23_145/0.60)] mt-0.5 flex-shrink-0" />
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                    {status}
                  </span>
                </div>
                <div className="font-display font-semibold text-white text-sm mb-1">{city}</div>
                <div className="text-[11px] text-[oklch(0.48_0.008_240)] leading-relaxed">{shows}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-background relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-15" />
        {/* Glow orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-[oklch(0.74_0.23_145/0.05)] blur-[80px] pointer-events-none" />

        <div className="container relative z-10">
          <div
            className="relative p-12 rounded-2xl border border-[oklch(0.74_0.23_145/0.25)] text-center overflow-hidden"
            style={{ background: "linear-gradient(135deg, oklch(0.10 0.010 240) 0%, oklch(0.08 0.008 240) 100%)" }}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.74_0.23_145/0.60)] to-transparent" />
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-[oklch(0.74_0.23_145/0.30)] rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-[oklch(0.74_0.23_145/0.30)] rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-[oklch(0.74_0.23_145/0.30)] rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-[oklch(0.74_0.23_145/0.30)] rounded-br-2xl" />

            <div className="section-label mx-auto justify-center mb-4">Get Started</div>
            <h2 className="text-4xl lg:text-5xl font-display font-bold text-white mb-4 leading-tight">
              Ready to Bring Your Robot<br />
              <span style={{
                background: "linear-gradient(135deg, oklch(0.74 0.23 145) 0%, oklch(0.88 0.18 165) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                to the Show Floor?
              </span>
            </h2>
            <p className="text-[oklch(0.58_0.010_240)] mb-8 max-w-lg mx-auto">
              Register your company for free. No credit card, no commitment.
              Just your robot and our infrastructure.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                <button
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-display font-bold text-base transition-all duration-200"
                  style={{
                    background: "oklch(0.74 0.23 145)",
                    color: "oklch(0.06 0.008 240)",
                    boxShadow: "0 0 30px oklch(0.74 0.23 145 / 0.40), 0 4px 20px oklch(0 0 0 / 0.3)",
                  }}
                >
                  Register Free Today
                  <ArrowRight size={18} />
                </button>
              </Link>
              <Link href="/services">
                <button className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-display font-semibold text-base border border-[oklch(0.25_0.010_240)] text-[oklch(0.75_0.010_240)] bg-transparent transition-all duration-200 hover:border-[oklch(0.74_0.23_145/0.40)] hover:text-[oklch(0.74_0.23_145)]">
                  View Pricing
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[oklch(0.14_0.008_240)] bg-[oklch(0.05_0.006_240)] py-12">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[oklch(0.74_0.23_145/0.15)] border border-[oklch(0.74_0.23_145/0.30)] flex items-center justify-center">
                  <span className="font-display font-bold text-xs text-[oklch(0.74_0.23_145)]">SG</span>
                </div>
                <span className="font-display font-bold text-white">StageGate</span>
              </div>
              <p className="text-xs text-[oklch(0.45_0.008_240)] leading-relaxed">
                The infrastructure layer for robotics at trade shows. Las Vegas, NV.
              </p>
              <div className="mt-3 text-xs text-[oklch(0.38_0.008_240)]">info@stagegate.com</div>
            </div>

            {/* Services */}
            <div>
              <div className="font-mono text-[10px] text-[oklch(0.74_0.23_145)] tracking-widest uppercase mb-3">Services</div>
              {["All Services", "StageHand™", "StagePro™"].map(label => (
                <Link key={label} href={label === "All Services" ? "/services" : label.includes("StageHand") ? "/stagehand" : "/stagepro"}>
                  <div className="text-xs text-[oklch(0.48_0.008_240)] hover:text-[oklch(0.74_0.23_145)] transition-colors py-1">{label}</div>
                </Link>
              ))}
            </div>

            {/* Company */}
            <div>
              <div className="font-mono text-[10px] text-[oklch(0.74_0.23_145)] tracking-widest uppercase mb-3">Company</div>
              {[
                { label: "Register Free", href: "/register" },
                { label: "Client Portal", href: "/dashboard" },
              ].map(({ label, href }) => (
                <Link key={label} href={href}>
                  <div className="text-xs text-[oklch(0.48_0.008_240)] hover:text-[oklch(0.74_0.23_145)] transition-colors py-1">{label}</div>
                </Link>
              ))}
            </div>

            {/* Cities */}
            <div>
              <div className="font-mono text-[10px] text-[oklch(0.74_0.23_145)] tracking-widest uppercase mb-3">Locations</div>
              {CITIES.map(({ city }) => (
                <div key={city} className="text-xs text-[oklch(0.48_0.008_240)] py-1">{city}</div>
              ))}
            </div>
          </div>

          <div className="border-t border-[oklch(0.12_0.008_240)] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-[oklch(0.35_0.008_240)]">
              © 2026 StageGate. StageHand™ and StagePro™ are trademarks of StageGate.
            </div>
            <div className="text-[11px] text-[oklch(0.35_0.008_240)]">
              The Robot Guild™ — Marketing & Brand Activation Division
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
