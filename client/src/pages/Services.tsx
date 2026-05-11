import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Package, Warehouse, Zap, Wrench, Clock, GraduationCap, Monitor, TrendingUp, ArrowRight, CheckCircle } from "lucide-react";

const SERVICE_ICONS: Record<string, React.ComponentType<any>> = {
  "inbound-logistics": Package,
  "warehousing-storage": Warehouse,
  "staging-activation": Zap,
  "live-technical-support": Wrench,
  "stagehand-247": Clock,
  "stagepro-training": GraduationCap,
  "showroom-demo": Monitor,
  "robot-sales-marketing": TrendingUp,
};

const SERVICE_COLORS: Record<string, { icon: string; border: string; bg: string; badge: string }> = {
  "inbound-logistics": { icon: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/5", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "warehousing-storage": { icon: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-500/5", badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  "staging-activation": { icon: "text-primary", border: "border-primary/30", bg: "bg-primary/5", badge: "bg-primary/20 text-primary border-primary/30" },
  "live-technical-support": { icon: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/5", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "stagehand-247": { icon: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/5", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "stagepro-training": { icon: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/5", badge: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  "showroom-demo": { icon: "text-pink-400", border: "border-pink-500/30", bg: "bg-pink-500/5", badge: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  "robot-sales-marketing": { icon: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/5", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
};

const PHASE1_FEATURES: Record<string, string[]> = {
  "inbound-logistics": ["Airport pickup from Harry Reid International", "ATA Carnet & customs coordination", "Climate-controlled receiving", "Full arrival inspection & documentation", "Concierge white-glove service available"],
  "warehousing-storage": ["Secure, climate-controlled facility", "Pre-show and post-show storage", "Year-round storage available", "Inventory management system", "Insurance-ready documentation"],
  "staging-activation": ["Unpacking & crate management", "Bench testing & diagnostics", "Firmware updates & calibration", "Booth delivery & assembly", "Full pre-show readiness check"],
  "live-technical-support": ["On-call technician on the show floor", "Daily startup & shutdown cycles", "Real-time troubleshooting", "Rapid repair during live demos", "Multi-day packages available"],
  "stagehand-247": ["Remote monitoring & diagnostics", "On-site emergency dispatch", "Monthly SLA contracts", "Multi-robot fleet support", "Post-sales deployment support"],
  "stagepro-training": ["Learn by repairing real client robots", "Master technician supervision", "All robot brands & types covered", "1-day to 6-week programs", "Corporate cohort pricing available"],
  "showroom-demo": ["Permanent Las Vegas showroom space", "Year-round demo availability", "Investor & media visit support", "Staffed demo presentations", "Annual lease discounts"],
  "robot-sales-marketing": ["US market distribution partnerships", "The Robot Guild™ brand activation", "StageGate Ready™ certification", "Trade show booth marketing", "Commission-based sales model"],
};

export default function Services() {
  const { data: services, isLoading } = trpc.services.list.useQuery();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container">
          {/* Header */}
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Complete Service Catalog</Badge>
            <h1 className="text-5xl font-display font-bold mb-4">
              Eight Services.<br />
              <span className="text-primary">One Platform.</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From the moment your robot ships to the moment it's back in storage, StageGate covers every step of the trade show lifecycle.
            </p>
          </div>

          {/* Phase 1 Services */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <Badge className="bg-primary/20 text-primary border-primary/30 font-semibold">Phase 1 — Available Now</Badge>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(services || []).filter(s => s.phase === "phase1").map((svc) => {
                const Icon = SERVICE_ICONS[svc.slug] || Package;
                const colors = SERVICE_COLORS[svc.slug] || SERVICE_COLORS["inbound-logistics"];
                const features = PHASE1_FEATURES[svc.slug] || [];
                const tiers = svc.pricingTiers ? JSON.parse(svc.pricingTiers) : [];
                return (
                  <div key={svc.id} className={`p-8 rounded-2xl border ${colors.border} ${colors.bg} relative overflow-hidden`}>
                    <div className="flex items-start justify-between mb-6">
                      <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center`}>
                        <Icon size={24} className={colors.icon} />
                      </div>
                      <Badge className={colors.badge}>Phase 1</Badge>
                    </div>
                    <h3 className="font-display font-bold text-xl text-foreground mb-2">
                      {svc.name}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">{svc.description}</p>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle size={14} className={`${colors.icon} mt-0.5 shrink-0`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Pricing */}
                    {tiers.length > 0 && (
                      <div className="border-t border-border/50 pt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing</p>
                        <div className="flex flex-wrap gap-3">
                          {tiers.map((tier: any) => (
                            <div key={tier.label} className="text-center">
                              <div className={`text-lg font-bold ${colors.icon}`}>
                                {tier.price ? `$${tier.price.toLocaleString()}` : "Custom"}
                              </div>
                              <div className="text-xs text-muted-foreground">{tier.label}</div>
                              <div className="text-xs text-muted-foreground/70">{tier.unit}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phase 2 Services */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <Badge className="bg-secondary text-muted-foreground border-border font-semibold">Phase 2 — Launching 2026</Badge>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(services || []).filter(s => s.phase === "phase2").map((svc) => {
                const Icon = SERVICE_ICONS[svc.slug] || Package;
                const colors = SERVICE_COLORS[svc.slug] || SERVICE_COLORS["inbound-logistics"];
                const features = PHASE1_FEATURES[svc.slug] || [];
                const tiers = svc.pricingTiers ? JSON.parse(svc.pricingTiers) : [];
                const isTrademark = svc.slug === "stagehand-247" || svc.slug === "stagepro-training";
                return (
                  <div key={svc.id} className={`p-8 rounded-2xl border ${colors.border} ${colors.bg} relative overflow-hidden opacity-90`}>
                    <div className="flex items-start justify-between mb-6">
                      <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center`}>
                        <Icon size={24} className={colors.icon} />
                      </div>
                      <Badge className="bg-secondary text-muted-foreground border-border">Coming 2026</Badge>
                    </div>
                    <h3 className="font-display font-bold text-xl text-foreground mb-2">
                      {svc.name}
                      {isTrademark && <sup className="text-sm">™</sup>}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">{svc.description}</p>
                    <ul className="space-y-2 mb-6">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle size={14} className={`${colors.icon} mt-0.5 shrink-0`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {tiers.length > 0 && (
                      <div className="border-t border-border/50 pt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing</p>
                        <div className="flex flex-wrap gap-3">
                          {tiers.map((tier: any) => (
                            <div key={tier.label} className="text-center">
                              <div className={`text-lg font-bold ${colors.icon}`}>
                                {tier.price ? `$${tier.price.toLocaleString()}` : "Custom"}
                              </div>
                              <div className="text-xs text-muted-foreground">{tier.label}</div>
                              <div className="text-xs text-muted-foreground/70">{tier.unit}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center p-12 rounded-2xl border border-primary/30 bg-primary/5">
            <h2 className="text-3xl font-display font-bold mb-4">Ready to Book Services?</h2>
            <p className="text-muted-foreground mb-6">Register your company for free, then select your show and services.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2">
                  Register Free <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/order">
                <Button size="lg" variant="outline" className="border-border font-semibold">
                  Book Services Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
