import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Building2, Bot, Calendar, CheckCircle, ArrowRight, ArrowLeft,
  Globe, Phone, Mail, Loader2, Zap, Package, Truck, Wrench
} from "lucide-react";

const ROBOT_TYPES = [
  "Humanoid", "Quadruped", "Wheeled AMR", "Industrial Arm", "Cobot",
  "Mobile Manipulator", "Drone", "Service Robot", "Surgical Robot", "Exoskeleton", "Other"
];

const SERVICES_NEEDED = [
  { id: "receiving", label: "Robot Receiving", icon: Package, desc: "Intake at port/warehouse" },
  { id: "unpacking", label: "Unpacking & Inspection", icon: Wrench, desc: "Safe unboxing & condition check" },
  { id: "staging", label: "Staging & Setup", icon: Zap, desc: "Pre-show configuration & testing" },
  { id: "activation", label: "Show Floor Activation", icon: Bot, desc: "On-site support during show" },
  { id: "delivery", label: "Booth Delivery", icon: Truck, desc: "Transport to booth on time" },
  { id: "storage", label: "Warehousing", icon: Building2, desc: "Secure pre/post-show storage" },
  { id: "customs", label: "Customs & Freight", icon: Globe, desc: "International shipping & clearance" },
  { id: "support", label: "Technical Support", icon: Wrench, desc: "On-call engineering support" },
];

const STEPS = [
  { id: 1, label: "Company", icon: Building2 },
  { id: 2, label: "Robot", icon: Bot },
  { id: 3, label: "Shows", icon: Calendar },
  { id: 4, label: "Services", icon: Zap },
];

interface RobotEntry {
  name: string;
  type: string;
  weight: string;
  dimensions: string;
  powerReq: string;
  notes: string;
}

interface ShowEntry {
  showName: string;
  boothNumber: string;
  year: string;
}

