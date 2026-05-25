import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import DemoRequestModal from "@/components/DemoRequestModal";
import NewsTicker from "@/components/NewsTicker";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

/* ── Image URLs ─────────────────────────────────────────────────────────────── */
const IMG_HERO   = "/manus-storage/ces-unitree-pack_cb20bcdc.png";
const IMG_GRID_1 = "/manus-storage/ces-richtech-robot_e74b2991.png";
const IMG_GRID_2 = "/manus-storage/ces-hisense-robots_ac1d2332.png";
const IMG_GRID_3 = "/manus-storage/ces-unitree-rider_fac4d951.png";
const IMG_NEURA  = "/manus-storage/ces-neura-robots_1d4104ad.png";
const IMG_GXO_WAREHOUSE = "/manus-storage/hero-gxo-warehouse.png";
const IMG_ROKAE_DEMO = "/manus-storage/hero-rokae-demo.png";
const IMG_HUMANOID_EXPO = "/manus-storage/hero-humanoid-expo.png";
const IMG_HUMANOID_ACTION = "/manus-storage/hero-humanoid-action.png";
const IMG_ENGINEAI_BOOTH = "/manus-storage/hero-engineai-booth.png";
const IMG_SERVICE_HOSPITALITY = "/manus-storage/hero-service-hospitality.png";
const IMG_CAMERA_DEMO = "/manus-storage/hero-camera-demo.png";
const IMG_LG_DOMESTIC = "/manus-storage/hero-lg-domestic.png";
const IMG_HUMANOID_MARCH = "/manus-storage/hero-humanoid-march.png";

const HERO_SLIDES = [
  { src: IMG_HERO, position: "center 30%" },
  { src: IMG_GXO_WAREHOUSE, position: "center 35%" },
  { src: IMG_ROKAE_DEMO, position: "center center" },
  { src: IMG_GRID_1, position: "center center" },
  { src: IMG_HUMANOID_MARCH, position: "center 45%" },
  { src: IMG_ENGINEAI_BOOTH, position: "center 30%" },
  { src: IMG_GRID_2, position: "center 35%" },
  { src: IMG_HUMANOID_ACTION, position: "center 40%" },
  { src: IMG_NEURA, position: "center 25%" },
  { src: IMG_SERVICE_HOSPITALITY, position: "center 35%" },
  { src: IMG_GRID_3, position: "center 40%" },
  { src: IMG_HUMANOID_EXPO, position: "center 20%" },
  { src: IMG_LG_DOMESTIC, position: "center 35%" },
  { src: IMG_CAMERA_DEMO, position: "center center" },
] as const;

function HeroCrossfade() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {HERO_SLIDES.map((slide, index) => (
        <img
          key={slide.src}
          src={slide.src}
          alt=""
          aria-hidden={index !== active}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: slide.position,
            opacity: index === active ? 1 : 0,
            transition: "opacity 2.4s ease-in-out",
          }}
        />
      ))}
    </>
  );
}

/* ── Animated counter ───────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1800, trigger = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(target); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setValue(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, trigger]);
  return value;
}

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Services list ──────────────────────────────────────────────────────────── */
const SERVICES = [
  { num: "01", title: "Receiving & Intake",     desc: "Airport pickup, inspection, chain-of-custody logging, and secure storage — any city, any robot type." },
  { num: "02", title: "Customs & Freight",      desc: "ATA Carnets, cross-border coordination, and white-glove crate handling. We speak customs for robots." },
  { num: "03", title: "Staging & Activation",   desc: "Unpacking, calibration, connectivity, and pre-deployment testing. Every robot goes live ready." },
  { num: "04", title: "Field Technical Support", desc: "Certified technicians on-site — trade show floor, factory floor, or retail environment. Zero dark deployments." },
  { num: "05", title: "Fleet Management",       desc: "Long-term storage, charging, firmware maintenance, and redeployment coordination across your fleet." },
  { num: "06", title: "Deployment Planning",    desc: "XBOT generates the full logistics brief for any robot, any route, any deployment type — in under 60 seconds." },
];

