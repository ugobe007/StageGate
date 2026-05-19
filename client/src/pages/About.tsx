import { Link } from "wouter";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getLoginUrl } from "@/const";

const TIMELINE = [
  {
    year: "2019",
    title: "LV Robotics is Founded",
    body: "Las Vegas Robotics (LV Robotics) was established as Nevada's first dedicated robotics community — connecting engineers, founders, and enthusiasts across the region. Monthly meetups at the Las Vegas Tech Center drew roboticists from across the Southwest.",
  },
  {
    year: "2022",
    title: "The Show Floor Problem",
    body: "Members of LV Robotics started exhibiting at CES, NAB, and MODEX. The same story kept repeating: robots arrived damaged, booths weren't ready, demos failed on the floor. There was no dedicated logistics and staging partner for robotics companies.",
  },
  {
    year: "2023",
    title: "The First Activation",
    body: "We staged our first robot for a member company at CES 2023 — a humanoid demo unit that needed warehousing, booth setup, power configuration, and a live technician. It worked. The company closed three enterprise deals on the show floor.",
  },
  {
    year: "2024",
    title: "StageGate Takes Shape",
    body: "After handling activations for seven companies across CES, NAB, and MODEX, we formalized the operation. StageGate became the dedicated robotics activation infrastructure brand — built on top of the LV Robotics network and Las Vegas operational knowledge.",
  },
  {
    year: "2025",
    title: "The Robot Guild Launches",
    body: "We launched The Robot Guild — a curated showroom and buyer introduction network for robot companies. Brands in the StageGate ecosystem get access to qualified buyers, media, and enterprise procurement teams visiting Las Vegas year-round.",
  },
  {
    year: "2026",
    title: "Full Infrastructure Stack",
    body: "Today StageGate operates a climate-controlled Las Vegas warehouse, a certified technician team, and a full show management platform. We support 19+ Las Vegas shows per year and have staged 200+ robots for 40+ brands.",
  },
];

const VALUES = [
  {
    num: "01",
    title: "Robots First",
    desc: "Every decision we make starts with the robot's requirements — power, connectivity, climate, handling. We don't adapt robots to generic logistics; we build logistics around robots.",
  },
  {
    num: "02",
    title: "Zero Dark Demos",
    desc: "A robot that doesn't demo is a liability. Our pre-show testing protocol means every unit is live, calibrated, and ready before the doors open. No exceptions.",
  },
  {
    num: "03",
    title: "Las Vegas Native",
    desc: "We're not a national freight company with a Las Vegas office. We are Las Vegas — embedded in the show community, with relationships at every major venue and exhibit house in the city.",
  },
  {
    num: "04",
    title: "Community-Rooted",
    desc: "StageGate grew out of LV Robotics, a community of builders and operators. That DNA means we treat every client like a member — not a transaction.",
  },
];

