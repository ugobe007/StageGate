import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight, Warehouse, Truck, Zap, Wrench, Megaphone, ChevronDown } from "lucide-react";
import DemoRequestModal from "@/components/DemoRequestModal";

/* ── Image URLs (webdev static storage) ─────────────────────────────────────── */
const IMG_HERO      = "/manus-storage/ces-unitree-pack_cb20bcdc.png";
const IMG_WAREHOUSE = "/manus-storage/ces-robot-warehouse_0cf90e23.png";
const IMG_STAGE     = "/manus-storage/ces-engineai-robots_1c9e08ae.png";
const IMG_ACTIVATE  = "/manus-storage/ces-neura-robots_1d4104ad.png";
const IMG_GRID_1    = "/manus-storage/ces-richtech-robot_e74b2991.png";
const IMG_GRID_2    = "/manus-storage/ces-hisense-robots_ac1d2332.png";
const IMG_GRID_3    = "/manus-storage/ces-unitree-rider_fac4d951.png";

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

/* ── Services data ──────────────────────────────────────────────────────────── */
const SERVICES = [
  {
    num: "01",
    icon: Warehouse,
    title: "Warehousing",
    sub: "Las Vegas secure storage",
    desc: "Climate-controlled, secure warehouse space in Las Vegas. Your robots stay safe, organized, and ready between shows — no expensive hotel storage or last-minute scrambles.",
    accent: "#4f6ef7",
  },
  {
    num: "02",
    icon: Truck,
    title: "Shipping & Receiving",
    sub: "End-to-end freight logistics",
    desc: "We coordinate inbound and outbound freight, customs clearance, and white-glove crate handling. Your robots arrive on time, every time.",
    accent: "#4f6ef7",
  },
  {
    num: "03",
    icon: Zap,
    title: "Staging & Activation",
    sub: "Booth-ready in hours",
    desc: "Full booth setup, robot positioning, power and connectivity, and pre-show testing. We get your robots performing before the doors open.",
    accent: "#7c3aed",
  },
  {
    num: "04",
    icon: Wrench,
    title: "Technical Support",
    sub: "On-site, show floor coverage",
    desc: "Certified technicians on the floor during show hours. Rapid response to any technical issue so your demo never goes dark.",
    accent: "#7c3aed",
  },
  {
    num: "05",
    icon: Megaphone,
    title: "Promotion",
    sub: "Showroom & promotional events",
    desc: "Partner with The Robot Guild to showcase your robots at curated promotional events, media days, and industry gatherings across Las Vegas.",
    accent: "#06b6d4",
  },
];

/* ── How It Works steps ─────────────────────────────────────────────────────── */
const STEPS = [
  { num: "01", title: "Ship to Us", desc: "Send your robot to our Las Vegas warehouse. We handle receiving, inspection, and secure storage." },
  { num: "02", title: "We Stage It", desc: "Our team sets up your booth, positions your robot, runs power and connectivity, and tests everything." },
  { num: "03", title: "It Performs", desc: "Your robot is live on the show floor. Our technicians are on-site throughout the event." },
  { num: "04", title: "We Return It", desc: "After the show, we pack, store, or ship your robot — wherever it needs to go next." },
];

