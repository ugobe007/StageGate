import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { BRAND, emeraldAlpha } from "@/lib/brand";
import {
  Building2, Bot, Calendar, CheckCircle, ArrowRight, ArrowLeft,
  Globe, Phone, Mail, Loader2, Zap, Package, Truck, Wrench,
} from "lucide-react";

const ROBOT_TYPES = [
  "Humanoid", "Quadruped", "Wheeled AMR", "Industrial Arm", "Cobot",
  "Mobile Manipulator", "Drone", "Service Robot", "Surgical Robot", "Exoskeleton", "Other",
];

const SERVICES_NEEDED = [
  { id: "receiving",  label: "Robot Receiving",        icon: Package,   desc: "Intake at port/warehouse" },
  { id: "unpacking",  label: "Unpacking & Inspection",  icon: Wrench,    desc: "Safe unboxing & condition check" },
  { id: "staging",    label: "Staging & Setup",         icon: Zap,       desc: "Pre-show configuration & testing" },
  { id: "activation", label: "Show Floor Activation",   icon: Bot,       desc: "On-site support during show" },
  { id: "delivery",   label: "Booth Delivery",          icon: Truck,     desc: "Transport to booth on time" },
  { id: "storage",    label: "Warehousing",             icon: Building2, desc: "Secure pre/post-show storage" },
  { id: "customs",    label: "Customs & Freight",       icon: Globe,     desc: "International shipping & clearance" },
  { id: "support",    label: "Technical Support",       icon: Wrench,    desc: "On-call engineering support" },
];

const STEPS = [
  { id: 1, label: "Company",  icon: Building2 },
  { id: 2, label: "Robot",    icon: Bot },
  { id: 3, label: "Shows",    icon: Calendar },
  { id: 4, label: "Services", icon: Zap },
];

interface RobotEntry {
  name: string; type: string; weight: string;
  dimensions: string; powerReq: string; notes: string;
}
interface ShowEntry {
  showName: string; boothNumber: string; year: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: "2.25rem", borderRadius: "0.375rem",
  border: "1px solid rgba(255,255,255,0.12)", background: "#111",
  padding: "0 0.75rem", fontSize: "0.875rem", color: "#ececec", outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem",
};