export default function About() {
  return (
    <div style={{ background: "#080808", color: "#ececec", minHeight: "100vh" }}>

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        borderBottom: "1px solid rgba(0,255,135,0.10)",
        background: "rgba(8,8,8,0.92)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 2rem" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1rem", color: "#00ff87", letterSpacing: "0.04em" }}>STAGEGATE</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <Link href="/shows" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>Shows</Link>
            <Link href="/services" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>Services</Link>
            <Link href="/xbot" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>XBOT</Link>
            <Link href="/about" style={{ fontSize: "0.8125rem", color: "#00ff87", fontWeight: 600, textDecoration: "none" }}>About</Link>
            <a href="/#contact" style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.60)", fontWeight: 500, textDecoration: "none" }}>Contact</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <a href={getLoginUrl()} style={{
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.85)",
              fontWeight: 600,
              textDecoration: "none",
              padding: "0.45rem 0.9rem",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "6px",
            }}>Sign In</a>
            <Link href="/register">
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
              }}>Get Started <ArrowRight size={13} /></button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "7rem 0 0", overflow: "hidden" }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "flex-end", paddingBottom: 0 }}>
          {/* Left — text */}
          <div style={{ paddingBottom: "4rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", marginBottom: "2rem" }}>
              Our Story
            </p>
            <h1 style={{ fontSize: "clamp(2.75rem, 5.5vw, 5.5rem)", fontWeight: 800, lineHeight: 0.92, letterSpacing: "-0.05em", marginBottom: "2.5rem" }}>
              Built by the<br />
              <span style={{ color: "#00ff87" }}>Las Vegas</span><br />
              robotics community.
            </h1>
            <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: "2.5rem" }}>
              StageGate didn't start as a logistics company. It started as a community of roboticists who kept watching the same problem unfold on the show floor — and decided to fix it from the inside.
            </p>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {[
                { value: "200+", label: "Robots Staged" },
                { value: "40+",  label: "Brands Served" },
                { value: "19+",  label: "Shows / Year" },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700, color: "#00ff87", letterSpacing: "-0.03em" }}>{stat.value}</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: "0.125rem" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — female humanoid hero image */}
          <div style={{ position: "relative", height: "clamp(420px, 60vw, 680px)", overflow: "hidden", borderRadius: "16px 16px 0 0" }}>
            <img
              src="/photos/humanoid-female.png"
              alt="Advanced humanoid robot at technology showcase"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
            />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, transparent 55%, rgba(8,8,8,0.80) 100%)",
            }} />
            <div style={{ position: "absolute", bottom: "1.25rem", left: "1.25rem" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)" }}>
                The next generation of robots is here
              </span>
            </div>
          </div>
        </div>

        {/* Mobile: full-bleed fallback strip */}
        <style>{`@media (max-width: 767px) { .about-hero-grid { grid-template-columns: 1fr !important; } .about-hero-img { height: 340px !important; border-radius: 0 !important; } }`}</style>
      </section>

      {/* ── LV ROBOTICS ORIGIN ───────────────────────────────────────────────── */}
      <section style={{ padding: "6rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "5fr 4fr", gap: "6rem", alignItems: "start" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "2rem", padding: "0.4rem 0.9rem", border: "1px solid rgba(0,255,135,0.20)", borderRadius: "100px", background: "rgba(0,255,135,0.05)" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00ff87", display: "inline-block" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#00ff87" }}>LV Robotics</span>
              </div>
              <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.04em", marginBottom: "1.75rem" }}>
                Nevada's first robotics community.
              </h2>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
                Las Vegas Robotics (LV Robotics) was founded to build the connective tissue that the Nevada robotics ecosystem was missing — a place where engineers, founders, operators, and enthusiasts could meet, collaborate, and grow together.
              </p>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
                What started as monthly meetups at the Las Vegas Tech Center grew into a network spanning humanoid robotics, autonomous mobile robots, industrial automation, and drone technology. Members came from companies like Unitree, Agility Robotics, Boston Dynamics, and dozens of startups building the next generation of physical AI.
              </p>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.75 }}>
                Las Vegas is the world's trade show capital — home to CES, NAB, MODEX, NVIDIA GTC, and dozens of other major events every year. LV Robotics members were exhibiting at all of them. And they kept running into the same wall.
              </p>
            </div>
            <div style={{ paddingTop: "1rem" }}>
              <div style={{ padding: "2rem", border: "1px solid rgba(0,255,135,0.12)", borderRadius: "12px", background: "rgba(0,255,135,0.03)", marginBottom: "1.5rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(0,255,135,0.50)", marginBottom: "1rem" }}>The Problem We Solved</div>
                <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.70)", lineHeight: 1.7 }}>
                  Robot companies were shipping to Las Vegas with no local partner who understood their hardware. Freight handlers dropped crates. Booth crews didn't know how to position a quadruped. Demo units arrived with dead batteries and no charging infrastructure. Shows started with robots that couldn't move.
                </p>
              </div>
              <div style={{ padding: "2rem", border: "1px solid rgba(255,149,0,0.12)", borderRadius: "12px", background: "rgba(255,149,0,0.03)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,149,0,0.50)", marginBottom: "1rem" }}>The StageGate Answer</div>
                <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.70)", lineHeight: 1.7 }}>
                  A single Las Vegas partner that handles everything from crate receipt to show close — warehousing, staging, activation, and certified on-floor technical support. Built by people who know robots, not just freight.
                </p>
              </div>
              {/* Show floor photo */}
              <div style={{ borderRadius: "12px", overflow: "hidden", position: "relative", height: "220px", marginTop: "0.5rem" }}>
                <img
                  src="/photos/tradeshow-floor.png"
                  alt="Robots deployed at a trade show floor"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,8,0.6) 0%, transparent 60%)" }} />
                <span style={{ position: "absolute", bottom: "0.875rem", left: "1rem", fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)" }}>
                  Trade show floor · Las Vegas
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHOTO STRIP ──────────────────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "4rem 0" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 0.9fr", gap: "0.75rem", borderRadius: "12px", overflow: "hidden" }}>
            {[
              { src: "/photos/rokae-demo.png",    alt: "Robot demo at trade show",      caption: "Live demo activation",   pos: "center" },
              { src: "/photos/engineai-ces.png",   alt: "Humanoid robots at CES",        caption: "CES floor presence",     pos: "center top" },
              { src: "/photos/unitree-show.png",   alt: "Unitree robot at trade show",   caption: "Show-floor interaction", pos: "center" },
              { src: "/photos/rokae-booth.png",    alt: "Full robot booth setup",        caption: "Booth-ready systems",    pos: "center" },
            ].map(img => (
              <div key={img.src} style={{ position: "relative", height: "260px" }}>
                <img src={img.src} alt={img.alt} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: img.pos }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)" }} />
                <span style={{ position: "absolute", bottom: "0.875rem", left: "1rem", fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>{img.caption}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "4rem" }}>
            Timeline
          </p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {TIMELINE.map((item, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "3rem", padding: "2.5rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", paddingTop: "0.2rem", letterSpacing: "0.04em" }}>{item.year}</div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff", marginBottom: "0.6rem", letterSpacing: "-0.02em" }}>{item.title}</h3>
                  <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div className="container">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "1.5rem" }}>
            How We Operate
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.04em", marginBottom: "4rem", maxWidth: "20ch" }}>
            Four principles that guide every activation.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0" }}>
            {VALUES.map((v, i) => (
              <div key={i} style={{
                padding: "2.5rem",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "rgba(255,255,255,0.20)", display: "block", marginBottom: "1rem" }}>{v.num}</span>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>{v.title}</h3>
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.50)", lineHeight: 1.75 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "8rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container">
          <h2 style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.05em", marginBottom: "2rem", maxWidth: "18ch" }}>
            Ready to bring your robot to{" "}
            <span style={{ color: "#00ff87" }}>Las Vegas?</span>
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.60)", maxWidth: "48ch", lineHeight: 1.7, marginBottom: "2.5rem" }}>
            Register free and tell us about your robot and your next show. We'll handle everything from there.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/register">
              <button style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#ff9500", color: "#080808", border: "none", borderRadius: "6px", padding: "0.75rem 1.75rem", fontSize: "0.9375rem", fontWeight: 700, cursor: "pointer" }}>
                Register Free <ArrowRight size={15} />
              </button>
            </Link>
            <a href="mailto:hello@onstage.bot" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "transparent", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "0.75rem 1.75rem", fontSize: "0.9375rem", fontWeight: 600, textDecoration: "none" }}>
              Email Us <ArrowUpRight size={15} />
            </a>
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
              { label: "Home", href: "/" },
              { label: "Services", href: "/services" },
              { label: "Shows", href: "/shows" },
              { label: "About", href: "/about" },
              { label: "Register", href: "/register" },
              { label: "Contact", href: "/#contact" },
            ].map(link => (
              <Link key={link.href} href={link.href}
                style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.28)", textDecoration: "none" }}
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
    </div>
  );
}
