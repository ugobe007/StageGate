import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import {
  Package, Warehouse, Zap, Wrench, Clock, GraduationCap, Monitor, TrendingUp,
  ArrowRight, CheckCircle, MapPin, Shield, Truck, Star
} from "lucide-react";
import { getLoginUrl } from "@/const";

const SERVICE_ICONS: Record<string, React.ComponentType<any>> = {
  "inbound-logistics": Truck,
  "warehousing-storage": Warehouse,
  "staging-activation": Zap,
  "live-technical-support": Wrench,
  "stagehand-247": Clock,
  "stagepro-training": GraduationCap,
  "showroom-demo": Monitor,
  "robot-sales-marketing": TrendingUp,
};

const SERVICE_COLORS: Record<string, string> = {
  "inbound-logistics": "text-blue-400",
  "warehousing-storage": "text-cyan-400",
  "staging-activation": "text-primary",
  "live-technical-support": "text-orange-400",
  "stagehand-247": "text-orange-400",
  "stagepro-training": "text-purple-400",
  "showroom-demo": "text-pink-400",
  "robot-sales-marketing": "text-yellow-400",
};

const PAIN_POINTS = [
  { stat: "$25K–$80K", label: "Cost per show to fly in engineers" },
  { stat: "72 hrs", label: "Average robot recovery time without local support" },
  { stat: "1 in 3", label: "Robots arrive at shows damaged or unprepared" },
  { stat: "0", label: "Dedicated robotics trade show infrastructure providers" },
];

const CITIES = [
  { name: "Las Vegas, NV", shows: "CES, Manifest, MINExpo", status: "Live" },
  { name: "Orlando, FL", shows: "IAAPA, InfoComm", status: "Coming 2026" },
  { name: "Chicago, IL", shows: "Automate, IMTS", status: "Coming 2026" },
  { name: "Houston, TX", shows: "OTC, World Petroleum", status: "Coming 2027" },
];

