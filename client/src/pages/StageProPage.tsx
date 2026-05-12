import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  GraduationCap, CheckCircle2, ArrowRight,
  Users, Award, BookOpen, Wrench
} from "lucide-react";

const PURPLE = "oklch(0.52 0.20 295)";
const PURPLE_BG = "oklch(0.52 0.20 295 / 0.08)";
const PURPLE_BORDER = "oklch(0.52 0.20 295 / 0.22)";

const PROGRAMS = [
  {
    name: "1-Day Workshop",
    price: "$495",
    unit: "per student",
    duration: "8 hours",
    desc: "Hands-on introduction to robot diagnostics and basic repair. Perfect for sales engineers and product managers.",
    features: ["Robot anatomy & systems overview", "Basic diagnostics & troubleshooting", "Safety protocols", "Certificate of completion"],
    highlight: false,
  },
  {
    name: "3-Day Certification",
    price: "$1,200",
    unit: "per student",
    duration: "24 hours",
    desc: "Deep-dive into repair workflows across multiple robot brands. Ideal for field technicians and support staff.",
    features: ["Multi-brand robot systems", "Advanced diagnostics", "Firmware & software repair", "Hardware repair lab", "StagePro™ Certified badge"],
    highlight: true,
  },
  {
    name: "6-Week Apprentice",
    price: "$4,500",
    unit: "per student",
    duration: "240 hours",
    desc: "Full apprenticeship program. Students work alongside master technicians on real client robots every day.",
    features: ["All robot brands & types", "Real client robot repairs", "Master technician mentorship", "Business & client skills", "Job placement assistance", "StagePro™ Master badge"],
    highlight: false,
  },
  {
    name: "Corporate Cohort",
    price: "$12,000",
    unit: "per cohort (up to 10)",
    duration: "Custom",
    desc: "Custom training program for your entire team. We come to you, or host your team at our Las Vegas facility.",
    features: ["Custom curriculum design", "Your robot brand focus", "On-site or Las Vegas facility", "Up to 10 students", "Dedicated trainer", "Ongoing support package"],
    highlight: false,
  },
];

const DIFFERENTIATORS = [
  { icon: Wrench,    title: "Learn on Real Robots",           desc: "Students repair actual client robots — not simulations. Every repair is real, every lesson sticks." },
  { icon: Award,     title: "Master Technician Instructors",  desc: "All instructors are active StageGate technicians with multi-brand expertise and field experience." },
  { icon: Users,     title: "All Brands Covered",             desc: "Humanoid, industrial, collaborative, delivery — we train on every major robot brand and type." },
  { icon: BookOpen,  title: "Curriculum That Evolves",        desc: "As new robots enter the market, our curriculum updates. Your certification stays current." },
];

