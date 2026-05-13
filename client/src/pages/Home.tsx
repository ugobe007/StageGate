import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import DemoRequestModal from "@/components/DemoRequestModal";

/* ── Image URLs ─────────────────────────────────────────────────────────────── */
const IMG_HERO   = "/manus-storage/ces-unitree-pack_cb20bcdc.png";
const IMG_GRID_1 = "/manus-storage/ces-richtech-robot_e74b2991.png";
const IMG_GRID_2 = "/manus-storage/ces-hisense-robots_ac1d2332.png";
const IMG_GRID_3 = "/manus-storage/ces-unitree-rider_fac4d951.png";
const IMG_NEURA  = "/manus-storage/ces-neura-robots_1d4104ad.png";

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
  { num: "01", title: "Warehousing", desc: "Climate-controlled Las Vegas storage, year-round. Your robots stay ready between shows." },
  { num: "02", title: "Shipping & Receiving", desc: "End-to-end freight, customs clearance, and white-glove crate handling." },
  { num: "03", title: "Staging & Activation", desc: "Full booth setup, robot positioning, power, connectivity, and pre-show testing." },
  { num: "04", title: "Technical Support", desc: "Certified technicians on the floor during show hours. Zero dark demos." },
  { num: "05", title: "Promotion", desc: "Showroom events, media days, and buyer introductions via The Robot Guild." },
];

/* ── How It Works ───────────────────────────────────────────────────────────── */
const STEPS = [
  { num: "01", title: "Ship to Us", desc: "Send your robot to our Las Vegas warehouse. We handle receiving, inspection, and secure storage." },
  { num: "02", title: "We Stage It", desc: "Our team sets up your booth, positions your robot, runs power and connectivity, and tests everything." },
  { num: "03", title: "It Performs", desc: "Your robot is live on the show floor. Our technicians are on-site throughout the event." },
  { num: "04", title: "We Return It", desc: "After the show, we pack, store, or ship your robot — wherever it needs to go next." },
];