export default function Onboarding() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const [robots, setRobots] = useState<RobotEntry[]>([
    { name: "", type: "", weight: "", dimensions: "", powerReq: "", notes: "" },
  ]);

  const [shows, setShows] = useState<ShowEntry[]>([
    { showName: "", boothNumber: "", year: new Date().getFullYear().toString() },
  ]);

  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Load existing draft profile to pre-populate form (resumable wizard)
  const { data: existingProfile } = trpc.company.getMyProfile.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (hydrated || !existingProfile) return;
    setCompanyName(existingProfile.companyName ?? "");
    setWebsite(existingProfile.website ?? "");
    setContactName(existingProfile.contactName ?? user?.name ?? "");
    setContactEmail(existingProfile.contactEmail ?? user?.email ?? "");
    setContactPhone(existingProfile.contactPhone ?? "");
    setCountry(existingProfile.country ?? "");
    setDescription(existingProfile.description ?? "");
    setLinkedinUrl(existingProfile.linkedinUrl ?? "");
    if (existingProfile.robots) {
      try { const r = JSON.parse(existingProfile.robots); if (r.length) setRobots(r); } catch {}
    }
    if (existingProfile.showsAttending) {
      try { const s = JSON.parse(existingProfile.showsAttending); if (s.length) setShows(s); } catch {}
    }
    if (existingProfile.servicesNeeded) {
      try { const sv = JSON.parse(existingProfile.servicesNeeded); if (sv.length) setSelectedServices(sv); } catch {}
    }
    setHydrated(true);
  }, [existingProfile, hydrated, user]);

  // Also set contact info from user object if no profile yet
  useEffect(() => {
    if (!hydrated && !existingProfile && user) {
      setContactName(user.name ?? "");
      setContactEmail(user.email ?? "");
    }
  }, [user, hydrated, existingProfile]);

  const upsertProfile = trpc.company.upsertProfile.useMutation({
    onSuccess: () => navigate("/dashboard"),
  });

  // Save progress to server on each step advance (onboardingComplete stays false until final submit)
  const saveProgress = trpc.company.upsertProfile.useMutation();

  const handleNextStep = () => {
    saveProgress.mutate({
      companyName: companyName || "(draft)",
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
      onboardingComplete: false,
    });
    setStep(s => s + 1);
  };

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
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const updateRobot = (idx: number, field: keyof RobotEntry, value: string) => {
    setRobots(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const updateShow = (idx: number, field: keyof ShowEntry, value: string) => {
    setShows(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1C1E22" }}>
        <Loader2 size={28} style={{ color: `${BRAND.emerald}`, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!isAuthenticated) { navigate("/"); return null; }

  return (
    <div style={{ minHeight: "100vh", background: "#1C1E22" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,8,8,0.96)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "40rem", margin: "0 auto", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{ width: "1.875rem", height: "1.875rem", borderRadius: "0.375rem", background: `${BRAND.emerald}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={14} style={{ color: "#fff" }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.0625rem", color: "#ececec" }}>StageGate</span>
          </div>
          <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.30)" }}>Company Setup</span>
        </div>
      </div>

      <div style={{ maxWidth: "40rem", margin: "0 auto", padding: "2rem 1.5rem 4rem" }} className="dark-page-inputs">
        {/* Resume banner — shown when a draft profile was found */}
        {hydrated && existingProfile && !existingProfile.onboardingComplete && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.875rem", marginBottom: "1.5rem", borderRadius: "0.375rem", background: emeraldAlpha(0.06), border: `1px solid ${emeraldAlpha(0.18)}` }}>
            <CheckCircle size={14} style={{ color: `${BRAND.emerald}`, flexShrink: 0 }} />
            <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)" }}>
              <span style={{ color: `${BRAND.emerald}`, fontWeight: 600 }}>Resuming your setup</span> — your progress from last time has been loaded.
            </span>
          </div>
        )}
        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem" }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{
                  width: "1.875rem", height: "1.875rem", borderRadius: "9999px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.8125rem", fontWeight: 700,
                  border: `2px solid ${step > s.id ? `${BRAND.emerald}` : step === s.id ? `${BRAND.emerald}` : "rgba(255,255,255,0.08)"}`,
                  background: step > s.id ? `${BRAND.emerald}` : "transparent",
                  color: step > s.id ? "#fff" : step === s.id ? `${BRAND.emerald}` : "rgba(255,255,255,0.30)",
                  transition: "all 0.15s",
                }}>
                  {step > s.id ? <CheckCircle size={13} /> : s.id}
                </div>
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: step >= s.id ? "#ececec" : "rgba(255,255,255,0.30)", display: "none" }} className="sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: "2px", background: step > s.id ? `${BRAND.emerald}` : "rgba(255,255,255,0.08)", margin: "0 0.5rem", transition: "background 0.15s" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Company Info */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ececec", margin: "0 0 0.25rem" }}>Tell us about your company</h1>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.40)", margin: 0 }}>This helps us prepare the right logistics for your robots.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Company Name *</label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Boston Dynamics" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={labelStyle}>Website</label>
                  <div style={{ position: "relative" }}>
                    <Globe size={13} style={{ position: "absolute", left: "0.75rem", top: "0.625rem", color: "rgba(255,255,255,0.30)" }} />
                    <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className="pl-8" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. United States" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={labelStyle}>Your Name</label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={13} style={{ position: "absolute", left: "0.75rem", top: "0.625rem", color: "rgba(255,255,255,0.30)" }} />
                    <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="pl-8" />
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Contact Email</label>
                <div style={{ position: "relative" }}>
                  <Mail size={13} style={{ position: "absolute", left: "0.75rem", top: "0.625rem", color: "rgba(255,255,255,0.30)" }} />
                  <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="you@company.com" className="pl-8" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>About Your Company</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of your company and what your robots do..."
                  className="resize-none" rows={3} />
              </div>
              <div>
                <label style={labelStyle}>LinkedIn URL</label>
                <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/company/..." />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Robots */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ececec", margin: "0 0 0.25rem" }}>Tell us about your robot(s)</h1>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.40)", margin: 0 }}>We need this to plan handling, staging, and logistics.</p>
            </div>
            {robots.map((robot, idx) => (
              <div key={idx} style={{ padding: "1.125rem", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)", background: "#111", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "rgba(255,255,255,0.40)" }}>Robot {idx + 1}</span>
                  {robots.length > 1 && (
                    <button onClick={() => setRobots(prev => prev.filter((_, i) => i !== idx))}
                      style={{ fontSize: "0.8125rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Robot Name / Model</label>
                    <Input value={robot.name} onChange={e => updateRobot(idx, "name", e.target.value)} placeholder="e.g. Spot, Atlas, AMR-200" className="text-sm" />
                  </div>
                  <div>
                    <label style={labelStyle}>Robot Type</label>
                    <select value={robot.type} onChange={e => updateRobot(idx, "type", e.target.value)} style={inputStyle}>
                      <option value="">Select type...</option>
                      {ROBOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Weight (lbs/kg)</label>
                    <Input value={robot.weight} onChange={e => updateRobot(idx, "weight", e.target.value)} placeholder="e.g. 32 kg" className="text-sm" />
                  </div>
                  <div>
                    <label style={labelStyle}>Dimensions (L×W×H)</label>
                    <Input value={robot.dimensions} onChange={e => updateRobot(idx, "dimensions", e.target.value)} placeholder="e.g. 1.1m × 0.5m × 1.2m" className="text-sm" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Power Requirements</label>
                    <Input value={robot.powerReq} onChange={e => updateRobot(idx, "powerReq", e.target.value)} placeholder="e.g. 110V/20A, battery only, etc." className="text-sm" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Special Handling Notes</label>
                    <Input value={robot.notes} onChange={e => updateRobot(idx, "notes", e.target.value)} placeholder="Fragile sensors, keep upright, etc." className="text-sm" />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setRobots(prev => [...prev, { name: "", type: "", weight: "", dimensions: "", powerReq: "", notes: "" }])}
              style={{ width: "100%", padding: "0.625rem", fontSize: "0.875rem", fontWeight: 500, color: "rgba(255,255,255,0.40)", background: "#111", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "0.375rem", cursor: "pointer" }}
            >
              + Add Another Robot
            </button>
          </div>
        )}

        {/* Step 3 — Shows */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ececec", margin: "0 0 0.25rem" }}>Which shows are you attending?</h1>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.40)", margin: 0 }}>We'll prepare logistics for each event in advance.</p>
            </div>
            {shows.map((show, idx) => (
              <div key={idx} style={{ padding: "1.125rem", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)", background: "#111", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "rgba(255,255,255,0.40)" }}>Show {idx + 1}</span>
                  {shows.length > 1 && (
                    <button onClick={() => setShows(prev => prev.filter((_, i) => i !== idx))}
                      style={{ fontSize: "0.8125rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Show Name</label>
                    <Input value={show.showName} onChange={e => updateShow(idx, "showName", e.target.value)} placeholder="e.g. CES 2026, MODEX 2026" className="text-sm" />
                  </div>
                  <div>
                    <label style={labelStyle}>Year</label>
                    <Input value={show.year} onChange={e => updateShow(idx, "year", e.target.value)} placeholder="2026" className="text-sm" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Booth Number (if known)</label>
                    <Input value={show.boothNumber} onChange={e => updateShow(idx, "boothNumber", e.target.value)} placeholder="e.g. Booth #4521, Hall B" className="text-sm" />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setShows(prev => [...prev, { showName: "", boothNumber: "", year: new Date().getFullYear().toString() }])}
              style={{ width: "100%", padding: "0.625rem", fontSize: "0.875rem", fontWeight: 500, color: "rgba(255,255,255,0.40)", background: "#111", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "0.375rem", cursor: "pointer" }}
            >
              + Add Another Show
            </button>
          </div>
        )}

        {/* Step 4 — Services */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ececec", margin: "0 0 0.25rem" }}>What services do you need?</h1>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.40)", margin: 0 }}>Select all that apply — we'll tailor your quote accordingly.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {SERVICES_NEEDED.map(svc => {
                const Icon = svc.icon;
                const selected = selectedServices.includes(svc.id);
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                    style={{
                      padding: "1rem", borderRadius: "0.5rem", textAlign: "left", cursor: "pointer",
                      border: `1px solid ${selected ? `${BRAND.emerald}` : "rgba(255,255,255,0.08)"}`,
                      background: selected ? emeraldAlpha(0.06) : "#111",
                      transition: "all 0.1s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      <Icon size={16} style={{ color: selected ? `${BRAND.emerald}` : "rgba(255,255,255,0.30)", marginTop: "0.125rem", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: selected ? "#ececec" : "#ececec" }}>{svc.label}</div>
                        <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)", marginTop: "0.125rem" }}>{svc.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedServices.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {selectedServices.map(id => {
                  const svc = SERVICES_NEEDED.find(s => s.id === id);
                  return svc ? (
                    <span key={id} style={{ fontSize: "0.8125rem", color: `${BRAND.emerald}`, background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.2)", borderRadius: "0.25rem", padding: "0.125rem 0.5rem" }}>
                      {svc.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2rem" }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", fontWeight: 500, padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.08)", background: "#111", color: "rgba(255,255,255,0.55)", borderRadius: "0.375rem", cursor: "pointer" }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              onClick={handleNextStep}
              disabled={step === 1 && !companyName.trim()}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1.25rem", border: "none", background: `${BRAND.emerald}`, color: "#fff", borderRadius: "0.375rem", cursor: "pointer", opacity: (step === 1 && !companyName.trim()) ? 0.5 : 1 }}
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={upsertProfile.isPending}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1.25rem", border: "none", background: `${BRAND.emerald}`, color: "#fff", borderRadius: "0.375rem", cursor: "pointer", opacity: upsertProfile.isPending ? 0.7 : 1 }}
            >
              {upsertProfile.isPending ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <>Complete Setup <CheckCircle size={14} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