/* ── How It Works ───────────────────────────────────────────────────────────── */
const STEPS = [
  { num: "01", title: "Define the Deployment", desc: "Tell us your robot, origin, destination, and deployment type — trade show, enterprise pilot, permanent install, or fleet op." },
  { num: "02", title: "We Build the Plan",     desc: "XBOT generates a full logistics brief: customs checklist, timeline, service scope, risk notes, and partner assignments." },
  { num: "03", title: "We Activate On-Site",   desc: "Our team handles receiving, staging, commissioning, and go-live. Your robot is operational when the doors open." },
  { num: "04", title: "We Own the Field",      desc: "Ongoing technical support, remote diagnostics, fleet management, and redeployment — for as long as you need us." },
];

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [demoOpen, setDemoOpen] = useState(false);
  const { ref: statsRef, inView: statsVisible } = useInView(0.4);
  const isAdmin = user?.role === "admin";

  const showsCount  = useCountUp(19,  1600, statsVisible);
  const robotsCount = useCountUp(200, 1800, statsVisible);
  const brandsCount = useCountUp(40,  1600, statsVisible);

  const { data: upcomingShowsRaw } = trpc.shows.list.useQuery();
  const upcomingShows = upcomingShowsRaw?.slice(0, 3);

  return (
    <div style={{ background: "#080808", color: "#ececec", minHeight: "100vh" }}>

      {/* ── TOP NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{
        borderBottom: "1px solid rgba(0,255,135,0.10)",
        background: "rgba(8,8,8,0.92)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 2rem" }}>
          {/* Logo mark */}
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <svg width="26" height="26" viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 88 L4 6 L76 6 L76 88" stroke="#00ff87" strokeWidth="7" strokeLinejoin="miter" fill="none"/>
              <path d="M19 88 L19 22 L64 22 L64 88" stroke="#00ff87" strokeWidth="5" strokeLinejoin="miter" fill="none"/>
              <path d="M34 52 L42 62 L56 46" stroke="#00ff87" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </Link>

          {/* Nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <Link href="/shows" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>Shows</Link>
            <Link href="/services" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>Services</Link>
            <Link href="/xbot" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>XBOT</Link>
            <Link href="/about" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>About</Link>
            {isAdmin && <Link href="/admin" style={{ fontSize: "0.8125rem", color: "#00ff87", fontWeight: 700, textDecoration: "none" }}>Admin</Link>}
            <a href="#contact" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>Contact</a>
          </div>

          {/* Auth CTA — always visible */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {isAuthenticated ? (
              <>
                <Link href={isAdmin ? "/admin" : "/dashboard"} style={{
                  fontSize: "0.8125rem",
                  color: isAdmin ? "#00ff87" : "rgba(255,255,255,0.85)",
                  fontWeight: 700,
                  textDecoration: "none",
                  padding: "0.45rem 0.9rem",
                  border: isAdmin ? "1px solid rgba(0,255,135,0.35)" : "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "6px",
                }}>{isAdmin ? "Admin Panel" : "Dashboard"}</Link>
                <button onClick={() => void logout()} style={{
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 600,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}>Sign Out</button>
              </>
            ) : (
              <a href={getLoginUrl()} style={{
                fontSize: "0.8125rem",
                color: "rgba(255,255,255,0.85)",
                fontWeight: 600,
                textDecoration: "none",
                padding: "0.45rem 0.9rem",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "6px",
              }}>Sign In</a>
            )}
            {!isAuthenticated && <Link href="/register">
              <button style={{
                background: "#ff9500",
                color: "#080808",
                border: "none",
                borderRadius: "6px",
                padding: "0.45rem 1.1rem",
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                letterSpacing: "0.01em",
              }}>Get Started <ArrowRight size={13} /></button>
            </Link>}
          </div>
        </div>

        {/* Announcement strip */}
        <div style={{ borderTop: "1px solid rgba(0,255,135,0.07)", background: "rgba(0,255,135,0.03)" }}>
          <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.35rem 2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="badge-emerald">New</span>
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
                Now accepting bookings for CES 2027 and NAB 2026 in Las Vegas
              </span>
            </div>
            <Link href="/shows" style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", color: "#00ff87", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none" }}>
              View shows <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </nav>
      <NewsTicker />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100svh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        {/* Background images — slow crossfade */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <HeroCrossfade />
          {/* Left-heavy gradient — text on left, image bleeds right */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(8,8,8,0.97) 0%, rgba(8,8,8,0.90) 35%, rgba(8,8,8,0.55) 60%, rgba(8,8,8,0.15) 100%)" }} />
        </div>

        <div className="container" style={{ position: "relative", zIndex: 10, paddingBottom: "7rem", paddingTop: "5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "flex-end" }}>
          {/* Left column — editorial type */}
          <div>
            {/* Logo — large, upper-left of hero */}
            <div style={{ marginBottom: "2.5rem" }}>
              <img
                src="/stagegate-logo.png"
                alt="StageGate"
                style={{ height: "90px", width: "auto", display: "block" }}
              />
            </div>
            <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 7.5rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.05em", marginBottom: "2rem" }}>
              Your Robot<br />
              <span style={{ color: "#00ff87" }}>Performs.</span><br />
              <span style={{ color: "rgba(255,255,255,0.70)" }}>We make sure</span><br />
              <span style={{ color: "rgba(255,255,255,0.70)" }}>it works.</span>
            </h1>
            <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.125rem)", color: "rgba(255,255,255,0.75)", maxWidth: "46ch", lineHeight: 1.65, marginBottom: "3rem" }}>
              StageGate is the deployment infrastructure layer for robot companies —
              customs, receiving, activation, and field support for every deployment.
              Trade shows today. Enterprise, permanent installs, and fleet ops next.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <Link href="/register">
                <button className="btn-primary">Register Free <ArrowRight size={14} /></button>
              </Link>
              <button className="btn-default" onClick={() => setDemoOpen(true)}>Request a Demo</button>
              {!isAuthenticated && (
                <a href={getLoginUrl()} className="btn-default">Sign In</a>
              )}
              <a href="#how-it-works" className="btn-default">How It Works</a>
            </div>
            <p style={{ marginTop: "0.75rem", fontSize: "0.75rem" }}>
              <Link href="/newsletter">
                <span style={{ color: "oklch(0.72 0.20 262)", cursor: "pointer", opacity: 0.85 }}>
                  Get show alerts &amp; robotics news →
                </span>
              </Link>
            </p>
          </div>

          {/* Right column — service index (editorial list, no cards) */}
          <div style={{ paddingLeft: "2rem", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)", marginBottom: "1.5rem" }}>
              Services Index
            </p>
            {SERVICES.map((svc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "1.25rem", padding: "0.9rem 0", borderBottom: i < SERVICES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.20)", flexShrink: 0, minWidth: "1.5rem" }}>{svc.num}</span>
                <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>{svc.title}</span>
              </div>
            ))}
            <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginTop: "1.25rem", fontSize: "0.75rem", color: "#00ff87", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              All services <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: "2rem", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", opacity: 0.25 }}>
          <span style={{ fontSize: "0.625rem", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Scroll</span>
          <ChevronDown size={14} style={{ animation: "bounce 2s infinite" }} />
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────────── */}
      <div ref={statsRef} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { value: showsCount,  suffix: "+", label: "Las Vegas Shows" },
            { value: robotsCount, suffix: "+", label: "Robots Staged" },
            { value: brandsCount, suffix: "+", label: "Robot Brands" },
          ].map((stat, i) => (
            <div key={i} style={{ padding: "2.5rem 0", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 700, color: "#fff", letterSpacing: "-0.05em", lineHeight: 1 }}>
                {stat.value}{stat.suffix}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginTop: "0.5rem" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── INFRASTRUCTURE LAYER ─────────────────────────────────────────────── */}
      <section style={{ padding: "7rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1rem" }}>
            The Stack
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "1rem", maxWidth: "28ch" }}>
            Robot logistics isn't freight.{" "}
            <span style={{ color: "#00ff87" }}>It's a layer above freight.</span>
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", maxWidth: "56ch", lineHeight: 1.7, marginBottom: "3.5rem" }}>
            DHL moves boxes. FedEx moves pallets. StageGate moves robots — and activates them wherever they land.
            We're the infrastructure layer robot companies use to plan, deploy, and support their hardware in the field.
          </p>

          {/* Stack diagram */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", borderRadius: "12px", overflow: "hidden", marginBottom: "3rem", border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              {
                layer: "Layer 3",
                name: "Robot OEM",
                desc: "Manufactures the robot. Ships it to the first destination.",
                color: "rgba(255,255,255,0.06)",
                labelColor: "rgba(255,255,255,0.20)",
                highlight: false,
              },
              {
                layer: "Layer 2",
                name: "StageGate",
                desc: "Plans the deployment. Activates the robot. Owns the field.",
                color: "rgba(0,255,135,0.06)",
                labelColor: "#00ff87",
                highlight: true,
              },
              {
                layer: "Layer 1",
                name: "DHL / FedEx / UPS",
                desc: "Moves crates from A to B. Does not know what's inside.",
                color: "rgba(255,255,255,0.03)",
                labelColor: "rgba(255,255,255,0.18)",
                highlight: false,
              },
            ].map((item) => (
              <div key={item.layer} style={{ padding: "2rem", background: item.color, borderLeft: item.highlight ? "2px solid #00ff87" : "none" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: item.labelColor, marginBottom: "0.625rem" }}>
                  {item.layer}
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: item.highlight ? "#00ff87" : "rgba(255,255,255,0.70)", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
                  {item.name}
                </div>
                <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Deployment type grid */}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)", marginBottom: "1.25rem" }}>
            Deployment Types
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0" }}>
            {[
              { type: "Trade Shows", examples: "CES · NAB · MODEX · NVIDIA GTC", status: "Live" },
              { type: "Enterprise Pilots", examples: "Factory floor · Warehouse · Logistics hub", status: "Expanding" },
              { type: "Permanent Installs", examples: "Airport · Hotel · Retail · Campus", status: "Expanding" },
              { type: "Fleet Operations", examples: "Multi-city · Multi-robot · Ongoing support", status: "Coming" },
            ].map((item, i) => (
              <div key={item.type} style={{ padding: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.07)", borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: item.status === "Live" ? "#00ff87" : item.status === "Expanding" ? "#f59e0b" : "rgba(255,255,255,0.25)", padding: "0.125rem 0.5rem", border: `1px solid ${item.status === "Live" ? "rgba(0,255,135,0.30)" : item.status === "Expanding" ? "rgba(245,158,11,0.30)" : "rgba(255,255,255,0.10)"}`, borderRadius: "100px" }}>
                    {item.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#fff", marginBottom: "0.375rem", letterSpacing: "-0.02em" }}>{item.type}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{item.examples}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT IS STAGEGATE ────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "5fr 4fr", gap: "6rem", alignItems: "start" }}>
            {/* Left — editorial statement */}
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "2rem" }}>
                What is StageGate
              </p>
              <h2 style={{ fontSize: "clamp(2.25rem, 4vw, 3.5rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "2rem" }}>
                The deployment OS{" "}
                <span style={{ color: "#00ff87" }}>built for robots.</span>
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.75, marginBottom: "1.25rem", maxWidth: "52ch" }}>
                Every robot sold needs to get from factory to field. It needs customs clearance, receiving, commissioning, and ongoing support. No freight company does that. No OEM wants to build it.
              </p>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.75, marginBottom: "2.5rem", maxWidth: "52ch" }}>
                StageGate is the infrastructure layer in between — handling everything from crate receipt to live deployment, with certified technical support in the field for as long as you need it. One partner. Every deployment.
              </p>
              <Link href="/register">
                <button className="btn-primary">Get Started <ArrowRight size={14} /></button>
              </Link>
            </div>

            {/* Right — services as ruled list, no cards */}
            <div style={{ paddingTop: "3.5rem" }}>
              {SERVICES.map((svc, i) => (
                <div key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "1.5rem 0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "1rem", fontWeight: 600, color: "#fff" }}>{svc.title}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.18)" }}>{svc.num}</span>
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{svc.desc}</p>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "1.5rem" }}>
                <Link href="/services" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#00ff87", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  View all services <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "6rem 0 8rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1rem" }}>
            How It Works
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "4rem", maxWidth: "22ch" }}>
            Four steps from factory output to field performance.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0" }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ borderLeft: "1px solid rgba(255,255,255,0.07)", padding: "0 2rem 0 2rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "2.5rem", fontWeight: 700, color: "rgba(255,255,255,0.06)", letterSpacing: "-0.05em", marginBottom: "1.5rem", lineHeight: 1 }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>{step.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UPCOMING SHOWS ───────────────────────────────────────────────────── */}
      <section style={{ padding: "6rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "3rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "0.75rem" }}>
                Upcoming Shows
              </p>
              <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                Las Vegas 2026 schedule.
              </h2>
            </div>
            <Link href="/shows" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.75)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              View full calendar <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0" }}>
            {(upcomingShows ?? [
              { id: 1, name: "CES 2026", venue: "Las Vegas Convention Center", startDate: new Date("2026-01-06"), endDate: new Date("2026-01-09"), location: null, city: null, website: null, exhibitorListUrl: null, createdAt: new Date() },
              { id: 2, name: "SHOT Show 2026", venue: "Venetian Expo & Convention Center", startDate: new Date("2026-01-20"), endDate: new Date("2026-01-23"), location: null, city: null, website: null, exhibitorListUrl: null, createdAt: new Date() },
              { id: 3, name: "World of Concrete 2026", venue: "Las Vegas Convention Center", startDate: new Date("2026-01-20"), endDate: new Date("2026-01-23"), location: null, city: null, website: null, exhibitorListUrl: null, createdAt: new Date() },
            ]).slice(0, 3).map((show, i: number) => (
              <div key={show.id} style={{ borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.07)", padding: i === 0 ? "0 2rem 0 0" : "0 2rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "#00ff87", marginBottom: "1rem" }}>
                  Upcoming
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>{show.name}</h3>
                <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.75)", marginBottom: "0.35rem" }}>{show.venue}</p>
                <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", marginBottom: "1.5rem" }}>
                  {show.startDate ? new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"} – {show.endDate ? new Date(show.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
                </p>
                <Link href={`/register?show=${show.id}`}>
                  <button className="btn-primary" style={{ fontSize: "0.75rem", padding: "0.5rem 1.25rem" }}>Book Services</button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHOW FLOOR PHOTO GRID ────────────────────────────────────────────── */}
      <section style={{ padding: "4rem 0 6rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "2rem" }}>
            At the Show Floor
          </p>
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: "2.5rem" }}>
            Robots we've staged at CES Las Vegas.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "auto auto", gap: "2px" }}>
            <div style={{ gridRow: "1 / 3", overflow: "hidden" }}>
              <img src={IMG_NEURA} alt="Neura robots at CES" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ overflow: "hidden" }}>
              <img src={IMG_GRID_1} alt="Robot at CES" style={{ width: "100%", height: "220px", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ overflow: "hidden" }}>
              <img src={IMG_GRID_2} alt="Robot at CES" style={{ width: "100%", height: "220px", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ overflow: "hidden" }}>
              <img src={IMG_GRID_3} alt="Robot at CES" style={{ width: "100%", height: "220px", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ overflow: "hidden", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Link href="/shows" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>
                <ArrowUpRight size={20} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase" }}>View all shows</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── XBOT NARRATIVE ───────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          {/* Problem statement — full width, editorial */}
          <div style={{ maxWidth: "72ch", marginBottom: "5rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "2rem" }}>
              Logistics Intelligence
            </p>
            <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "2rem" }}>
              Your robot is sitting in a crate somewhere.<br />
              <span style={{ color: "rgba(255,255,255,0.75)" }}>Nobody knows how to commission it.</span><br />
              <span style={{ color: "rgba(255,255,255,0.75)" }}>The client goes live in 72 hours.</span>
            </h2>
            <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: "0.75rem" }}>
              This is the situation robot companies face at every deployment — trade show or enterprise. Freight brokers who don't understand robot hardware. Customs agents who've never seen an ATA Carnet for a humanoid. Field teams with no commissioning protocol.
            </p>
            <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
              <span style={{ color: "#00ff87", fontWeight: 600 }}>XBOT</span> is StageGate's AI deployment planner. Tell it your robot, origin, destination, and deployment type. In under 60 seconds it generates a complete operational brief — customs checklist, activation timeline, service package, and field support plan — tailored to your hardware and route.
            </p>
          </div>

          {/* XBOT intake steps — horizontal ruled list, no cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { num: "01", label: "Robot Profile" },
              { num: "02", label: "Origin & Shipping" },
              { num: "03", label: "Customs" },
              { num: "04", label: "Deployment Type" },
              { num: "05", label: "Activation Plan" },
              { num: "06", label: "Field Support" },
            ].map((step, i) => (
              <div key={i} style={{ borderRight: i < 5 ? "1px solid rgba(255,255,255,0.07)" : "none", padding: "1.5rem 1.5rem 1.5rem 0" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(0,255,135,0.50)", marginBottom: "0.5rem" }}>{step.num}</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{step.label}</div>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "2.5rem", flexWrap: "wrap" }}>
            <Link href="/xbot/new">
              <button className="btn-primary">Start Logistics Intake <ArrowRight size={14} /></button>
            </Link>
            <Link href="/tour">
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  color: "#000",
                  background: "#f59e0b",
                  border: "1px solid #f59e0b",
                  borderRadius: "0.25rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Book a Showroom Tour <ArrowRight size={12} />
              </button>
            </Link>
            <Link href="/xbot" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.75)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Learn About XBOT <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── DEPLOYMENT TRACKER ───────────────────────────────────────────────── */}
      <section style={{ padding: "7rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "center" }}>
            {/* Left — live tracker preview mockup */}
            <div style={{ position: "relative" }}>
              <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "0.75rem", padding: "1.5rem", fontFamily: "var(--font-mono)" }}>
                {/* Fake browser chrome */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "9999px", background: "#ef4444" }} />
                  <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "9999px", background: "#f59e0b" }} />
                  <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "9999px", background: "#00ff87" }} />
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.6875rem", color: "rgba(255,255,255,0.20)" }}>onstage.bot/track/abc123</span>
                </div>
                {/* Robot identity */}
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ fontSize: "0.5625rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.25rem" }}>DEPLOYMENT TRACKING</p>
                  <p style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: 0 }}>Unitree G1 <span style={{ color: "#f59e0b" }}>— CES 2027</span></p>
                  <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.40)", marginTop: "0.125rem" }}>Las Vegas Convention Center · Jan 6 – Jan 9</p>
                </div>
                {/* Progress bar */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "rgba(255,255,255,0.35)", marginBottom: "0.375rem" }}>
                    <span>Overall Progress</span><span style={{ color: "#f59e0b" }}>62%</span>
                  </div>
                  <div style={{ height: "0.375rem", background: "#1a1a1a", borderRadius: "9999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "62%", background: "#f59e0b", borderRadius: "9999px" }} />
                  </div>
                </div>
                {/* Phase rows */}
                {[
                  { ph: 1, label: "Origin Country",        status: "done",    date: "Nov 12" },
                  { ph: 2, label: "International Freight",  status: "done",    date: "Nov 19" },
                  { ph: 3, label: "U.S. Customs",           status: "done",    date: "Nov 24" },
                  { ph: 4, label: "Airport Recovery",       status: "done",    date: "Nov 25" },
                  { ph: 5, label: "Warehouse & Storage",    status: "active",  date: "Dec 8" },
                  { ph: 6, label: "Staging & Activation",   status: "pending", date: "Dec 20" },
                  { ph: 7, label: "Show Delivery",          status: "pending", date: "Jan 4" },
                  { ph: 8, label: "Live Show Support",      status: "pending", date: "Jan 6–9" },
                ].map((row) => (
                  <div key={row.ph} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.3125rem 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ width: "0.875rem", height: "0.875rem", borderRadius: "9999px", flexShrink: 0, background: row.status === "done" ? "rgba(0,255,135,0.15)" : row.status === "active" ? "rgba(245,158,11,0.15)" : "#1a1a1a", border: `1px solid ${row.status === "done" ? "#00ff87" : row.status === "active" ? "#f59e0b" : "rgba(255,255,255,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {row.status === "done" && <div style={{ width: "0.25rem", height: "0.25rem", borderRadius: "9999px", background: "#00ff87" }} />}
                      {row.status === "active" && <div style={{ width: "0.25rem", height: "0.25rem", borderRadius: "9999px", background: "#f59e0b" }} />}
                    </div>
                    <span style={{ flex: 1, fontSize: "0.6875rem", color: row.status === "pending" ? "rgba(255,255,255,0.30)" : "#ececec" }}>Phase {row.ph} — {row.label}</span>
                    <span style={{ fontSize: "0.6875rem", color: row.status === "done" ? "#00ff87" : row.status === "active" ? "#f59e0b" : "rgba(255,255,255,0.20)", flexShrink: 0 }}>{row.date}</span>
                  </div>
                ))}
                {/* Cost acceptance bar */}
                <div style={{ marginTop: "0.875rem", padding: "0.625rem 0.75rem", background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.15)", borderRadius: "0.375rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.40)", margin: 0 }}>Deployment Estimate</p>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#fff", margin: 0 }}>$24,800</p>
                  </div>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.25rem 0.625rem", background: "#00ff87", color: "#080808", borderRadius: "0.25rem" }}>Accepted ✓</div>
                </div>
              </div>
            </div>

            {/* Right — copy */}
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1.5rem" }}>
                New — Live Deployment Tracking
              </p>
              <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "1.5rem" }}>
                Your robot. Every step.<br />
                <span style={{ color: "#00ff87" }}>Visible from anywhere.</span>
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "44ch" }}>
                StageGate generates a live tracking link for every deployment. Your team sees exactly where the robot is — from customs clearance to warehouse activation to show-floor go-live.
              </p>
              {[
                { num: "01", label: "9-Phase journey map", desc: "Origin country through packdown — every milestone timestamped." },
                { num: "02", label: "Live carrier updates", desc: "DHL and FedEx status pulled automatically. No manual check-ins." },
                { num: "03", label: "Cost estimate sign-off", desc: "Review and accept the deployment budget in one click." },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "1.25rem", padding: "1rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(0,255,135,0.50)", paddingTop: "0.125rem", flexShrink: 0 }}>{item.num}</span>
                  <div>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec", margin: "0 0 0.25rem" }}>{item.label}</p>
                    <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: "2rem" }}>
                <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#080808", background: "#00ff87", padding: "0.75rem 1.5rem", borderRadius: "0.375rem", textDecoration: "none" }}>
                  Get a tracking link <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROBOT GUILD ──────────────────────────────────────────────────────── */}
      <section style={{ padding: "7rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "start" }}>
            {/* Left — pull-quote style, no card */}
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "2rem" }}>
                Promotion Partner
              </p>
              <blockquote style={{ borderLeft: "2px solid #00ff87", paddingLeft: "1.5rem", marginBottom: "2rem" }}>
                <p style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#fff" }}>
                  "Get your robot in front of press, buyers, and industry leaders — beyond the trade show floor."
                </p>
              </blockquote>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "44ch" }}>
                StageGate partners with The Robot Guild to offer exclusive access to curated showroom events, media days, and promotional activations across Las Vegas.
              </p>
              <a href="https://www.therobotguild.com/" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#00ff87", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Visit The Robot Guild <ArrowUpRight size={12} />
              </a>
            </div>

            {/* Right — inline text list, no card */}
            <div style={{ paddingTop: "4rem" }}>
              <p style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>The Robot Guild</p>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.65, marginBottom: "2rem" }}>
                Las Vegas' premier robotics events and showroom network. Connecting robot makers with media, investors, and enterprise buyers through curated live experiences.
              </p>
              {["Curated showroom events", "Media day access", "Industry buyer introductions", "Promotional activations"].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "1rem", padding: "0.75rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(0,255,135,0.40)", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.55)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "9rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1.5rem" }}>
            Ready to get started?
          </p>
          <h2 style={{ fontSize: "clamp(3rem, 7vw, 6rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.05em", marginBottom: "2rem", maxWidth: "16ch" }}>
            Deploy your robot{" "}
            <span style={{ color: "#00ff87" }}>anywhere.</span>
          </h2>
          <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.75)", maxWidth: "48ch", lineHeight: 1.65, marginBottom: "3rem" }}>
            Register free, tell us about your robot and your next deployment, and let StageGate handle the rest — from customs clearance to go-live activation to ongoing field support.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/register">
              <button className="btn-primary" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem" }}>Register Free <ArrowRight size={15} /></button>
            </Link>
            <Link href="/tour">
              <button style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9375rem", padding: "0.875rem 2rem", fontWeight: 700, color: "#000", background: "#f59e0b", border: "1px solid #f59e0b", borderRadius: "0.25rem", cursor: "pointer", transition: "all 0.15s" }}>
                Book a Showroom Tour <ArrowRight size={15} />
              </button>
            </Link>
            <a href="https://calendar.google.com/calendar/embed?src=bc58ef12c74e2216111ee28feb95e5edf6381e54aa8699acdab87cd370177797%40group.calendar.google.com&ctz=America%2FLos_Angeles" target="_blank" rel="noopener noreferrer">
              <button className="btn-primary" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem", background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.65)" }}>
                Schedule a Call <ArrowUpRight size={15} />
              </button>
            </a>
            <Link href="/shows">
              <button className="btn-default" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem" }}>
                View Shows <ArrowUpRight size={15} />
              </button>
            </Link>
          </div>
          <p style={{ marginTop: "1.25rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)" }}>
            <Link href="/newsletter">
              <span style={{ color: "oklch(0.72 0.20 262)", cursor: "pointer", opacity: 0.85 }}>
                Get show alerts &amp; robotics news →
              </span>
            </Link>
          </p>
        </div>
      </section>

      {/* ── CONTACT US ───────────────────────────────────────────────────────── */}
      <section id="contact" style={{ padding: "8rem 0", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,149,0,0.03)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,149,0,0.70)", marginBottom: "1.5rem" }}>
                Get in touch
              </p>
              <h2 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.04em", marginBottom: "1.5rem" }}>
                Let's talk about<br />
                <span style={{ color: "#ff9500" }}>your robot.</span>
              </h2>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", maxWidth: "44ch", lineHeight: 1.7, marginBottom: "2.5rem" }}>
                Whether you're planning your first Las Vegas show or managing a fleet across multiple events, we'd love to hear from you. Reach out and we'll get back to you within one business day.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <a href="mailto:hello@onstage.bot" style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", fontSize: "1.125rem", fontWeight: 700, color: "#ff9500", textDecoration: "none" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)" }}>Email</span>
                  hello@onstage.bot
                </a>
                <a href="https://calendar.google.com/calendar/embed?src=bc58ef12c74e2216111ee28feb95e5edf6381e54aa8699acdab87cd370177797%40group.calendar.google.com&ctz=America%2FLos_Angeles" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", fontSize: "1.125rem", fontWeight: 700, color: "rgba(255,255,255,0.70)", textDecoration: "none" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)" }}>Schedule</span>
                  Book a 30-min call <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {[
                { label: "For Robot Companies", desc: "Warehousing, staging, activation, and on-floor support for your Las Vegas show.", href: "/register" },
                { label: "For Exhibit Houses & Partners", desc: "We're the robotics technical operations layer that plugs into your existing workflow.", href: "/register" },
                { label: "For Press & Media", desc: "Media inquiries, photography access, and story pitches — reach us directly.", href: "mailto:press@onstage.bot" },
              ].map((item, i) => (
                <a key={i} href={item.href} style={{ display: "block", padding: "1.5rem", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", textDecoration: "none", transition: "border-color 0.15s, background 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,149,0,0.30)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,149,0,0.04)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#fff", marginBottom: "0.4rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {item.label} <ArrowUpRight size={14} style={{ color: "rgba(255,149,0,0.60)" }} />
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{item.desc}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "3rem 0" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
          <div>
            <img src="/stagegate-logo.png" alt="StageGate" style={{ height: "48px", width: "auto", display: "block", opacity: 0.85 }} />
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
            { label: "Services", href: "/services" },
            { label: "Shows", href: "/shows" },
            { label: "XBOT", href: "/xbot" },
            { label: "About", href: "/about" },
            { label: "StageHand™", href: "/stagehand" },
            { label: "StagePro™", href: "/stagepro" },
            { label: "Register", href: "/register" },
            { label: "Contact", href: "#contact" },
            ].map(link => (
              <Link key={link.href} href={link.href}
                style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.28)", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "rgba(255,255,255,0.15)" }}>
            © 2026 StageGate
          </div>
        </div>
      </footer>

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-service-index { display: none !important; }
          .four-col { grid-template-columns: 1fr 1fr !important; }
          .six-col { grid-template-columns: repeat(3, 1fr) !important; }
          .two-col { grid-template-columns: 1fr !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .photo-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
