/**
 * StageGate — Full-Service Marketing Page
 * One-page overview: Warehousing · Staging · Activation · Technical Support · Sales & Marketing
 */
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import StageGateLogo from "@/components/StageGateLogo";
import GetQuoteModal from "@/components/GetQuoteModal";
import DemoRequestModal from "@/components/DemoRequestModal";

/* ── Palette ──────────────────────────────────────────────────────────────── */
const BG         = "#0d0f11";
const CARD       = "#13151a";
const CARD_HOVER = "#181b22";
const BORDER     = "rgba(255,255,255,0.07)";
const AMBER      = "#f59e0b";
const AMBER_DIM  = "rgba(245,158,11,0.12)";
const AMBER_GLOW = "rgba(245,158,11,0.25)";
const EMERALD    = "#00E87A";
const EMERALD_DIM = "rgba(0,232,122,0.10)";
const TEXT_HI    = "#f1f5f9";
const TEXT_MID   = "#94a3b8";
const TEXT_DIM   = "#4b5563";
const INDIGO     = "#818cf8";

/* ── Service data ─────────────────────────────────────────────────────────── */
const SERVICES = [
  {
    id: "warehousing",
    number: "01",
    label: "Warehousing & Storage",
    tagline: "Your robots live here.",
    description:
      "Secure, climate-controlled storage pre-show, post-show, and year-round. No more expensive round-trip shipping between events — your hardware stays in Las Vegas, ready for the next deployment cycle.",
    bullets: [
      "Climate-controlled, secure facility",
      "Pre-show, post-show & year-round options",
      "Inventory tracking & damage inspection",
      "Crate management & long-term storage",
    ],
    price: "From $150 / week",
    accent: INDIGO,
    accentDim: "rgba(129,140,248,0.10)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "staging",
    number: "02",
    label: "Staging & Activation",
    tagline: "Show-floor ready. Every time.",
    description:
      "We unpack, bench-test, firmware-update, charge, calibrate, and deliver your robot to the booth — fully operational. Your team lands in Las Vegas and walks straight to a working demo.",
    bullets: [
      "Unboxing & arrival inspection",
      "Firmware updates & bench testing",
      "Full calibration & charging",
      "Booth delivery & assembly",
    ],
    price: "From $800 / show",
    accent: AMBER,
    accentDim: AMBER_DIM,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: "technical-support",
    number: "03",
    label: "Live Technical Support",
    tagline: "An expert on the floor. Not on a plane.",
    description:
      "On-call robotics technicians stationed at the show. Daily startup and shutdown cycles, rapid repair, real-time troubleshooting, and spare-parts management — so a hardware hiccup never becomes a PR disaster.",
    bullets: [
      "On-call technician at your booth",
      "Daily startup / shutdown cycles",
      "Rapid repair & emergency response",
      "Spare parts management",
    ],
    price: "From $450 / half-day",
    accent: EMERALD,
    accentDim: EMERALD_DIM,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: "stagehand",
    number: "04",
    label: "StageHand™ 24/7 Remote Support",
    tagline: "GeekSquad for robots.",
    description:
      "Monthly retainer contracts for remote diagnostics, firmware management, and field dispatch. StageHand keeps your robots operational 365 days a year — whether they're at a show, a showroom, or a customer site.",
    bullets: [
      "Remote diagnostics & monitoring",
      "Firmware & software management",
      "Field dispatch on demand",
      "SLA contracts available",
    ],
    price: "From $1,200 / month",
    accent: "#60a5fa",
    accentDim: "rgba(96,165,250,0.10)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    id: "showroom",
    number: "05",
    label: "Showroom & Demo Hosting",
    tagline: "A permanent stage in Las Vegas.",
    description:
      "Permanent display space for year-round demos, investor visits, media days, and off-floor activations. Your robot is always on — without the cost of a full trade show deployment.",
    bullets: [
      "Year-round display space",
      "Investor & press visit support",
      "Off-floor activation hosting",
      "Managed demo operations",
    ],
    price: "From $1,500 / month",
    accent: "#a78bfa",
    accentDim: "rgba(167,139,250,0.10)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: "sales-marketing",
    number: "06",
    label: "Robot Sales & Marketing",
    tagline: "We open doors. You close deals.",
    description:
      "Distribution partnerships, brand activations through The Robot Guild, and StageGate Ready™ certification that signals US-market readiness to buyers, press, and investors. We connect your brand with the people who matter.",
    bullets: [
      "US distribution partnerships",
      "The Robot Guild brand activations",
      "StageGate Ready™ certification",
      "Investor & media introductions",
    ],
    price: "10–20% commission",
    accent: "#f97316",
    accentDim: "rgba(249,115,22,0.10)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

/* ── Stats ────────────────────────────────────────────────────────────────── */
const STATS = [
  { value: "38", label: "Humanoid companies at CES 2026" },
  { value: "22K+", label: "Annual Las Vegas conventions" },
  { value: "$80K+", label: "Typical per-show cost without us" },
  { value: "600+", label: "Engineers in our LV network" },
];

/* ── Process steps ────────────────────────────────────────────────────────── */
const PROCESS = [
  { step: "01", title: "Robot Lands in LV", desc: "Airport pickup, customs coordination, climate-controlled receiving, and full arrival inspection." },
  { step: "02", title: "We Activate It", desc: "Unpack, bench test, firmware update, charge, calibrate, and deliver to your booth — fully operational." },
  { step: "03", title: "Show Goes Live", desc: "Our technician is on the floor. Daily cycles, emergency repair, and real-time demo support." },
  { step: "04", title: "Show Ends", desc: "Packdown, damage inspection, and return to our climate-controlled warehouse — ready for the next show." },
];

/* ── Component ────────────────────────────────────────────────────────────── */
export default function Marketing() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Parallax subtle effect on hero
  useEffect(() => {
    const handler = () => {
      if (heroRef.current) {
        const y = window.scrollY * 0.25;
        heroRef.current.style.transform = `translateY(${y}px)`;
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT_HI, fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      <Navbar darkBg />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          paddingTop: "7rem",
          paddingBottom: "5rem",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {/* Background image */}
        <div
          ref={heroRef}
          style={{
            position: "absolute",
            inset: "-10%",
            backgroundImage: "url(/manus-storage/hero-humanoid-expo.png)",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.18,
            filter: "saturate(0.4)",
          }}
        />
        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to bottom, ${BG}55 0%, ${BG}cc 60%, ${BG} 100%)`,
          }}
        />

        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: AMBER_DIM,
              border: `1px solid ${AMBER_GLOW}`,
              borderRadius: "999px",
              padding: "0.3rem 0.9rem",
              marginBottom: "1.75rem",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: AMBER, display: "inline-block" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: AMBER }}>
              Robotics Activation Infrastructure
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: "820px",
              marginBottom: "1.5rem",
              color: TEXT_HI,
            }}
          >
            We make robots{" "}
            <span
              style={{
                background: `linear-gradient(135deg, ${AMBER} 0%, #fbbf24 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              operational.
            </span>
          </h1>

          {/* Sub-headline */}
          <p
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              color: TEXT_MID,
              maxWidth: "600px",
              lineHeight: 1.65,
              marginBottom: "2.5rem",
            }}
          >
            End-to-end robot logistics, warehousing, staging, activation, technical support,
            showroom services, and sales — built for the Las Vegas trade show economy.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.875rem" }}>
            <button
              onClick={() => setQuoteOpen(true)}
              style={{
                background: AMBER,
                color: "#000",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.8rem 1.75rem",
                fontSize: "0.9375rem",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Get a Quote
            </button>
            <button
              onClick={() => setDemoOpen(true)}
              style={{
                background: "transparent",
                color: TEXT_HI,
                border: `1px solid ${BORDER}`,
                borderRadius: "0.5rem",
                padding: "0.8rem 1.75rem",
                fontSize: "0.9375rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_HI; }}
            >
              Request a Demo
            </button>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────── */}
      <section
        style={{
          borderBottom: `1px solid ${BORDER}`,
          background: CARD,
        }}
      >
        <div
          className="container"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0",
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={i}
              style={{
                padding: "1.75rem 1.5rem",
                borderRight: i < STATS.length - 1 ? `1px solid ${BORDER}` : "none",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(1.75rem, 3vw, 2.25rem)",
                  fontWeight: 800,
                  color: AMBER,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  marginBottom: "0.4rem",
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: "0.78rem", color: TEXT_MID, lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4rem",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: AMBER,
                  marginBottom: "1rem",
                }}
              >
                The Problem
              </p>
              <h2
                style={{
                  fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.025em",
                  marginBottom: "1.25rem",
                }}
              >
                The robots are arriving.{" "}
                <span style={{ color: TEXT_MID }}>The infrastructure is not.</span>
              </h2>
              <p style={{ color: TEXT_MID, lineHeight: 1.7, fontSize: "1rem", marginBottom: "1.5rem" }}>
                Las Vegas hosts the world's most important technology trade shows. Every year, more
                robots ship here than anywhere else on earth — and every year, the same crisis repeats.
                General contractors can move crates. They cannot unpack, boot up, calibrate, or debug
                a humanoid robot.
              </p>
              <p style={{ color: TEXT_MID, lineHeight: 1.7, fontSize: "1rem" }}>
                A robotics company in Germany, Japan, or China must send 2–4 engineers to Las Vegas
                for a 3-day show. Time zone mismatch, visa delays, and massive shipping costs make
                this expensive, unreliable, and unsustainable.{" "}
                <strong style={{ color: TEXT_HI }}>StageGate owns the missing layer.</strong>
              </p>
            </div>
            <div
              style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: "1rem",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderBottom: `1px solid ${BORDER}`,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: TEXT_DIM,
                }}
              >
                Typical Humanoid Deployment Costs (Without StageGate)
              </div>
              {[
                { label: "International shipping", cost: "$2K–$8K" },
                { label: "Engineering travel", cost: "$8K–$20K" },
                { label: "On-site labor", cost: "$3K–$10K" },
                { label: "Emergency repair risk", cost: "$5K–$50K" },
                { label: "Opportunity cost of failed demo", cost: "Unbounded" },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.875rem 1.5rem",
                    borderBottom: i < 4 ? `1px solid ${BORDER}` : "none",
                  }}
                >
                  <span style={{ fontSize: "0.875rem", color: TEXT_MID }}>{row.label}</span>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: row.cost === "Unbounded" ? "#ef4444" : TEXT_HI,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.cost}
                  </span>
                </div>
              ))}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  background: AMBER_DIM,
                  borderTop: `1px solid ${AMBER_GLOW}`,
                  fontSize: "0.8rem",
                  color: AMBER,
                  fontWeight: 600,
                }}
              >
                Total exposure: $25,000–$80,000+ per show
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: AMBER,
                marginBottom: "0.75rem",
              }}
            >
              Full-Service Capabilities
            </p>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
                maxWidth: "600px",
                margin: "0 auto 1rem",
              }}
            >
              Six capabilities. One deployment partner.
            </h2>
            <p style={{ color: TEXT_MID, maxWidth: "520px", margin: "0 auto", lineHeight: 1.65 }}>
              Each service is a distinct revenue stream, a competitive moat, and a building block
              of the robot deployment infrastructure Las Vegas does not yet have.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {SERVICES.map((svc) => {
              const isHovered = hoveredService === svc.id;
              return (
                <div
                  key={svc.id}
                  onMouseEnter={() => setHoveredService(svc.id)}
                  onMouseLeave={() => setHoveredService(null)}
                  style={{
                    background: isHovered ? CARD_HOVER : CARD,
                    border: `1px solid ${isHovered ? svc.accent + "55" : BORDER}`,
                    borderRadius: "1rem",
                    padding: "1.75rem",
                    cursor: "default",
                    transition: "background 0.2s, border-color 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "0.75rem",
                        background: svc.accentDim,
                        border: `1px solid ${svc.accent}33`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: svc.accent,
                        flexShrink: 0,
                      }}
                    >
                      {svc.icon}
                    </div>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        color: TEXT_DIM,
                        fontVariantNumeric: "tabular-nums",
                        paddingTop: "0.25rem",
                      }}
                    >
                      {svc.number}
                    </span>
                  </div>

                  {/* Label + tagline */}
                  <div>
                    <h3
                      style={{
                        fontSize: "1.0625rem",
                        fontWeight: 700,
                        color: TEXT_HI,
                        marginBottom: "0.25rem",
                        lineHeight: 1.3,
                      }}
                    >
                      {svc.label}
                    </h3>
                    <p style={{ fontSize: "0.875rem", color: svc.accent, fontWeight: 500 }}>
                      {svc.tagline}
                    </p>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: "0.875rem", color: TEXT_MID, lineHeight: 1.65, flexGrow: 1 }}>
                    {svc.description}
                  </p>

                  {/* Bullets */}
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {svc.bullets.map((b, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: TEXT_MID }}>
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: svc.accent,
                            flexShrink: 0,
                            opacity: 0.8,
                          }}
                        />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* Price */}
                  <div
                    style={{
                      marginTop: "0.25rem",
                      paddingTop: "1rem",
                      borderTop: `1px solid ${BORDER}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: svc.accent,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {svc.price}
                    </span>
                    <button
                      onClick={() => setQuoteOpen(true)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${svc.accent}55`,
                        borderRadius: "0.375rem",
                        padding: "0.3rem 0.75rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: svc.accent,
                        cursor: "pointer",
                        letterSpacing: "0.04em",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = svc.accentDim)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      Get Quote →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: AMBER,
                marginBottom: "0.75rem",
              }}
            >
              The Deployment Lifecycle
            </p>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              From airport to show floor — we own every step.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0",
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: "1rem",
              overflow: "hidden",
            }}
          >
            {PROCESS.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: "2rem 1.75rem",
                  borderRight: i < PROCESS.length - 1 ? `1px solid ${BORDER}` : "none",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 900,
                    color: AMBER_DIM.replace("0.12", "0.2"),
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                    marginBottom: "1rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {p.step}
                </div>
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: TEXT_HI,
                    marginBottom: "0.5rem",
                    lineHeight: 1.3,
                  }}
                >
                  {p.title}
                </h3>
                <p style={{ fontSize: "0.8375rem", color: TEXT_MID, lineHeight: 1.6 }}>{p.desc}</p>
                {i < PROCESS.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      right: "-0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      zIndex: 1,
                      color: AMBER,
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      display: "none", // hidden on mobile, shown via CSS would need media query
                    }}
                  >
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE BRANDS ─────────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: AMBER,
                marginBottom: "0.75rem",
              }}
            >
              Three Brands. One Mission.
            </p>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              A new category: Robotics Activation Infrastructure
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {[
              {
                name: "StageGate",
                sub: "Trade Show Lifecycle",
                desc: "Full-service robot logistics from arrival to departure — every step handled.",
                items: ["Receiving", "Warehousing", "Activation", "Live Support", "Packdown"],
                accent: AMBER,
                accentDim: AMBER_DIM,
              },
              {
                name: "StageHand™",
                sub: "24/7 Technical Support",
                desc: "GeekSquad for robots: remote and on-site support for ongoing deployments and emergency repair.",
                items: ["Remote Support", "On-Site Dispatch", "Monthly Retainers", "SLA Contracts"],
                accent: EMERALD,
                accentDim: EMERALD_DIM,
              },
              {
                name: "StagePro™",
                sub: "Workforce Training",
                desc: "Hands-on technician training; apprenticeships and corporate cohorts.",
                items: ["1-Day Workshops", "3-Day Certification", "6-Week Apprentice", "Corporate Cohorts"],
                accent: INDIGO,
                accentDim: "rgba(129,140,248,0.10)",
              },
            ].map((brand) => (
              <div
                key={brand.name}
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: "1rem",
                  padding: "2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: brand.accent,
                      marginBottom: "0.4rem",
                    }}
                  >
                    {brand.sub}
                  </div>
                  <h3
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      color: TEXT_HI,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {brand.name}
                  </h3>
                </div>
                <p style={{ fontSize: "0.875rem", color: TEXT_MID, lineHeight: 1.65 }}>{brand.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {brand.items.map((item) => (
                    <span
                      key={item}
                      style={{
                        background: brand.accentDim,
                        border: `1px solid ${brand.accent}33`,
                        borderRadius: "999px",
                        padding: "0.25rem 0.65rem",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: brand.accent,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY LAS VEGAS ────────────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4rem",
              alignItems: "start",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: AMBER,
                  marginBottom: "0.75rem",
                }}
              >
                Why Las Vegas
              </p>
              <h2
                style={{
                  fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.025em",
                  marginBottom: "1.25rem",
                }}
              >
                Las Vegas is becoming the staging capital for physical AI.
              </h2>
              <p style={{ color: TEXT_MID, lineHeight: 1.7, fontSize: "0.9375rem" }}>
                22,000+ annual conventions. CES, MINExpo, HIMSS, NAB, ISC West, Concrete World.
                No city on earth concentrates this volume of technology demonstrations — and no city
                ships more robots. China, Korea, Japan, Germany, and Israel all send hardware here.
                21 of the 38 humanoid companies at CES 2026 were Chinese firms actively seeking a
                US-based technical partner.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                { title: "Extreme Event Density", desc: "22,000+ annual conventions. No city concentrates this volume of technology demonstrations." },
                { title: "Constant Hardware Turnover", desc: "Every show is a new deployment cycle — and a new revenue opportunity." },
                { title: "International Robotics Traffic", desc: "21 of 38 humanoid companies at CES 2026 were Chinese firms seeking a US technical partner." },
                { title: "Live Demo Requirements", desc: "Vegas is where robots are publicly tested in front of investors, press, and buyers. The stakes are highest here." },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    padding: "1.25rem",
                    background: CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "0.5rem",
                      background: AMBER_DIM,
                      border: `1px solid ${AMBER_GLOW}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      color: AMBER,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    0{i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: TEXT_HI, marginBottom: "0.25rem" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: TEXT_MID, lineHeight: 1.55 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKET OPPORTUNITY ───────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: AMBER,
                marginBottom: "0.75rem",
              }}
            >
              Market Opportunity
            </p>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
              }}
            >
              The robot economy is arriving. The infrastructure does not exist yet.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1px",
              background: BORDER,
              border: `1px solid ${BORDER}`,
              borderRadius: "1rem",
              overflow: "hidden",
            }}
          >
            {[
              { scope: "LV Today", value: "$10.6M", label: "Robot activation services in Las Vegas" },
              { scope: "US Today", value: "$30M", label: "US trade show robot services" },
              { scope: "US 2030", value: "$400M+", label: "250K humanoid units/yr at 70% CAGR" },
              { scope: "Global 2030", value: "$2.5B", label: "Global trade show technical services" },
            ].map((m, i) => (
              <div
                key={i}
                style={{
                  background: CARD,
                  padding: "2rem 1.5rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: TEXT_DIM,
                    marginBottom: "0.75rem",
                  }}
                >
                  {m.scope}
                </div>
                <div
                  style={{
                    fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                    fontWeight: 900,
                    color: AMBER,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    marginBottom: "0.5rem",
                  }}
                >
                  {m.value}
                </div>
                <div style={{ fontSize: "0.8125rem", color: TEXT_MID, lineHeight: 1.45 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: "6rem 0" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: AMBER_DIM,
              border: `1px solid ${AMBER_GLOW}`,
              borderRadius: "999px",
              padding: "0.3rem 0.9rem",
              marginBottom: "1.75rem",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: AMBER, display: "inline-block" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: AMBER }}>
              Launch: July 2026 · Seed Round: $5M
            </span>
          </div>

          <h2
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              marginBottom: "1.25rem",
              maxWidth: "700px",
              margin: "0 auto 1.25rem",
            }}
          >
            Your robot ships to Las Vegas.{" "}
            <span style={{ color: AMBER }}>We make sure it works.</span>
          </h2>

          <p
            style={{
              color: TEXT_MID,
              fontSize: "1.0625rem",
              lineHeight: 1.65,
              maxWidth: "520px",
              margin: "0 auto 2.5rem",
            }}
          >
            Join the robotics companies, general contractors, and experiential agencies already
            working with StageGate. Get a quote for your next show.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.875rem", justifyContent: "center" }}>
            <button
              onClick={() => setQuoteOpen(true)}
              style={{
                background: AMBER,
                color: "#000",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.9rem 2rem",
                fontSize: "1rem",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Get a Quote
            </button>
            <Link href="/services">
              <button
                style={{
                  background: "transparent",
                  color: TEXT_HI,
                  border: `1px solid ${BORDER}`,
                  borderRadius: "0.5rem",
                  padding: "0.9rem 2rem",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                View All Services →
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: "2rem 0",
          background: CARD,
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <StageGateLogo size={32} variant="icon" />
            <span style={{ fontSize: "0.875rem", color: TEXT_MID }}>
              StageGate — The Deployment Layer for the Robot Economy
            </span>
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {[
              { href: "/services", label: "Services" },
              { href: "/stagehand", label: "StageHand™" },
              { href: "/stagepro", label: "StagePro™" },
              { href: "/about", label: "About" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: TEXT_DIM,
                    cursor: "pointer",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => ((e.target as HTMLElement).style.color = TEXT_MID)}
                  onMouseLeave={e => ((e.target as HTMLElement).style.color = TEXT_DIM)}
                >
                  {label}
                </span>
              </Link>
            ))}
          </div>
          <span style={{ fontSize: "0.75rem", color: TEXT_DIM }}>
            Part of Vision Vegas 2040
          </span>
        </div>
      </footer>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <GetQuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} />
      <DemoRequestModal open={demoOpen} onOpenChange={(v) => setDemoOpen(v)} />
    </div>
  );
}
