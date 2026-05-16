import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  GraduationCap, CheckCircle2, ArrowRight,
  Users, Award, BookOpen, Wrench
} from "lucide-react";

/* ── Palette ─────────────────────────────────────────────────────────── */
const BG     = "oklch(0.11 0.012 262)";
const CARD   = "oklch(0.14 0.014 262)";
const BORDER = "oklch(0.22 0.016 262)";
const PURPLE = "oklch(0.65 0.20 295)";
const TEXT_HI  = "oklch(0.93 0.005 240)";
const TEXT_MID = "oklch(0.70 0.008 240)";
const TEXT_DIM = "oklch(0.50 0.010 240)";

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

const WORKFLOW = [
  { step: "01", title: "Assess the learner", desc: "We capture role, current skill level, robot exposure, safety requirements, and target outcomes." },
  { step: "02", title: "Select the track", desc: "Choose workshop, certification, apprentice, or custom cohort based on the team's operating needs." },
  { step: "03", title: "Train hands-on", desc: "Students work through diagnostics, teardown, repair, calibration, and customer-ready handoff." },
  { step: "04", title: "Validate skills", desc: "Each learner is evaluated on repeatable tasks, documentation, safety, and troubleshooting discipline." },
  { step: "05", title: "Support after class", desc: "Graduates can connect into StageHand™ support workflows for ongoing field escalation." },
];

export default function StageProPage() {
  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT_HI }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Icon — stroke only */}
          <div
            className="w-12 h-12 rounded flex items-center justify-center mx-auto mb-6"
            style={{ border: `1px solid ${PURPLE}55`, background: `${PURPLE}0d` }}
          >
            <GraduationCap size={22} style={{ color: PURPLE }} />
          </div>

          {/* Eyebrow — stroke badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6"
            style={{ color: PURPLE, borderColor: `${PURPLE}55`, background: `${PURPLE}0d` }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PURPLE }} />
            <span className="font-mono text-[10px] tracking-widest uppercase">Workforce Training</span>
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold mb-4"
            style={{ color: TEXT_HI, letterSpacing: "-0.035em" }}
          >
            StagePro<sup className="text-xl font-normal align-super">™</sup>
          </h1>
          <p className="text-base max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: TEXT_MID }}>
            StagePro™ is the workforce training path for robot technicians, operators,
            and field teams. Students learn on real robots, document real fixes, and
            graduate into a repeatable support workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <span className="btn-primary" style={{ borderColor: `${PURPLE}55`, color: PURPLE, background: `${PURPLE}0d` }}>
                Enroll now <ArrowRight size={14} />
              </span>
            </Link>
            <Link href="/order">
              <span className="btn-default">Request corporate quote</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Definition ─────────────────────────────────────────────────────── */}
      <section className="py-16 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-10">
            <div>
              <p className="section-label mb-3" style={{ color: PURPLE }}>Definition</p>
              <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
                A practical school for robot support work.
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: TEXT_MID }}>
              <p>
                StagePro™ turns robot support into a trainable operating discipline:
                safety, diagnostics, repair workflow, parts handling, software checks,
                customer communication, and post-repair documentation.
              </p>
              <p>
                It is built for robot manufacturers, service companies, venue operators,
                logistics teams, and sales engineers who need confident technical fluency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "4",    label: "Program Levels" },
              { value: "All",  label: "Robot Brands Covered" },
              { value: "Real", label: "Client Robots Used in Training" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl font-bold tracking-tight mb-1" style={{ color: PURPLE, letterSpacing: "-0.03em" }}>
                  {value}
                </div>
                <div className="text-xs" style={{ color: TEXT_DIM }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Why StagePro ──────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2" style={{ color: PURPLE }}>Why StagePro™</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              Training Unlike Anything Else
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DIFFERENTIATORS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border p-5 flex gap-4 transition-colors"
                style={{ background: CARD, borderColor: BORDER }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${PURPLE}44`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
              >
                <div
                  className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                  style={{ border: `1px solid ${PURPLE}44`, background: `${PURPLE}0d` }}
                >
                  <Icon size={15} style={{ color: PURPLE }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: TEXT_HI }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: TEXT_DIM }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow ───────────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2" style={{ color: PURPLE }}>Workflow</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              Training that maps to field reality.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
            {WORKFLOW.map((item, index) => (
              <div
                key={item.step}
                className="p-5 border-t md:border-t-0"
                style={{ borderColor: BORDER, borderLeft: index === 0 ? "none" : `1px solid ${BORDER}` }}
              >
                <div className="font-mono text-2xl font-bold mb-4" style={{ color: `${PURPLE}66` }}>{item.step}</div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: TEXT_HI }}>{item.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: TEXT_DIM }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Programs ──────────────────────────────────────────────────────── */}
      <section className="py-20 border-b" style={{ borderColor: BORDER, background: CARD }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <p className="section-label mb-2" style={{ color: PURPLE }}>Programs</p>
            <h2 className="text-3xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              StagePro™ Training Programs
            </h2>
            <p className="mt-1 text-sm" style={{ color: TEXT_DIM }}>
              Four levels from introductory to master apprentice.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PROGRAMS.map((prog) => (
              <div
                key={prog.name}
                className="rounded-xl border p-6 flex flex-col gap-4"
                style={{ background: BG, borderColor: prog.highlight ? `${PURPLE}55` : BORDER }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold" style={{ color: TEXT_HI }}>{prog.name}</h3>
                    <div className="font-mono text-[11px] mt-0.5" style={{ color: TEXT_DIM }}>{prog.duration}</div>
                  </div>
                  {prog.highlight && (
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                      style={{ color: PURPLE, borderColor: `${PURPLE}44`, background: `${PURPLE}0d` }}
                    >
                      Most Popular
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-3xl font-bold tracking-tight" style={{ color: PURPLE, letterSpacing: "-0.03em" }}>
                    {prog.price}
                  </span>
                  <span className="text-sm ml-1" style={{ color: TEXT_DIM }}>{prog.unit}</span>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: TEXT_DIM }}>{prog.desc}</p>

                <ul className="space-y-1.5 flex-1">
                  {prog.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: TEXT_MID }}>
                      <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <span
                    className={`${prog.highlight ? "btn-primary" : "btn-default"} w-full justify-center`}
                    style={prog.highlight ? { borderColor: `${PURPLE}55`, color: PURPLE, background: `${PURPLE}0d` } : {}}
                  >
                    Enroll now
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="section-label mx-auto justify-center mb-4" style={{ color: PURPLE }}>Get Started</p>
          <h2 className="text-3xl font-bold mb-3" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
            Build the Next Generation of Robot Technicians
          </h2>
          <p className="mb-7 max-w-md mx-auto text-sm leading-relaxed" style={{ color: TEXT_DIM }}>
            Register your company for free and enroll your team in StagePro™ training.
            Corporate cohort pricing available for groups of 5 or more.
          </p>
          <Link href="/register">
            <span className="btn-primary" style={{ borderColor: `${PURPLE}55`, color: PURPLE, background: `${PURPLE}0d` }}>
              Register free today <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