export default function Home() {
  const { data: services } = trpc.services.list.useQuery();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "linear-gradient(oklch(0.22 0.015 200 / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(0.22 0.015 200 / 0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }}
        />
        {/* Green glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10 blur-3xl"
          style={{ background: "oklch(0.72 0.18 155)" }}
        />

        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/30 font-medium px-4 py-1.5">
              The Infrastructure Layer for Robotics at Trade Shows
            </Badge>
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6">
              We Turn Shipped Robots<br />
              <span className="text-primary">Into Live Experiences</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              End-to-end logistics, warehousing, staging, activation, and technical support for robots at trade shows and conventions. Your engineers stay home. Your robot performs perfectly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8 text-base gap-2">
                  Register Your Company Free
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary font-semibold px-8 text-base">
                  Explore Services
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Free registration · No credit card required · Las Vegas-based
            </p>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 border-y border-border bg-card/30">
        <div className="container">
          <p className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-10">
            The Problem We Solve
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {PAIN_POINTS.map((p) => (
              <div key={p.label} className="text-center">
                <div className="text-3xl md:text-4xl font-display font-bold text-primary mb-2">{p.stat}</div>
                <div className="text-sm text-muted-foreground">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              Everything Your Robot Needs,<br />
              <span className="text-primary">From Crate to Stage</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Eight integrated service lines covering the complete trade show lifecycle — from the moment your robot ships until it's back in storage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(services || []).map((svc) => {
              const Icon = SERVICE_ICONS[svc.slug] || Package;
              const colorClass = SERVICE_COLORS[svc.slug] || "text-primary";
              return (
                <div key={svc.id} className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all duration-200 cursor-pointer">
                  <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={20} className={colorClass} />
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-2 text-sm leading-tight">
                    {svc.name}
                    {(svc.slug === "stagehand-247" || svc.slug === "stagepro-training") && (
                      <span className="text-xs align-super">™</span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{svc.description}</p>
                  {svc.basePrice && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="text-xs font-semibold text-primary">
                        From ${parseFloat(svc.basePrice).toLocaleString()} {svc.priceUnit}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link href="/services">
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 gap-2">
                View Full Service Details & Pricing
                <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-card/20 border-y border-border">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">How StageGate Works</h2>
            <p className="text-muted-foreground text-lg">Four steps from registration to a live robot on the show floor.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Register Free", desc: "Create your company profile and tell us about your robots. No commitment required." },
              { step: "02", title: "Select Your Show", desc: "Choose from upcoming trade shows in Las Vegas and beyond. We cover the major venues." },
              { step: "03", title: "Book Services", desc: "Select the service bundle that fits your needs — logistics, activation, support, or all three." },
              { step: "04", title: "Show Up & Demo", desc: "Your robot is unpacked, tested, and ready. You walk in and present. We handle the rest." },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="text-6xl font-display font-black text-primary/10 mb-4">{item.step}</div>
                <h3 className="font-display font-bold text-lg text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Pillars */}
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">Three Brands, One Platform</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* StageGate */}
            <div className="p-8 rounded-2xl border border-primary/30 bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/5 -translate-y-8 translate-x-8" />
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-5">
                <Zap size={24} className="text-primary" />
              </div>
              <h3 className="font-display font-bold text-xl text-foreground mb-3">StageGate</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                The core trade show infrastructure platform. Inbound logistics, warehousing, staging, activation, and live technical support for every show.
              </p>
              <Link href="/services">
                <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5">
                  Learn More <ArrowRight size={14} />
                </Button>
              </Link>
            </div>

            {/* StageHand */}
            <div className="p-8 rounded-2xl border border-orange-500/30 bg-orange-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-orange-500/5 -translate-y-8 translate-x-8" />
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-5">
                <Clock size={24} className="text-orange-400" />
              </div>
              <h3 className="font-display font-bold text-xl text-foreground mb-1">
                StageHand<sup className="text-sm">™</sup>
              </h3>
              <p className="text-xs text-orange-400 font-semibold mb-3 uppercase tracking-wider">24/7 Technical Support</p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Ongoing remote and on-site technical support for robots in the field. Monthly retainers, SLA contracts, and emergency response for deployed robots.
              </p>
              <Link href="/stagehand">
                <Button variant="outline" size="sm" className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-1.5">
                  Learn More <ArrowRight size={14} />
                </Button>
              </Link>
            </div>

            {/* StagePro */}
            <div className="p-8 rounded-2xl border border-purple-500/30 bg-purple-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/5 -translate-y-8 translate-x-8" />
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-5">
                <GraduationCap size={24} className="text-purple-400" />
              </div>
              <h3 className="font-display font-bold text-xl text-foreground mb-1">
                StagePro<sup className="text-sm">™</sup>
              </h3>
              <p className="text-xs text-purple-400 font-semibold mb-3 uppercase tracking-wider">Workforce Training</p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Hands-on robot technician training. Learn by repairing real client robots under master technician supervision. 1-day workshops to 6-week certifications.
              </p>
              <Link href="/stagepro">
                <Button variant="outline" size="sm" className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 gap-1.5">
                  Learn More <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="py-16 bg-card/20 border-y border-border">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-display font-bold mb-3">Expanding Across Convention Cities</h2>
            <p className="text-muted-foreground">Starting in Las Vegas, growing to every major trade show market.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CITIES.map((city) => (
              <div key={city.name} className="p-4 rounded-xl border border-border bg-card text-center">
                <MapPin size={16} className="text-primary mx-auto mb-2" />
                <div className="font-semibold text-sm text-foreground">{city.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{city.shows}</div>
                <Badge
                  className={`mt-2 text-xs ${city.status === "Live" ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border"}`}
                >
                  {city.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl border border-primary/30 bg-primary/5 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: "linear-gradient(oklch(0.22 0.015 200 / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(0.22 0.015 200 / 0.5) 1px, transparent 1px)",
                backgroundSize: "40px 40px"
              }}
            />
            <div className="relative z-10">
              <h2 className="text-4xl font-display font-bold mb-4">
                Ready to Bring Your Robot<br />
                <span className="text-primary">to the Show Floor?</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Register your company for free. No credit card, no commitment. Just your robot and our infrastructure.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-10 text-base gap-2">
                    Register Free Today
                    <ArrowRight size={18} />
                  </Button>
                </Link>
                <Link href="/services">
                  <Button size="lg" variant="outline" className="border-border font-semibold px-8 text-base">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xs">SG</span>
                </div>
                <span className="font-display font-bold text-foreground">StageGate</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The infrastructure layer for robotics at trade shows. Las Vegas, NV.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground mb-3">Services</p>
              <div className="space-y-2">
                <Link href="/services" className="block text-xs text-muted-foreground hover:text-primary">All Services</Link>
                <Link href="/stagehand" className="block text-xs text-muted-foreground hover:text-primary">StageHand&#8482;</Link>
                <Link href="/stagepro" className="block text-xs text-muted-foreground hover:text-primary">StagePro&#8482;</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground mb-3">Company</p>
              <div className="space-y-2">
                <Link href="/register" className="block text-xs text-muted-foreground hover:text-primary">Register Free</Link>
                <Link href="/dashboard" className="block text-xs text-muted-foreground hover:text-primary">Client Portal</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground mb-3">Contact</p>
              <p className="text-xs text-muted-foreground">Las Vegas, NV 89101</p>
              <p className="text-xs text-muted-foreground mt-1">info@stagegate.com</p>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">
              © 2026 StageGate. StageHand&#8482; and StagePro&#8482; are trademarks of StageGate.
            </p>
            <p className="text-xs text-muted-foreground">
              The Robot Guild™ — Marketing & Brand Activation Division
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
