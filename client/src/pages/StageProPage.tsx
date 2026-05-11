import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  GraduationCap, CheckCircle2, ArrowRight,
  Users, Award, BookOpen, Wrench
} from "lucide-react";

const PURPLE = "oklch(0.62 0.22 295)";
const PURPLE_GLOW = "oklch(0.62 0.22 295 / 0.25)";
const PURPLE_DIM  = "oklch(0.62 0.22 295 / 0.10)";
const PURPLE_BORDER = "oklch(0.62 0.22 295 / 0.25)";

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
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-28 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: "oklch(0.62 0.22 295 / 0.06)" }}
        />
        <div className="container relative z-10 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}`, boxShadow: `0 0 30px ${PURPLE_GLOW}` }}
          >
            <GraduationCap size={30} style={{ color: PURPLE }} />
          </div>

          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6"
            style={{ color: PURPLE, borderColor: PURPLE_BORDER, background: PURPLE_DIM }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PURPLE }} />
            <span className="font-mono text-xs tracking-widest uppercase">Workforce Training</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-4">
            StagePro<sup className="text-2xl font-normal">™</sup>
          </h1>
          <p className="text-xl text-[oklch(0.60_0.010_240)] max-w-2xl mx-auto mb-8 leading-relaxed">
            The world's first hands-on robot technician training program.
            Learn by repairing real robots under master technician supervision.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <button
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-display font-bold text-sm transition-all duration-200"
                style={{ background: PURPLE, color: "oklch(0.97 0.005 240)", boxShadow: `0 0 24px ${PURPLE_GLOW}` }}
              >
                Enroll Now <ArrowRight size={15} />
              </button>
            </Link>
            <Link href="/order">
              <button
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-display font-semibold text-sm border transition-all duration-200"
                style={{ borderColor: PURPLE_BORDER, color: PURPLE, background: "transparent" }}
              >
                Request Corporate Quote
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section
        className="py-10 border-y"
        style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.09 0.008 240)" }}
      >
        <div className="container">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "4", label: "Program Levels" },
              { value: "All", label: "Robot Brands Covered" },
              { value: "Real", label: "Client Robots Used in Training" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="font-display font-bold text-3xl mb-1" style={{ color: PURPLE }}>{value}</div>
                <div className="text-xs text-[oklch(0.52_0.010_240)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why StagePro ── */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <div className="section-label mx-auto justify-center" style={{ color: PURPLE }}>
              <span className="w-6 h-px mr-2 inline-block" style={{ background: PURPLE }} />
              Why StagePro™
            </div>
            <h2 className="text-3xl font-display font-bold text-white">Training Unlike Anything Else</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DIFFERENTIATORS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-4 p-6 rounded-xl border transition-all duration-200 hover:border-[oklch(0.62_0.22_295/0.30)]"
                style={{ borderColor: "oklch(0.62 0.22 295 / 0.15)", background: "oklch(0.62 0.22 295 / 0.04)" }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}` }}
                >
                  <Icon size={18} style={{ color: PURPLE }} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm text-[oklch(0.58_0.010_240)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Programs ── */}
      <section
        className="py-20 border-y"
        style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.08 0.008 240)" }}
      >
        <div className="container">
          <div className="text-center mb-12">
            <div className="section-label mx-auto justify-center" style={{ color: PURPLE }}>
              <span className="w-6 h-px mr-2 inline-block" style={{ background: PURPLE }} />
              Programs
            </div>
            <h2 className="text-3xl font-display font-bold text-white mb-2">StagePro™ Training Programs</h2>
            <p className="text-[oklch(0.55_0.010_240)]">Four levels from introductory to master apprentice.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PROGRAMS.map((prog) => (
              <div
                key={prog.name}
                className="relative p-8 rounded-2xl border overflow-hidden"
                style={{
                  borderColor: prog.highlight ? "oklch(0.62 0.22 295 / 0.40)" : "oklch(0.20 0.010 240)",
                  background: prog.highlight
                    ? "linear-gradient(135deg, oklch(0.62 0.22 295 / 0.08) 0%, oklch(0.10 0.010 240) 100%)"
                    : "oklch(0.10 0.010 240)",
                }}
              >
                {prog.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.62_0.22_295/0.60)] to-transparent" />
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-white">{prog.name}</h3>
                    <div className="font-mono text-xs text-[oklch(0.45_0.008_240)] mt-0.5">{prog.duration}</div>
                  </div>
                  {prog.highlight && (
                    <span
                      className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border"
                      style={{ color: PURPLE, borderColor: PURPLE_BORDER, background: PURPLE_DIM }}
                    >
                      Most Popular
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-display font-bold" style={{ color: PURPLE }}>{prog.price}</span>
                  <span className="text-[oklch(0.50_0.010_240)] text-sm ml-1">{prog.unit}</span>
                </div>

                <p className="text-sm text-[oklch(0.58_0.010_240)] leading-relaxed mb-5">{prog.desc}</p>

                <ul className="space-y-2 mb-6">
                  {prog.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[oklch(0.60_0.010_240)]">
                      <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <button
                    className="w-full py-2.5 rounded-lg font-display font-bold text-sm transition-all duration-200"
                    style={prog.highlight
                      ? { background: PURPLE, color: "oklch(0.97 0.005 240)", boxShadow: `0 0 18px ${PURPLE_GLOW}` }
                      : { background: "transparent", border: `1px solid ${PURPLE_BORDER}`, color: PURPLE }
                    }
                  >
                    Enroll Now
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-3xl font-display font-bold text-white mb-4">
            Build the Next Generation<br />
            <span style={{ color: PURPLE }}>of Robot Technicians</span>
          </h2>
          <p className="text-[oklch(0.55_0.010_240)] mb-8 max-w-xl mx-auto">
            Register your company for free and enroll your team in StagePro™ training.
            Corporate cohort pricing available for groups of 5 or more.
          </p>
          <Link href="/register">
            <button
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-display font-bold text-base transition-all duration-200"
              style={{ background: PURPLE, color: "oklch(0.97 0.005 240)", boxShadow: `0 0 28px ${PURPLE_GLOW}` }}
            >
              Register Free Today <ArrowRight size={18} />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