export default function StageProPage() {
  return (
    <div className="min-h-screen" style={{ background: "oklch(0.98 0.002 240)", color: "oklch(0.10 0.010 240)" }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        className="pt-28 pb-20 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(1.00 0.000 0)" }}
      >
        <div className="max-w-6xl mx-auto px-6 text-center">
          {/* Icon badge */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: PURPLE_BG, border: `1px solid ${PURPLE_BORDER}` }}
          >
            <GraduationCap size={26} style={{ color: PURPLE }} />
          </div>

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6"
            style={{ color: PURPLE, borderColor: PURPLE_BORDER, background: PURPLE_BG }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PURPLE }} />
            <span className="font-mono text-[11px] tracking-widest uppercase font-semibold">Workforce Training</span>
          </div>

          <h1
            className="text-5xl md:text-6xl font-extrabold mb-4"
            style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.035em" }}
          >
            StagePro<sup className="text-xl font-normal align-super">™</sup>
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: "oklch(0.45 0.010 240)" }}>
            The world's first hands-on robot technician training program.
            Learn by repairing real robots under master technician supervision.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <span className="btn-primary" style={{ background: PURPLE, borderColor: PURPLE }}>
                Enroll Now <ArrowRight size={14} />
              </span>
            </Link>
            <Link href="/order">
              <span className="btn-default">Request Corporate Quote</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      <div
        className="border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(0.97 0.003 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "4",    label: "Program Levels" },
              { value: "All",  label: "Robot Brands Covered" },
              { value: "Real", label: "Client Robots Used in Training" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div
                  className="text-3xl font-extrabold tracking-tight mb-1"
                  style={{ color: PURPLE, letterSpacing: "-0.03em" }}
                >
                  {value}
                </div>
                <div className="text-xs" style={{ color: "oklch(0.52 0.010 240)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Why StagePro ──────────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: "oklch(0.90 0.005 240)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label" style={{ color: PURPLE }}>Why StagePro™</div>
            <h2
              className="text-3xl font-extrabold"
              style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
            >
              Training Unlike Anything Else
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DIFFERENTIATORS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="sg-card flex gap-4"
                style={{ borderTopColor: PURPLE, borderTopWidth: "2px" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: PURPLE_BG, border: `1px solid ${PURPLE_BORDER}` }}
                >
                  <Icon size={16} style={{ color: PURPLE }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: "oklch(0.10 0.010 240)" }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.50 0.010 240)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Programs ──────────────────────────────────────────────────────────── */}
      <section
        className="py-20 border-b"
        style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(0.97 0.003 240)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label" style={{ color: PURPLE }}>Programs</div>
            <h2
              className="text-3xl font-extrabold"
              style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
            >
              StagePro™ Training Programs
            </h2>
            <p className="mt-1 text-sm" style={{ color: "oklch(0.52 0.010 240)" }}>
              Four levels from introductory to master apprentice.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PROGRAMS.map((prog) => (
              <div
                key={prog.name}
                className="sg-card flex flex-col"
                style={{
                  borderTopColor: prog.highlight ? PURPLE : "oklch(0.90 0.005 240)",
                  borderTopWidth: prog.highlight ? "3px" : "1px",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold" style={{ color: "oklch(0.10 0.010 240)" }}>{prog.name}</h3>
                    <div className="font-mono text-[11px] mt-0.5" style={{ color: "oklch(0.55 0.010 240)" }}>{prog.duration}</div>
                  </div>
                  {prog.highlight && (
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                      style={{ color: PURPLE, borderColor: PURPLE_BORDER, background: PURPLE_BG }}
                    >
                      Most Popular
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <span
                    className="text-3xl font-extrabold tracking-tight"
                    style={{ color: PURPLE, letterSpacing: "-0.03em" }}
                  >
                    {prog.price}
                  </span>
                  <span className="text-sm ml-1" style={{ color: "oklch(0.52 0.010 240)" }}>{prog.unit}</span>
                </div>

                <p className="text-xs leading-relaxed mb-4" style={{ color: "oklch(0.48 0.010 240)" }}>{prog.desc}</p>

                <ul className="space-y-2 mb-5 flex-1">
                  {prog.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "oklch(0.42 0.010 240)" }}>
                      <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <span
                    className={`${prog.highlight ? "btn-primary" : "btn-default"} w-full justify-center`}
                    style={prog.highlight ? { background: PURPLE, borderColor: PURPLE } : {}}
                  >
                    Enroll Now
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: "oklch(0.10 0.010 240)" }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="section-label mx-auto justify-center mb-4" style={{ color: PURPLE }}>
            Get Started
          </div>
          <h2
            className="text-3xl font-extrabold mb-3"
            style={{ color: "oklch(0.97 0.002 240)", letterSpacing: "-0.03em" }}
          >
            Build the Next Generation of Robot Technicians
          </h2>
          <p className="mb-7 max-w-md mx-auto text-sm leading-relaxed" style={{ color: "oklch(0.60 0.010 240)" }}>
            Register your company for free and enroll your team in StagePro™ training.
            Corporate cohort pricing available for groups of 5 or more.
          </p>
          <Link href="/register">
            <span className="btn-primary" style={{ background: PURPLE, borderColor: PURPLE }}>
              Register Free Today <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
