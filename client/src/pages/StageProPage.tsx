import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  GraduationCap, CheckCircle2, ArrowRight,
  Users, Award, BookOpen, Wrench
} from "lucide-react";

const PURPLE = "oklch(0.62 0.22 295)";
const PURPLE_MUTED = "oklch(0.62 0.22 295 / 0.12)";
const PURPLE_BORDER = "oklch(0.62 0.22 295 / 0.22)";

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
    <div className="min-h-screen bg-[oklch(0.08_0.006_240)] text-[oklch(0.97_0.002_240)]">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 relative overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.20 0.008 240 / 0.35) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.20 0.008 240 / 0.35) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 70% 50% at 50% 0%, black 30%, transparent 100%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          {/* Icon badge */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: PURPLE_MUTED, border: `1px solid ${PURPLE_BORDER}` }}
          >
            <GraduationCap size={26} style={{ color: PURPLE }} />
          </div>

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6"
            style={{ color: PURPLE, borderColor: PURPLE_BORDER, background: PURPLE_MUTED }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PURPLE }} />
            <span className="font-mono text-[11px] tracking-widest uppercase">Workforce Training</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white mb-4">
            StagePro<sup className="text-xl font-normal align-super">™</sup>
          </h1>
          <p className="text-lg text-[oklch(0.55_0.008_240)] max-w-2xl mx-auto mb-8 leading-relaxed">
            The world's first hands-on robot technician training program.
            Learn by repairing real robots under master technician supervision.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <span className="btn-primary">Enroll Now <ArrowRight size={14} /></span>
            </Link>
            <Link href="/order">
              <span className="btn-default">Request Corporate Quote</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      <div className="border-y border-[oklch(0.16_0.008_240)] bg-[oklch(0.09_0.006_240)]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "4",    label: "Program Levels" },
              { value: "All",  label: "Robot Brands Covered" },
              { value: "Real", label: "Client Robots Used in Training" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl font-bold tracking-tight mb-1" style={{ color: PURPLE }}>{value}</div>
                <div className="text-xs text-[oklch(0.50_0.008_240)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Why StagePro ──────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label" style={{ color: PURPLE }}>Why StagePro™</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">Training Unlike Anything Else</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DIFFERENTIATORS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="sg-card flex gap-4"
                style={{ borderColor: PURPLE_BORDER }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: PURPLE_MUTED, border: `1px solid ${PURPLE_BORDER}` }}
                >
                  <Icon size={16} style={{ color: PURPLE }} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                  <p className="text-xs text-[oklch(0.52_0.008_240)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Programs ──────────────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-[oklch(0.16_0.008_240)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <div className="section-label" style={{ color: PURPLE }}>Programs</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">StagePro™ Training Programs</h2>
            <p className="text-[oklch(0.52_0.008_240)] mt-1 text-sm">Four levels from introductory to master apprentice.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PROGRAMS.map((prog) => (
              <div
                key={prog.name}
                className="sg-card flex flex-col"
                style={{
                  borderColor: prog.highlight ? PURPLE_BORDER : "oklch(0.18 0.008 240)",
                  borderTopColor: prog.highlight ? PURPLE : "oklch(0.18 0.008 240)",
                  borderTopWidth: prog.highlight ? "2px" : "1px",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{prog.name}</h3>
                    <div className="font-mono text-[11px] text-[oklch(0.45_0.008_240)] mt-0.5">{prog.duration}</div>
                  </div>
                  {prog.highlight && (
                    <span
                      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border"
                      style={{ color: PURPLE, borderColor: PURPLE_BORDER, background: PURPLE_MUTED }}
                    >
                      Most Popular
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <span className="text-3xl font-bold tracking-tight" style={{ color: PURPLE }}>{prog.price}</span>
                  <span className="text-[oklch(0.45_0.008_240)] text-sm ml-1">{prog.unit}</span>
                </div>

                <p className="text-xs text-[oklch(0.55_0.008_240)] leading-relaxed mb-4">{prog.desc}</p>

                <ul className="space-y-2 mb-5 flex-1">
                  {prog.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[oklch(0.58_0.008_240)]">
                      <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <span className={prog.highlight ? "btn-primary w-full justify-center" : "btn-default w-full justify-center"}>
                    Enroll Now
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="sg-card text-center py-14 px-8">
            <div className="section-label mx-auto justify-center mb-4" style={{ color: PURPLE }}>Get Started</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white mb-3">
              Build the Next Generation of Robot Technicians
            </h2>
            <p className="text-[oklch(0.52_0.008_240)] mb-7 max-w-md mx-auto text-sm leading-relaxed">
              Register your company for free and enroll your team in StagePro™ training.
              Corporate cohort pricing available for groups of 5 or more.
            </p>
            <Link href="/register">
              <span className="btn-primary">
                Register Free Today <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
