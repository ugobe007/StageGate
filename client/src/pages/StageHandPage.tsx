import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { Clock, Shield, Zap, Phone, CheckCircle, ArrowRight, Wrench, AlertCircle, Activity } from "lucide-react";

const TIERS = [
  {
    name: "Standard Retainer",
    price: "$1,200",
    unit: "/month",
    features: [
      "Remote diagnostics & monitoring",
      "48-hour response SLA",
      "Up to 2 robots",
      "Monthly health reports",
      "Email & chat support",
    ],
    highlight: false,
  },
  {
    name: "Enterprise SLA",
    price: "$2,500",
    unit: "/month",
    features: [
      "24/7 remote & on-site support",
      "4-hour emergency response SLA",
      "Unlimited robots",
      "Dedicated technician",
      "Priority parts sourcing",
      "Quarterly on-site inspections",
    ],
    highlight: true,
  },
];

const USE_CASES = [
  { icon: AlertCircle, title: "Emergency Repair", desc: "Robot breaks down mid-demo at a trade show. StageHand™ dispatches a technician within hours." },
  { icon: Activity, title: "Deployment Monitoring", desc: "Robots deployed in hotels, airports, or retail locations monitored 24/7 with proactive alerts." },
  { icon: Wrench, title: "Scheduled Maintenance", desc: "Quarterly on-site inspections, firmware updates, and preventive maintenance to avoid failures." },
  { icon: Phone, title: "Remote Diagnostics", desc: "Most issues resolved remotely in under 30 minutes via secure connection to your robot's systems." },
];

export default function StageHandPage() {
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
            style={{ background: "oklch(0.72 0.18 55)" }}
          />
          <div className="container relative z-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
              <Clock size={32} className="text-orange-400" />
            </div>
            <Badge className="mb-4 bg-orange-500/20 text-orange-400 border-orange-500/30 font-semibold">
              24/7 Technical Support
            </Badge>
            <h1 className="text-5xl md:text-6xl font-display font-bold mb-4">
              StageHand<sup className="text-2xl">™</sup>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Ongoing remote and on-site technical support for robots in the field. When your robot needs help, we're already there.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="bg-orange-500 text-white hover:bg-orange-600 font-bold gap-2">
                  Get Started Free <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/order">
                <Button size="lg" variant="outline" className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 font-semibold">
                  Book Support Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 border-y border-border bg-card/30">
          <div className="container">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-display font-bold text-orange-400 mb-1">24/7</div>
                <div className="text-sm text-muted-foreground">Always Available</div>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-orange-400 mb-1">&lt;4hr</div>
                <div className="text-sm text-muted-foreground">Emergency Response</div>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-orange-400 mb-1">All</div>
                <div className="text-sm text-muted-foreground">Robot Brands Supported</div>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-20">
          <div className="container">
            <h2 className="text-3xl font-display font-bold text-center mb-12">When You Need StageHand&#8482;</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {USE_CASES.map((uc) => (
                <div key={uc.title} className="p-6 rounded-xl border border-orange-500/20 bg-orange-500/5 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <uc.icon size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{uc.title}</h3>
                    <p className="text-sm text-muted-foreground">{uc.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 bg-card/20 border-y border-border">
          <div className="container">
            <h2 className="text-3xl font-display font-bold text-center mb-4">StageHand&#8482; Plans</h2>
            <p className="text-muted-foreground text-center mb-12">Monthly retainers with flexible SLA options.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {TIERS.map((tier) => (
                <div key={tier.name} className={`p-8 rounded-2xl border ${tier.highlight ? "border-orange-500/50 bg-orange-500/10" : "border-border bg-card"}`}>
                  {tier.highlight && (
                    <Badge className="mb-4 bg-orange-500/20 text-orange-400 border-orange-500/30">Most Popular</Badge>
                  )}
                  <h3 className="font-display font-bold text-xl text-foreground mb-2">{tier.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-display font-bold text-orange-400">{tier.price}</span>
                    <span className="text-muted-foreground text-sm">{tier.unit}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle size={14} className="text-orange-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button className={`w-full font-semibold ${tier.highlight ? "bg-orange-500 text-white hover:bg-orange-600" : "border-orange-500/40 text-orange-400 hover:bg-orange-500/10"}`} variant={tier.highlight ? "default" : "outline"}>
                      Get Started Free
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container text-center">
            <h2 className="text-3xl font-display font-bold mb-4">
              Your Robot Deserves<br />
              <span className="text-orange-400">Always-On Support</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Register your company for free and add StageHand&#8482; to your service plan. No commitment until you're ready.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-orange-500 text-white hover:bg-orange-600 font-bold gap-2">
                Register Free Today <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
