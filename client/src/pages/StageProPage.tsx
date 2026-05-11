import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { GraduationCap, CheckCircle, ArrowRight, Users, Award, BookOpen, Wrench } from "lucide-react";

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
  { icon: Wrench, title: "Learn on Real Robots", desc: "Students repair actual client robots — not simulations. Every repair is real, every lesson sticks." },
  { icon: Award, title: "Master Technician Instructors", desc: "All instructors are active StageGate technicians with multi-brand expertise and field experience." },
  { icon: Users, title: "All Brands Covered", desc: "Humanoid, industrial, collaborative, delivery — we train on every major robot brand and type." },
  { icon: BookOpen, title: "Curriculum That Evolves", desc: "As new robots enter the market, our curriculum updates. Your certification stays current." },
];

export default function StageProPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        {/* Hero */}
        <section className="py-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "linear-gradient(oklch(0.22 0.015 200 / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(0.22 0.015 200 / 0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px"
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full opacity-10 blur-3xl"
            style={{ background: "oklch(0.65 0.18 290)" }}
          />
          <div className="container relative z-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <GraduationCap size={32} className="text-purple-400" />
            </div>
            <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30 font-semibold">
              Workforce Training
            </Badge>
            <h1 className="text-5xl md:text-6xl font-display font-bold mb-4">
              StagePro<sup className="text-2xl">™</sup>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              The world's first hands-on robot technician training program. Learn by repairing real robots under master technician supervision.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="bg-purple-600 text-white hover:bg-purple-700 font-bold gap-2">
                  Register Free <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/order">
                <Button size="lg" variant="outline" className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 font-semibold">
                  Enroll Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Differentiators */}
        <section className="py-16 border-y border-border bg-card/20">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {DIFFERENTIATORS.map((d) => (
                <div key={d.title} className="text-center p-6">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <d.icon size={22} className="text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{d.title}</h3>
                  <p className="text-sm text-muted-foreground">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Programs */}
        <section className="py-20">
          <div className="container">
            <h2 className="text-3xl font-display font-bold text-center mb-4">Training Programs</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
              From a one-day introduction to a six-week apprenticeship — there's a StagePro&#8482; program for every level.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PROGRAMS.map((prog) => (
                <div key={prog.name} className={`p-8 rounded-2xl border ${prog.highlight ? "border-purple-500/50 bg-purple-500/10" : "border-border bg-card"}`}>
                  {prog.highlight && (
                    <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30">Most Popular</Badge>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-display font-bold text-xl text-foreground">{prog.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{prog.duration}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-display font-bold text-purple-400">{prog.price}</div>
                      <div className="text-xs text-muted-foreground">{prog.unit}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">{prog.desc}</p>
                  <ul className="space-y-2 mb-6">
                    {prog.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle size={14} className="text-purple-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button className={`w-full font-semibold ${prog.highlight ? "bg-purple-600 text-white hover:bg-purple-700" : "border-purple-500/40 text-purple-400 hover:bg-purple-500/10"}`} variant={prog.highlight ? "default" : "outline"}>
                      Enroll Free
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-card/20 border-t border-border">
          <div className="container text-center">
            <h2 className="text-3xl font-display font-bold mb-4">
              Train the Next Generation<br />
              <span className="text-purple-400">of Robot Technicians</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Register your company for free and enroll your team in StagePro&#8482; training. Build the in-house expertise your robotics business needs.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-purple-600 text-white hover:bg-purple-700 font-bold gap-2">
                Register Free Today <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