export default function Onboarding() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  // Step 1 — Company
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState(user?.name ?? "");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [contactPhone, setContactPhone] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // Step 2 — Robots
  const [robots, setRobots] = useState<RobotEntry[]>([
    { name: "", type: "", weight: "", dimensions: "", powerReq: "", notes: "" }
  ]);

  // Step 3 — Shows
  const [shows, setShows] = useState<ShowEntry[]>([
    { showName: "", boothNumber: "", year: new Date().getFullYear().toString() }
  ]);

  // Step 4 — Services
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const upsertProfile = trpc.company.upsertProfile.useMutation({
    onSuccess: () => navigate("/dashboard"),
  });

  const handleSubmit = () => {
    upsertProfile.mutate({
      companyName,
      website: website || undefined,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      country: country || undefined,
      description: description || undefined,
      linkedinUrl: linkedinUrl || undefined,
      robots: JSON.stringify(robots.filter(r => r.name)),
      showsAttending: JSON.stringify(shows.filter(s => s.showName)),
      servicesNeeded: JSON.stringify(selectedServices),
      onboardingComplete: true,
    });
  };

  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const updateRobot = (idx: number, field: keyof RobotEntry, value: string) => {
    setRobots(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const updateShow = (idx: number, field: keyof ShowEntry, value: string) => {
    setShows(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap size={16} className="text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">StageGate</span>
          </div>
          <span className="text-sm text-muted-foreground">Company Setup</span>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${step >= s.id ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                  ${step > s.id ? "bg-primary border-primary text-primary-foreground" :
                    step === s.id ? "border-primary text-primary" :
                    "border-border text-muted-foreground"}`}>
                  {step > s.id ? <CheckCircle size={14} /> : s.id}
                </div>
                <span className="text-sm font-medium hidden sm:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.id ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Company Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold mb-1">Tell us about your company</h1>
              <p className="text-muted-foreground text-sm">This helps us prepare the right logistics for your robots.</p>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Company Name *</label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Boston Dynamics" className="bg-card border-border/60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Website</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input value={website} onChange={e => setWebsite(e.target.value)}
                      placeholder="https://..." className="bg-card border-border/60 pl-8" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Country</label>
                  <Input value={country} onChange={e => setCountry(e.target.value)}
                    placeholder="e.g. United States" className="bg-card border-border/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Your Name</label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)}
                    placeholder="Full name" className="bg-card border-border/60" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Phone</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000" className="bg-card border-border/60 pl-8" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Contact Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-muted-foreground" />
                  <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                    placeholder="you@company.com" className="bg-card border-border/60 pl-8" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">About Your Company</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of your company and what your robots do..."
                  className="bg-card border-border/60 resize-none" rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">LinkedIn URL</label>
                <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/..." className="bg-card border-border/60" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Robots */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold mb-1">Tell us about your robot(s)</h1>
              <p className="text-muted-foreground text-sm">We need this to plan handling, staging, and logistics.</p>
            </div>
            {robots.map((robot, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Robot {idx + 1}</span>
                  {robots.length > 1 && (
                    <button onClick={() => setRobots(prev => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-destructive hover:underline">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Robot Name / Model</label>
                    <Input value={robot.name} onChange={e => updateRobot(idx, "name", e.target.value)}
                      placeholder="e.g. Spot, Atlas, AMR-200" className="bg-background border-border/60 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Robot Type</label>
                    <select value={robot.type} onChange={e => updateRobot(idx, "type", e.target.value)}
                      className="w-full h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground">
                      <option value="">Select type...</option>
                      {ROBOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Weight (lbs/kg)</label>
                    <Input value={robot.weight} onChange={e => updateRobot(idx, "weight", e.target.value)}
                      placeholder="e.g. 32 kg" className="bg-background border-border/60 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Dimensions (L×W×H)</label>
                    <Input value={robot.dimensions} onChange={e => updateRobot(idx, "dimensions", e.target.value)}
                      placeholder="e.g. 1.1m × 0.5m × 1.2m" className="bg-background border-border/60 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Power Requirements</label>
                    <Input value={robot.powerReq} onChange={e => updateRobot(idx, "powerReq", e.target.value)}
                      placeholder="e.g. 110V/20A, battery only, etc." className="bg-background border-border/60 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Special Handling Notes</label>
                    <Input value={robot.notes} onChange={e => updateRobot(idx, "notes", e.target.value)}
                      placeholder="Fragile sensors, keep upright, etc." className="bg-background border-border/60 text-sm" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRobots(prev => [...prev, { name: "", type: "", weight: "", dimensions: "", powerReq: "", notes: "" }])}
              className="w-full border-dashed">
              + Add Another Robot
            </Button>
          </div>
        )}

        {/* Step 3 — Shows */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold mb-1">Which shows are you attending?</h1>
              <p className="text-muted-foreground text-sm">We'll prepare logistics for each event in advance.</p>
            </div>
            {shows.map((show, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Show {idx + 1}</span>
                  {shows.length > 1 && (
                    <button onClick={() => setShows(prev => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-destructive hover:underline">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Show Name</label>
                    <Input value={show.showName} onChange={e => updateShow(idx, "showName", e.target.value)}
                      placeholder="e.g. CES 2026, MODEX 2026" className="bg-background border-border/60 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Year</label>
                    <Input value={show.year} onChange={e => updateShow(idx, "year", e.target.value)}
                      placeholder="2026" className="bg-background border-border/60 text-sm" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Booth Number (if known)</label>
                    <Input value={show.boothNumber} onChange={e => updateShow(idx, "boothNumber", e.target.value)}
                      placeholder="e.g. Booth #4521, Hall B" className="bg-background border-border/60 text-sm" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setShows(prev => [...prev, { showName: "", boothNumber: "", year: new Date().getFullYear().toString() }])}
              className="w-full border-dashed">
              + Add Another Show
            </Button>
          </div>
        )}

        {/* Step 4 — Services */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold mb-1">What services do you need?</h1>
              <p className="text-muted-foreground text-sm">Select all that apply — we'll tailor your quote accordingly.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SERVICES_NEEDED.map(svc => {
                const Icon = svc.icon;
                const selected = selectedServices.includes(svc.id);
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-card hover:border-primary/50 text-foreground"}`}>
                    <div className="flex items-start gap-3">
                      <Icon size={18} className={selected ? "text-primary mt-0.5" : "text-muted-foreground mt-0.5"} />
                      <div>
                        <div className="text-sm font-semibold">{svc.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{svc.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedServices.map(id => {
                  const svc = SERVICES_NEEDED.find(s => s.id === id);
                  return svc ? <Badge key={id} variant="secondary" className="bg-primary/10 text-primary border-primary/20">{svc.label}</Badge> : null;
                })}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pb-12">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
              <ArrowLeft size={16} /> Back
            </Button>
          ) : <div />}

          {step < 4 ? (
            <Button onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !companyName.trim()}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              Continue <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSubmit}
              disabled={upsertProfile.isPending}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {upsertProfile.isPending ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <>Complete Setup <CheckCircle size={16} /></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