export default function Home() {
  const [demoOpen, setDemoOpen] = useState(false);
  const { ref: statsRef, inView: statsVisible } = useInView(0.4);
  const { ref: servicesRef, inView: servicesVisible } = useInView(0.2);

  const showsCount  = useCountUp(19, 1600, statsVisible);
  const robotsCount = useCountUp(200, 1800, statsVisible);
  const brandsCount = useCountUp(40, 1600, statsVisible);

  const { data: upcomingShows } = trpc.shows.list.useQuery();
  const nextShows = upcomingShows
    ?.filter(s => s.status === "upcoming" || s.status === "active")
    .slice(0, 3) ?? [];

  return (
    <div style={{ background: "#050508", minHeight: "100vh", color: "#fff" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          overflow: "hidden",
        }}
      >
        {/* Full-bleed background photo */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <img
            src={IMG_HERO}
            alt="Unitree robots at CES Las Vegas"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }}
          />
          {/* Gradient overlay: dark bottom-left, transparent top-right */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, rgba(5,5,8,0.97) 0%, rgba(5,5,8,0.85) 40%, rgba(5,5,8,0.30) 70%, rgba(5,5,8,0.10) 100%)",
          }} />
        </div>

        {/* Announcement bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, borderBottom: "1px solid rgba(79,110,247,0.20)", background: "rgba(5,5,8,0.70)", backdropFilter: "blur(12px)" }}>
          <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.15rem 0.6rem", borderRadius: "9999px", border: "1px solid rgba(79,110,247,0.40)", color: "#7c9bff", fontSize: "0.6875rem", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(79,110,247,0.10)" }}>
                New
              </span>
              <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)" }}>
                StageGate is now accepting bookings for CES 2027 and NAB 2026 in Las Vegas
              </span>
            </div>
            <Link href="/shows" style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#4f6ef7", fontWeight: 600 }}>
              View shows <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Hero content */}
        <div className="container" style={{ position: "relative", zIndex: 10, paddingBottom: "6rem", paddingTop: "8rem" }}>
          {/* Category tag */}
          <div style={{ marginBottom: "1.5rem" }}>
            <span className="section-label" style={{ color: "rgba(255,255,255,0.45)" }}>
              Las Vegas · Robotics Activation Infrastructure
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "clamp(3rem, 8vw, 7rem)", fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.04em", maxWidth: "14ch", marginBottom: "1.5rem" }}>
            Your Robot{" "}
            <span style={{ background: "linear-gradient(90deg, #4f6ef7 0%, #7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Performs.
            </span>
            <br />
            <span style={{ color: "rgba(255,255,255,0.85)" }}>We Handle</span>
            <br />
            <span style={{ color: "rgba(255,255,255,0.85)" }}>Everything Else.</span>
          </h1>

          {/* Positioning statement */}
          <p style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", color: "rgba(255,255,255,0.60)", maxWidth: "52ch", lineHeight: 1.6, marginBottom: "2.5rem" }}>
            The first warehouse, staging, and activation service built for robots.
            StageGate automates your logistics workflow from warehouse to trade show floor —
            including technical support and promotion.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "3rem" }}>
            <Link href="/register">
              <button className="btn-primary" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
                Register Free <ArrowRight size={16} />
              </button>
            </Link>
            <button className="btn-default" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }} onClick={() => setDemoOpen(true)}>
              Request a Demo
            </button>
            <a href="#how-it-works" className="btn-default" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
              How It Works
            </a>
            <Link href="/services">
              <button className="btn-default" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
                Services
              </button>
            </Link>
          </div>

          {/* Trust line */}
          <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
            BASED IN LAS VEGAS · SERVING CES, NAB, SEMA, MJBizCon + MORE
          </p>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: "2rem", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", opacity: 0.4 }}>
          <span style={{ fontSize: "0.6875rem", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Scroll</span>
          <ChevronDown size={16} style={{ animation: "bounce 2s infinite" }} />
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────────── */}
      <div ref={statsRef} style={{ borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(13,15,24,0.80)", backdropFilter: "blur(8px)" }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", padding: "2rem" }}>
          {[
            { value: showsCount, suffix: "+", label: "Las Vegas Shows" },
            { value: robotsCount, suffix: "+", label: "Robots Staged" },
            { value: brandsCount, suffix: "+", label: "Robot Brands" },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0.5rem 1rem", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
              <div style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", lineHeight: 1 }}>
                {stat.value}{stat.suffix}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.40)", marginTop: "0.35rem", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── WHAT IS STAGEGATE ────────────────────────────────────────────────── */}
      <section style={{ padding: "7rem 0 5rem" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "start" }}>
            {/* Left: intro statement */}
            <div>
              <span className="section-label" style={{ display: "block", marginBottom: "1.25rem" }}>What is StageGate</span>
              <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.5rem" }}>
                The first end-to-end logistics partner{" "}
                <span style={{ background: "linear-gradient(90deg, #4f6ef7 0%, #7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  built for robots.
                </span>
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
                Robotics companies spend months preparing for trade shows — and then scramble at the last minute with freight, storage, setup, and support. StageGate eliminates that chaos.
              </p>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: "2rem" }}>
                We warehouse your robots in Las Vegas year-round, stage them for each show, activate them on the floor, and provide certified technical support throughout. One partner. Zero surprises.
              </p>
              <Link href="/register">
                <button className="btn-primary">
                  Get Started <ArrowRight size={15} />
                </button>
              </Link>
            </div>

            {/* Right: value hierarchy */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                { label: "Warehousing", desc: "Secure Las Vegas storage, year-round" },
                { label: "Shipping & Receiving", desc: "Freight coordination & customs" },
                { label: "Staging & Activation", desc: "Booth setup & pre-show testing" },
                { label: "Technical Support", desc: "On-site certified technicians" },
                { label: "Promotion", desc: "Showroom & promotional events" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "1.25rem", padding: "1.25rem 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2rem", height: "2rem", borderRadius: "0.375rem", border: "1px solid rgba(79,110,247,0.30)", color: "#4f6ef7", fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono)", background: "rgba(79,110,247,0.07)", flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#fff", marginBottom: "0.15rem" }}>{item.label}</div>
                    <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.40)" }}>{item.desc}</div>
                  </div>
                  <ArrowUpRight size={14} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.20)", flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────────── */}
      <section id="services" style={{ padding: "5rem 0 7rem", background: "rgba(13,15,24,0.60)" }} ref={servicesRef}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "3.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <span className="section-label" style={{ display: "block", marginBottom: "0.75rem" }}>Services</span>
              <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, lineHeight: 1.1 }}>
                Everything your robot needs,<br />from warehouse to showroom floor.
              </h2>
            </div>
            <Link href="/services">
              <button className="btn-default" style={{ flexShrink: 0 }}>
                View all services <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px", background: "rgba(255,255,255,0.06)", borderRadius: "1rem", overflow: "hidden" }}>
            {SERVICES.map((svc, i) => {
              const Icon = svc.icon;
              return (
                <div
                  key={i}
                  style={{
                    background: "#0d0f18",
                    padding: "2rem",
                    transition: "background 0.2s",
                    cursor: "default",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#111528")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#0d0f18")}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)" }}>{svc.num}</span>
                    <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.5rem", background: `rgba(${svc.accent === "#4f6ef7" ? "79,110,247" : svc.accent === "#7c3aed" ? "124,58,237" : "6,182,212"},0.12)`, border: `1px solid ${svc.accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={15} style={{ color: svc.accent }} />
                    </div>
                  </div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, marginBottom: "0.35rem", color: "#fff" }}>{svc.title}</h3>
                  <p style={{ fontSize: "0.8125rem", color: svc.accent, fontWeight: 600, marginBottom: "0.75rem", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>{svc.sub}</p>
                  <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{svc.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "7rem 0" }}>
        <div className="container">
          <span className="section-label" style={{ display: "block", marginBottom: "0.75rem" }}>How It Works</span>
          <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "4rem", maxWidth: "30ch" }}>
            Four steps from your facility<br />to the{" "}
            <span style={{ background: "linear-gradient(90deg, #4f6ef7 0%, #7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              show floor.
            </span>
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2rem" }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div style={{ position: "absolute", top: "1rem", left: "calc(100% + 0rem)", width: "2rem", height: "1px", background: "linear-gradient(90deg, rgba(79,110,247,0.40) 0%, transparent 100%)", display: "none" }} />
                )}
                <div style={{ fontSize: "3rem", fontWeight: 800, fontFamily: "var(--font-mono)", color: "rgba(79,110,247,0.15)", lineHeight: 1, marginBottom: "1rem", letterSpacing: "-0.04em" }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.75rem", color: "#fff" }}>{step.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{step.desc}</p>
                {/* Photo for steps 1-3 */}
                {i < 3 && (
                  <div style={{ marginTop: "1.5rem", borderRadius: "0.75rem", overflow: "hidden", aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <img
                      src={[IMG_WAREHOUSE, IMG_STAGE, IMG_ACTIVATE][i]}
                      alt={step.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UPCOMING SHOWS ───────────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0 7rem", background: "rgba(13,15,24,0.60)" }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "3rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <span className="section-label" style={{ display: "block", marginBottom: "0.75rem" }}>Upcoming Shows</span>
              <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, lineHeight: 1.1 }}>
                Las Vegas 2026 schedule.
              </h2>
            </div>
            <Link href="/shows">
              <button className="btn-default">
                View full calendar <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          {nextShows.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {nextShows.map((show) => (
                <Link key={show.id} href={`/shows/${show.id}`}>
                  <div
                    className="card-base"
                    style={{ padding: "1.75rem", cursor: "pointer", display: "flex", flexDirection: "column", gap: "0.75rem" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "#4f6ef7" }}>
                        {show.status === "active" ? "● Live Now" : "Upcoming"}
                      </span>
                      <ArrowUpRight size={14} style={{ color: "rgba(255,255,255,0.25)" }} />
                    </div>
                    <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{show.name}</h3>
                    <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.40)" }}>
                      {show.venue && <div>{show.venue}</div>}
                      {show.startDate && (
                        <div style={{ marginTop: "0.25rem" }}>
                          {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {show.endDate && ` – ${new Date(show.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: "0.5rem" }}>
                      <button className="btn-primary" style={{ fontSize: "0.8125rem", padding: "0.5rem 1.25rem" }}>
                        Book Services
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontSize: "0.9375rem" }}>
              Loading upcoming shows…
            </div>
          )}
        </div>
      </section>

      {/* ── PHOTO GRID ───────────────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0" }}>
        <div className="container">
          <span className="section-label" style={{ display: "block", marginBottom: "0.75rem" }}>At the Show Floor</span>
          <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "2.5rem" }}>
            Robots we've staged at CES Las Vegas.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "auto auto", gap: "0.75rem" }}>
            <div style={{ gridRow: "1 / 3", borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
              <img src={IMG_ACTIVATE} alt="Neura Robotics at CES" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
              <img src={IMG_GRID_1} alt="Richtech robot at CES" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", aspectRatio: "4/3" }} />
            </div>
            <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
              <img src={IMG_GRID_2} alt="Hisense robots at CES" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", aspectRatio: "4/3" }} />
            </div>
            <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
              <img src={IMG_GRID_3} alt="Unitree rider at CES" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", aspectRatio: "4/3" }} />
            </div>
            <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
              <img src={IMG_STAGE} alt="EngineAI robots at CES" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", aspectRatio: "4/3" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── ROBOT GUILD PARTNER ──────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0 7rem", background: "rgba(13,15,24,0.60)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
            <div>
              <span className="section-label" style={{ display: "block", marginBottom: "1.25rem" }}>Promotion Partner</span>
              <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.25rem" }}>
                Powered by{" "}
                <span style={{ background: "linear-gradient(90deg, #4f6ef7 0%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  The Robot Guild.
                </span>
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
                StageGate partners with The Robot Guild to offer exclusive access to curated showroom events, media days, and promotional activations across Las Vegas.
              </p>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: "2rem" }}>
                Get your robot in front of press, buyers, and industry leaders — beyond the trade show floor.
              </p>
              <a href="https://www.therobotguild.com/" target="_blank" rel="noopener noreferrer">
                <button className="btn-default">
                  Visit The Robot Guild <ArrowUpRight size={14} />
                </button>
              </a>
            </div>
            <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#0d0f18", padding: "3rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
                The Robot Guild
              </div>
              <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.50)", lineHeight: 1.7 }}>
                Las Vegas' premier robotics events and showroom network. Connecting robot makers with media, investors, and enterprise buyers through curated live experiences.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {["Curated showroom events", "Media day access", "Industry buyer introductions", "Promotional activations"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.55)" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4f6ef7", flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── XBOT ENTRY POINT ──────────────────────────────────────────────── */}
      <section style={{ padding: "6rem 0", background: "rgba(13,15,24,0.60)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
            <div>
              <span className="section-label" style={{ display: "block", marginBottom: "1rem" }}>Logistics Intelligence</span>
              <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
                Meet{" "}
                <span style={{ color: "#4f6ef7" }}>XBOT</span>
                {" "}—{" "}
                <span style={{ color: "rgba(255,255,255,0.70)" }}>Your AI Logistics Planner</span>
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.50)", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "44ch" }}>
                Complete a 6-step intake form and XBOT generates a custom logistics brief — customs checklist, timeline, service package, and ground transport options — in under 60 seconds.
              </p>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <Link href="/xbot/new">
                  <button className="btn-primary" style={{ fontSize: "0.9375rem", padding: "0.75rem 1.75rem" }}>
                    Start Logistics Intake <ArrowRight size={15} />
                  </button>
                </Link>
                <Link href="/xbot">
                  <button className="btn-default" style={{ fontSize: "0.9375rem", padding: "0.75rem 1.75rem" }}>
                    Learn About XBOT
                  </button>
                </Link>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { icon: "🤖", label: "Robot Profile", num: "01" },
                { icon: "✈️", label: "Origin & Shipping", num: "02" },
                { icon: "🛃", label: "Customs", num: "03" },
                { icon: "🎪", label: "Target Show", num: "04" },
                { icon: "⚙️", label: "Services", num: "05" },
                { icon: "👤", label: "Contacts", num: "06" },
              ].map((step) => (
                <div
                  key={step.num}
                  style={{
                    padding: "1rem",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "0.75rem",
                    background: "rgba(255,255,255,0.02)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>{step.icon}</span>
                  <div>
                    <p style={{ fontSize: "0.625rem", fontFamily: "monospace", color: "rgba(79,110,247,0.60)", marginBottom: "0.125rem" }}>{step.num}</p>
                    <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.70)", fontWeight: 500 }}>{step.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <span className="section-label" style={{ display: "block", marginBottom: "1.25rem" }}>Ready to get started?</span>
          <h2 style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "1.5rem", maxWidth: "18ch", margin: "0 auto 1.5rem" }}>
            Schedule your robot{" "}
            <span style={{ background: "linear-gradient(90deg, #4f6ef7 0%, #7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              for Las Vegas.
            </span>
          </h2>
          <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.45)", maxWidth: "50ch", margin: "0 auto 2.5rem", lineHeight: 1.7 }}>
            Register free, select your show, and let StageGate handle the rest. Warehousing, staging, activation, and support — all in one place.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/register">
              <button className="btn-primary" style={{ fontSize: "1.0625rem", padding: "1rem 2.25rem" }}>
                Register Free <ArrowRight size={16} />
              </button>
            </Link>
            <button className="btn-default" style={{ fontSize: "1.0625rem", padding: "1rem 2.25rem" }} onClick={() => setDemoOpen(true)}>
              Request a Demo
            </button>
            <Link href="/shows">
              <button className="btn-default" style={{ fontSize: "1.0625rem", padding: "1rem 2.25rem" }}>
                View Shows <ArrowUpRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "3rem 0", background: "#050508" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", marginBottom: "0.35rem" }}>
              Stage<span style={{ color: "#4f6ef7" }}>Gate</span>
            </div>
            <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
              Las Vegas · Robotics Activation Infrastructure
            </div>
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { label: "Services", href: "/services" },
              { label: "Shows", href: "/shows" },
              { label: "StageHand™", href: "/stagehand" },
              { label: "StagePro™", href: "/stagepro" },
              { label: "Register", href: "/register" },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.40)", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.40)")}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.20)" }}>
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
      `}</style>
    </div>
  );
}