export default function Home() {
  const [demoOpen, setDemoOpen] = useState(false);
  const { ref: statsRef, inView: statsVisible } = useInView(0.4);

  const showsCount  = useCountUp(19,  1600, statsVisible);
  const robotsCount = useCountUp(200, 1800, statsVisible);
  const brandsCount = useCountUp(40,  1600, statsVisible);

  const { data: upcomingShowsRaw } = trpc.shows.list.useQuery();
  const upcomingShows = upcomingShowsRaw?.slice(0, 3);

  return (
    <div style={{ background: "#080808", color: "#ececec", minHeight: "100vh" }}>

      {/* ── ANNOUNCEMENT BAR ─────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid rgba(0,255,135,0.12)",
        background: "rgba(8,8,8,0.90)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.55rem 2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="badge-emerald">New</span>
            <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.75)" }}>
              Now accepting bookings for CES 2027 and NAB 2026 in Las Vegas
            </span>
          </div>
          <Link href="/shows" style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#00ff87", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            View shows <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100svh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        {/* Background image */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <img src={IMG_HERO} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }} />
          {/* Left-heavy gradient — text on left, image bleeds right */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(8,8,8,0.97) 0%, rgba(8,8,8,0.90) 35%, rgba(8,8,8,0.55) 60%, rgba(8,8,8,0.15) 100%)" }} />
        </div>

        <div className="container" style={{ position: "relative", zIndex: 10, paddingBottom: "7rem", paddingTop: "5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "flex-end" }}>
          {/* Left column — editorial type */}
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: "2rem" }}>
              Las Vegas · Robotics Activation Infrastructure
            </p>
            <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 7.5rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.05em", marginBottom: "2rem" }}>
              Your Robot<br />
              <span style={{ color: "#00ff87" }}>Performs.</span><br />
              <span style={{ color: "rgba(255,255,255,0.70)" }}>We Handle</span><br />
              <span style={{ color: "rgba(255,255,255,0.70)" }}>Everything Else.</span>
            </h1>
            <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.125rem)", color: "rgba(255,255,255,0.75)", maxWidth: "46ch", lineHeight: 1.65, marginBottom: "3rem" }}>
              The first warehouse, staging, and activation service built for robots.
              From crate to show floor — one partner, zero surprises.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <Link href="/register">
                <button className="btn-primary">Register Free <ArrowRight size={14} /></button>
              </Link>
              <button className="btn-default" onClick={() => setDemoOpen(true)}>Request a Demo</button>
              <a href="#how-it-works" className="btn-default">How It Works</a>
            </div>
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

      {/* ── WHAT IS STAGEGATE ────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "5fr 4fr", gap: "6rem", alignItems: "start" }}>
            {/* Left — editorial statement */}
            <div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "2rem" }}>
                What is StageGate
              </p>
              <h2 style={{ fontSize: "clamp(2.25rem, 4vw, 3.5rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "2rem" }}>
                The first end-to-end logistics partner{" "}
                <span style={{ color: "#00ff87" }}>built for robots.</span>
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.75, marginBottom: "1.25rem", maxWidth: "52ch" }}>
                Robotics companies spend months preparing for trade shows — and then scramble at the last minute with freight, storage, setup, and support. StageGate eliminates that chaos.
              </p>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.75, marginBottom: "2.5rem", maxWidth: "52ch" }}>
                We warehouse your robots in Las Vegas year-round, stage them for each show, activate them on the floor, and provide certified technical support throughout. One partner. Zero surprises.
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
            Four steps from your facility to the show floor.
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
              <span style={{ color: "rgba(255,255,255,0.75)" }}>Customs paperwork is missing.</span><br />
              <span style={{ color: "rgba(255,255,255,0.75)" }}>The show opens in 72 hours.</span>
            </h2>
            <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: "0.75rem" }}>
              This is the situation most robotics teams face before every major trade show. Freight brokers who don't understand robot hardware. Customs agents who've never seen an ATA Carnet for a humanoid. Ground transport that shows up late.
            </p>
            <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
              <span style={{ color: "#00ff87", fontWeight: 600 }}>XBOT</span> is StageGate's AI logistics planner. Tell it about your robot, your origin, and your target show. In under 60 seconds it generates a complete logistics brief — customs checklist, timeline, service package, and ground transport options — tailored to your specific hardware and route.
            </p>
          </div>

          {/* XBOT intake steps — horizontal ruled list, no cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { num: "01", label: "Robot Profile" },
              { num: "02", label: "Origin & Shipping" },
              { num: "03", label: "Customs" },
              { num: "04", label: "Target Show" },
              { num: "05", label: "Services" },
              { num: "06", label: "Contacts" },
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
            <Link href="/xbot" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.75)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Learn About XBOT <ArrowRight size={12} />
            </Link>
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
            Schedule your robot for{" "}
            <span style={{ color: "#00ff87" }}>Las Vegas.</span>
          </h2>
          <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.75)", maxWidth: "48ch", lineHeight: 1.65, marginBottom: "3rem" }}>
            Register free, select your show, and let StageGate handle the rest. Warehousing, staging, activation, and support — all in one place.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/register">
              <button className="btn-primary" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem" }}>Register Free <ArrowRight size={15} /></button>
            </Link>
            <button className="btn-default" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem" }} onClick={() => setDemoOpen(true)}>
              Request a Demo
            </button>
            <Link href="/shows">
              <button className="btn-default" style={{ fontSize: "0.9375rem", padding: "0.875rem 2rem" }}>
                View Shows <ArrowUpRight size={15} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "3rem 0" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: "0.3rem" }}>
              Stage<span style={{ color: "#00ff87" }}>Gate</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", letterSpacing: "0.06em", color: "rgba(255,255,255,0.20)" }}>
              Las Vegas · Robotics Activation Infrastructure
            </div>
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { label: "Services", href: "/services" },
              { label: "Shows", href: "/shows" },
              { label: "XBOT", href: "/xbot" },
              { label: "StageHand™", href: "/stagehand" },
              { label: "StagePro™", href: "/stagepro" },
              { label: "Register", href: "/register" },
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
