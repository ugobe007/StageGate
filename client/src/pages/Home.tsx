import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight, ChevronDown, Play } from "lucide-react";
import GetQuoteModal from "@/components/GetQuoteModal";
import DemoRequestModal from "@/components/DemoRequestModal";

/* ── Image URLs ─────────────────────────────────────────────────────────────── */
const IMG_HERO      = "/manus-storage/ces-unitree-pack_b3079621.png";   // Unitree pack — full booth energy
const IMG_STEP1     = "/manus-storage/ces-robot-warehouse_ebad86ee.png"; // warehouse / staging
const IMG_STEP2     = "/manus-storage/ces-engineai-robots_22423812.png"; // robots in booth
const IMG_STEP3     = "/manus-storage/ces-neura-robots_14776dff.png";    // live performance
const IMG_GRID_1    = "/manus-storage/ces-richtech-robot_4be07bbb.png";
const IMG_GRID_2    = "/manus-storage/ces-hisense-robots_c9d909a1.png";
const IMG_GRID_3    = "/manus-storage/ces-unitree-rider_a54d8806.png";

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

/* ── Intersection observer hook ─────────────────────────────────────────────── */
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

export default function Home() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const { ref: statsRef, inView: statsVisible } = useInView(0.4);

  const shows   = useCountUp(19, 1600, statsVisible);
  const robots  = useCountUp(200, 1800, statsVisible);
  const brands  = useCountUp(40, 1600, statsVisible);
  const years   = useCountUp(8, 1400, statsVisible);

  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO — full viewport, massive type, robot photo right
      ════════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          position: "relative",
          overflow: "hidden",
        }}
        className="pt-14"
      >
        {/* Left: text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "6rem 3rem 6rem 4rem",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Eyebrow */}
          <div className="section-label" style={{ marginBottom: "2rem" }}>
            Las Vegas · Trade Show Robot Infrastructure
          </div>

          {/* Headline — massive */}
          <h1
            style={{
              fontSize: "clamp(3.5rem, 6vw, 5.5rem)",
              fontWeight: 900,
              letterSpacing: "-0.045em",
              lineHeight: 1.0,
              color: "#fff",
              marginBottom: "2rem",
            }}
          >
            Your Robot<br />
            <span className="text-accent-gradient">Performs.</span><br />
            <span style={{ color: "rgba(255,255,255,0.30)" }}>
              We Handle<br />Everything Else.
            </span>
          </h1>

          {/* Sub */}
          <p
            style={{
              fontSize: "1.125rem",
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.65,
              maxWidth: "34ch",
              marginBottom: "2.5rem",
              fontWeight: 400,
            }}
          >
            Las Vegas is the world's trade show capital. Warehouse your robots here year-round — we stage, activate, and support them at every major show, so your engineers stay home.
          </p>

          {/* CTAs — 4 actions */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/register">
              <button className="btn-primary">
                Register <ArrowRight size={15} />
              </button>
            </Link>
            <button
              className="btn-default"
              onClick={() => setDemoOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Play size={13} style={{ opacity: 0.7 }} /> Demo
            </button>
            <a href="#how-it-works">
              <button className="btn-default">How it works</button>
            </a>
            <Link href="/services">
              <button className="btn-default">Services</button>
            </Link>
          </div>

          {/* Trust line */}
          <div
            style={{
              marginTop: "3rem",
              display: "flex",
              gap: "1.75rem",
              flexWrap: "wrap",
            }}
          >
            {["Las Vegas HQ", "Free registration", "No long-term contracts"].map(t => (
              <span
                key={t}
                style={{
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.30)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "inline-block" }} />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: full-bleed robot photo */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
          }}
        >
          <img
            src={IMG_HERO}
            alt="Unitree robots at CES trade show booth"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
            }}
          />
          {/* Left fade to black */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, #000 0%, transparent 35%)",
              pointerEvents: "none",
            }}
          />
          {/* Bottom fade */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30%",
              background: "linear-gradient(to top, #000 0%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            opacity: 0.35,
          }}
        >
          <span style={{ fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff" }}>Scroll</span>
          <ChevronDown size={14} color="#fff" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          STATS BAR
      ════════════════════════════════════════════════════════════════════════ */}
      <div
        ref={statsRef}
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "3rem 0",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "2rem",
            }}
          >
            {[
              { value: shows,  suffix: "+", label: "Las Vegas Shows" },
              { value: robots, suffix: "+", label: "Robots Activated" },
              { value: brands, suffix: "+", label: "Robot Brands" },
              { value: years,  suffix: " yrs", label: "In Operation" },
            ].map(({ value, suffix, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    color: "#fff",
                    lineHeight: 1,
                    marginBottom: "0.5rem",
                  }}
                >
                  {value}{suffix}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.40)", letterSpacing: "0.02em" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          THE PROBLEM / INSIGHT
      ════════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "8rem 0" }}>
        <div className="container">
          <div style={{ maxWidth: "52rem" }}>
            <div className="section-label" style={{ marginBottom: "1.5rem" }}>The problem</div>
            <h2
              style={{
                fontSize: "clamp(2rem, 4vw, 3.25rem)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "#fff",
                lineHeight: 1.1,
                marginBottom: "1.75rem",
              }}
            >
              Shipping a robot to a trade show is a logistics nightmare.
              <span style={{ color: "rgba(255,255,255,0.30)" }}> We solved it.</span>
            </h2>
            <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.50)", lineHeight: 1.7, maxWidth: "52ch" }}>
              Most robotics companies spend weeks coordinating freight, customs, crating, hotel rooms for engineers,
              and on-site troubleshooting — for every single show. StageGate eliminates all of it. Your robot lives
              in Las Vegas. We handle the rest.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          3-STEP PROCESS
      ════════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "0 0 8rem",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="container" style={{ paddingTop: "6rem" }}>
          <div id="how-it-works" className="section-label" style={{ marginBottom: "3rem" }}>How it works — Las Vegas</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px" }}>
            {[
              {
                num: "01",
                title: "Ship Once",
                body: "Send your robot to our Las Vegas warehouse. We handle inbound freight, customs clearance, and secure storage year-round. No re-shipping between shows.",
                img: IMG_STEP1,
                cta: "Warehousing & Storage",
                href: "/services",
              },
              {
                num: "02",
                title: "We Stage It",
                body: "Before each show, our team uncrates, charges, calibrates, and installs your robot at your booth. Full pre-show activation and technical rehearsal included.",
                img: IMG_STEP2,
                cta: "Staging & Activation",
                href: "/services",
              },
              {
                num: "03",
                title: "It Performs",
                body: "Your robot runs flawlessly on the show floor. Our StageHand™ technicians are on-site the entire event — monitoring, troubleshooting, and keeping the crowd engaged.",
                img: IMG_STEP3,
                cta: "Live Technical Support",
                href: "/stagehand",
              },
            ].map(({ num, title, body, img, cta, href }) => (
              <div
                key={num}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Image */}
                <div style={{ height: "220px", overflow: "hidden", position: "relative" }}>
                  <img
                    src={img}
                    alt={title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      filter: "brightness(0.75)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "60%",
                      background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "1rem",
                      left: "1.5rem",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.40)",
                      textTransform: "uppercase",
                    }}
                  >
                    Step {num}
                  </div>
                </div>

                {/* Text */}
                <div style={{ padding: "1.75rem", flex: 1, display: "flex", flexDirection: "column" }}>
                  <h3
                    style={{
                      fontSize: "1.375rem",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      color: "#fff",
                      marginBottom: "0.875rem",
                    }}
                  >
                    {title}
                  </h3>
                  <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.50)", lineHeight: 1.65, flex: 1 }}>
                    {body}
                  </p>
                  <Link href={href}>
                    <div
                      style={{
                        marginTop: "1.5rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        fontSize: "0.8125rem",
                        color: "rgba(255,255,255,0.55)",
                        cursor: "pointer",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                    >
                      {cta} <ArrowUpRight size={13} />
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          PHOTO GRID — CES robots in action
      ════════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "0 0 8rem",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "2.5rem",
            }}
          >
            <div>
              <div className="section-label" style={{ marginBottom: "0.75rem" }}>In the field</div>
              <h2
                style={{
                  fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "#fff",
                  lineHeight: 1.1,
                }}
              >
                Robots we've activated at CES
              </h2>
            </div>
            <Link href="/shows">
              <button className="btn-default" style={{ padding: "0.6rem 1.25rem", fontSize: "0.875rem" }}>
                View all shows <ArrowUpRight size={14} />
              </button>
            </Link>
          </div>

          {/* Asymmetric photo grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gridTemplateRows: "280px 280px",
              gap: "2px",
            }}
          >
            {/* Large left — spans 2 rows */}
            <div style={{ gridRow: "1 / 3", overflow: "hidden", position: "relative" }}>
              <img
                src={IMG_HERO}
                alt="Unitree robot pack at CES"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "1.25rem",
                  left: "1.25rem",
                  background: "rgba(0,0,0,0.7)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.875rem",
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.75)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                }}
              >
                UNITREE · CES 2026
              </div>
            </div>

            {[
              { src: IMG_GRID_1, label: "RICHTECH · CES 2026" },
              { src: IMG_STEP2,  label: "ENGINEAI · CES 2026" },
              { src: IMG_GRID_2, label: "HISENSE · CES 2026" },
              { src: IMG_GRID_3, label: "UNITREE RIDER · CES 2026" },
            ].map(({ src, label }) => (
              <div key={label} style={{ overflow: "hidden", position: "relative" }}>
                <img
                  src={src}
                  alt={label}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "0.75rem",
                    left: "0.75rem",
                    background: "rgba(0,0,0,0.65)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "0.375rem",
                    padding: "0.3rem 0.625rem",
                    fontSize: "0.6875rem",
                    color: "rgba(255,255,255,0.65)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SERVICES — clean text list
      ════════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "8rem 0",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "6rem",
              alignItems: "start",
            }}
          >
            {/* Left */}
            <div>
              <div className="section-label" style={{ marginBottom: "1.5rem" }}>What we do</div>
              <h2
                style={{
                  fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "#fff",
                  lineHeight: 1.1,
                  marginBottom: "1.5rem",
                }}
              >
                End-to-end robot show services
              </h2>
              <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: "2rem" }}>
                Eight integrated service lines, all managed from our Las Vegas operations center.
              </p>
              <Link href="/services">
                <button className="btn-primary" style={{ padding: "0.65rem 1.5rem", fontSize: "0.875rem" }}>
                  View all services <ArrowRight size={15} />
                </button>
              </Link>
            </div>

            {/* Right — service list */}
            <div>
              {[
                { num: "01", name: "Inbound Logistics",       desc: "Freight coordination, customs clearance, and secure inbound handling." },
                { num: "02", name: "Warehousing & Storage",   desc: "Climate-controlled Las Vegas warehouse with 24/7 security monitoring." },
                { num: "03", name: "Staging & Activation",    desc: "Pre-show uncrating, calibration, charging, and booth installation." },
                { num: "04", name: "Live Technical Support",  desc: "On-site technicians for the full duration of every show." },
                { num: "05", name: "StageHand 24/7™",         desc: "Round-the-clock remote monitoring and emergency dispatch." },
                { num: "06", name: "StagePro Training™",      desc: "Operator certification programs for your booth staff." },
                { num: "07", name: "Showroom & Demo",         desc: "Permanent Las Vegas demo space for client previews and press." },
                { num: "08", name: "Robot Sales & Marketing", desc: "Lead generation, media coverage, and post-show analytics." },
              ].map(({ num, name, desc }, i) => (
                <div
                  key={num}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3rem 1fr",
                    gap: "1rem",
                    padding: "1.25rem 0",
                    borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    cursor: "default",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6875rem",
                      color: "rgba(255,255,255,0.25)",
                      letterSpacing: "0.06em",
                      paddingTop: "0.2rem",
                    }}
                  >
                    {num}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "#fff",
                        letterSpacing: "-0.02em",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {name}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.40)", lineHeight: 1.55 }}>
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          UPCOMING SHOWS
      ════════════════════════════════════════════════════════════════════════ */}
      <UpcomingShowsSection onQuote={() => setQuoteOpen(true)} />

      {/* ═══════════════════════════════════════════════════════════════════════
          BOTTOM CTA
      ════════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "10rem 0",
          textAlign: "center",
        }}
      >
        <div className="container">
          <div className="section-label" style={{ marginBottom: "2rem" }}>Las Vegas · Ready to start?</div>
          <h2
            style={{
              fontSize: "clamp(2.5rem, 6vw, 5rem)",
              fontWeight: 900,
              letterSpacing: "-0.045em",
              color: "#fff",
              lineHeight: 1.0,
              marginBottom: "1.5rem",
            }}
          >
            Your robot belongs<br />
            <span className="text-accent-gradient">on the Las Vegas floor.</span>
          </h2>
          <p
            style={{
              fontSize: "1.125rem",
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.65,
              maxWidth: "44ch",
              margin: "0 auto 3rem",
            }}
          >
            Register free. Tell us about your robot and your Las Vegas show schedule.
            We handle everything from the first crate to the last curtain call.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register">
              <button className="btn-primary" style={{ padding: "0.875rem 2.25rem", fontSize: "1rem" }}>
                Register <ArrowRight size={17} />
              </button>
            </Link>
            <button
              className="btn-default"
              style={{ padding: "0.875rem 2.25rem", fontSize: "1rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              onClick={() => setDemoOpen(true)}
            >
              <Play size={14} style={{ opacity: 0.7 }} /> Demo
            </button>
            <Link href="/services">
              <button className="btn-default" style={{ padding: "0.875rem 2.25rem", fontSize: "1rem" }}>Services</button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "3rem 0",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                border: "1.5px solid rgba(255,255,255,0.30)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.60)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L2 8h5l-1 5 6-7H7l1-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>StageGate</span>
          </div>

          <div style={{ display: "flex", gap: "2rem" }}>
            {[
              { href: "/shows", label: "Shows" },
              { href: "/services", label: "Services" },
              { href: "/stagehand", label: "StageHand™" },
              { href: "/stagepro", label: "StagePro™" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "rgba(255,255,255,0.35)",
                    cursor: "pointer",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                >
                  {label}
                </span>
              </Link>
            ))}
          </div>

          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.20)" }}>
            © 2026 StageGate · Las Vegas, NV
          </div>
        </div>
      </footer>

      <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}

/* ── Upcoming Shows sub-component ─────────────────────────────────────────── */
function UpcomingShowsSection({ onQuote }: { onQuote: () => void }) {
  const { data: allShows } = trpc.shows.lasVegas2026.useQuery();
  const shows = allShows?.slice(0, 4);

  if (!shows?.length) return null;

  return (
    <section
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "8rem 0",
      }}
    >
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "3rem",
          }}
        >
          <div>
            <div className="section-label" style={{ marginBottom: "0.75rem" }}>Upcoming shows</div>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "#fff",
                lineHeight: 1.1,
              }}
            >
              Book your robot's spot now
            </h2>
          </div>
          <Link href="/shows">
            <button className="btn-default" style={{ padding: "0.6rem 1.25rem", fontSize: "0.875rem" }}>
              All shows <ArrowUpRight size={14} />
            </button>
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px" }}>
          {shows.map((show: any) => (
            <Link key={show.id} href={`/shows/${show.id}`}>
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: "1.75rem",
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: "0.375rem" }}>
                    {show.name}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.40)" }}>
                    {show.venue} · {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <ArrowUpRight size={16} color="rgba(255,255,255,0.25)" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
