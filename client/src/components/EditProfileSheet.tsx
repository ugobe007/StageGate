import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import {
  Building2, Bot, Calendar, Wrench, Plus, Trash2, Loader2, CheckCircle2, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Robot = {
  name: string;
  type: string;
  weight: string;
  dimensions: string;
  powerReq: string;
  notes: string;
};

type ShowEntry = {
  showName: string;
  boothNumber: string;
  year: string;
};

type Profile = {
  companyName: string;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  country?: string | null;
  description?: string | null;
  linkedinUrl?: string | null;
  robots?: string | null;
  showsAttending?: string | null;
  servicesNeeded?: string | null;
  onboardingComplete?: boolean | null;
};

const ROBOT_TYPES = [
  "Humanoid", "Quadruped", "Wheeled AMR", "Industrial Arm",
  "Cobot", "Mobile Manipulator", "Drone", "Service Robot",
  "Surgical Robot", "Exoskeleton", "Other"
];

const SERVICE_OPTIONS = [
  "Robot Receiving", "Unpacking & Inspection", "Staging & Setup",
  "Show Floor Activation", "Booth Delivery", "Warehousing",
  "Customs & Freight", "Technical Support", "Demo Coordination",
  "Media & Photography", "Crating & Return Shipping"
];

const TABS = [
  { id: "company",  label: "Company",  icon: Building2 },
  { id: "robots",   label: "Robots",   icon: Bot },
  { id: "shows",    label: "Shows",    icon: Calendar },
  { id: "services", label: "Services", icon: Wrench },
] as const;

type TabId = typeof TABS[number]["id"];

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EditProfileSheetProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

export default function EditProfileSheet({ open, onClose, profile }: EditProfileSheetProps) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<TabId>("company");
  const [saved, setSaved] = useState(false);

  // ── Company fields ──
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // ── Robots ──
  const [robots, setRobots] = useState<Robot[]>([]);

  // ── Shows ──
  const [shows, setShows] = useState<ShowEntry[]>([]);

  // ── Services ──
  const [services, setServices] = useState<string[]>([]);

  // Seed form from profile whenever sheet opens
  useEffect(() => {
    if (!open) return;
    setCompanyName(profile.companyName ?? "");
    setWebsite(profile.website ?? "");
    setContactName(profile.contactName ?? "");
    setContactEmail(profile.contactEmail ?? "");
    setContactPhone(profile.contactPhone ?? "");
    setCountry(profile.country ?? "");
    setDescription(profile.description ?? "");
    setLinkedinUrl(profile.linkedinUrl ?? "");
    setRobots(parseJsonArray<Robot>(profile.robots));
    setShows(parseJsonArray<ShowEntry>(profile.showsAttending));
    setServices(parseJsonArray<string>(profile.servicesNeeded));
    setSaved(false);
    setTab("company");
  }, [open, profile]);

  const upsert = trpc.company.upsertProfile.useMutation({
    onSuccess: () => {
      utils.company.getMyProfile.invalidate();
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    },
  });

  function handleSave() {
    upsert.mutate({
      companyName: companyName.trim() || profile.companyName,
      website: website || undefined,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      country: country || undefined,
      description: description || undefined,
      linkedinUrl: linkedinUrl || undefined,
      robots: robots.length > 0 ? JSON.stringify(robots) : undefined,
      showsAttending: shows.length > 0 ? JSON.stringify(shows) : undefined,
      servicesNeeded: services.length > 0 ? JSON.stringify(services) : undefined,
      onboardingComplete: true,
    });
  }

  // ── Robot helpers ──
  function addRobot() {
    setRobots(prev => [...prev, { name: "", type: "", weight: "", dimensions: "", powerReq: "", notes: "" }]);
  }
  function updateRobot(i: number, field: keyof Robot, value: string) {
    setRobots(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function removeRobot(i: number) {
    setRobots(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Show helpers ──
  function addShow() {
    setShows(prev => [...prev, { showName: "", boothNumber: "", year: new Date().getFullYear().toString() }]);
  }
  function updateShow(i: number, field: keyof ShowEntry, value: string) {
    setShows(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }
  function removeShow(i: number) {
    setShows(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Service toggle ──
  function toggleService(svc: string) {
    setServices(prev => prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]);
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0 bg-background border-border/60"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <SheetTitle className="text-lg font-display font-bold">Edit Profile</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Update your company and robot details. Changes are saved immediately.
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-border/40 px-6 gap-1 pt-2">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Company tab ── */}
          {tab === "company" && (
            <>
              <Field label="Company Name *">
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Robotics Inc." />
              </Field>
              <Field label="Website">
                <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://acmerobotics.com" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Name">
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" />
                </Field>
                <Field label="Country">
                  <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="USA" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@acme.com" type="email" />
                </Field>
                <Field label="Phone">
                  <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+1 702 555 0100" />
                </Field>
              </div>
              <Field label="LinkedIn URL">
                <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
              </Field>
              <Field label="Company Description">
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of your company and what your robots do…"
                  rows={3}
                  className="resize-none"
                />
              </Field>
            </>
          )}

          {/* ── Robots tab ── */}
          {tab === "robots" && (
            <>
              {robots.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Bot size={32} className="mx-auto mb-3 opacity-30" />
                  No robots added yet. Click below to add your first robot.
                </div>
              )}
              {robots.map((r, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Robot {i + 1}</span>
                    <button onClick={() => removeRobot(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Robot Name">
                      <Input value={r.name} onChange={e => updateRobot(i, "name", e.target.value)} placeholder="e.g. Atlas, Spot, H1" />
                    </Field>
                    <Field label="Type">
                      <select
                        value={r.type}
                        onChange={e => updateRobot(i, "type", e.target.value)}
                        className="w-full h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="">Select type…</option>
                        {ROBOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Weight">
                      <Input value={r.weight} onChange={e => updateRobot(i, "weight", e.target.value)} placeholder="e.g. 80 kg" />
                    </Field>
                    <Field label="Dimensions">
                      <Input value={r.dimensions} onChange={e => updateRobot(i, "dimensions", e.target.value)} placeholder="e.g. 1.8m tall" />
                    </Field>
                    <Field label="Power Req.">
                      <Input value={r.powerReq} onChange={e => updateRobot(i, "powerReq", e.target.value)} placeholder="e.g. 110V 20A" />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <Input value={r.notes} onChange={e => updateRobot(i, "notes", e.target.value)} placeholder="Special handling, fragile parts, etc." />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRobot} className="w-full gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/5">
                <Plus size={13} /> Add Robot
              </Button>
            </>
          )}

          {/* ── Shows tab ── */}
          {tab === "shows" && (
            <>
              {shows.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                  No shows added yet. Click below to add a show you're attending.
                </div>
              )}
              {shows.map((s, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Show {i + 1}</span>
                    <button onClick={() => removeShow(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Field label="Show Name">
                        <Input value={s.showName} onChange={e => updateShow(i, "showName", e.target.value)} placeholder="e.g. CES 2027, NAB 2026" />
                      </Field>
                    </div>
                    <Field label="Year">
                      <Input value={s.year} onChange={e => updateShow(i, "year", e.target.value)} placeholder="2026" />
                    </Field>
                  </div>
                  <Field label="Booth Number (optional)">
                    <Input value={s.boothNumber} onChange={e => updateShow(i, "boothNumber", e.target.value)} placeholder="e.g. Booth 4521, Hall A" />
                  </Field>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addShow} className="w-full gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/5">
                <Plus size={13} /> Add Show
              </Button>
            </>
          )}

          {/* ── Services tab ── */}
          {tab === "services" && (
            <>
              <p className="text-sm text-muted-foreground">Select all services you may need from StageGate:</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {SERVICE_OPTIONS.map(svc => {
                  const active = services.includes(svc);
                  return (
                    <button
                      key={svc}
                      onClick={() => toggleService(svc)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? "bg-primary/10 text-primary border-primary/40"
                          : "bg-transparent text-muted-foreground border-border/60 hover:border-primary/30"
                      }`}
                    >
                      {active && <CheckCircle2 size={10} />}
                      {svc}
                    </button>
                  );
                })}
              </div>
              {services.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-2">Selected ({services.length}):</div>
                  <div className="flex flex-wrap gap-1">
                    {services.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs gap-1">
                        {s}
                        <button onClick={() => toggleService(s)} className="hover:text-destructive ml-0.5">
                          <X size={9} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={upsert.isPending || saved}
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 min-w-[120px]"
          >
            {saved ? (
              <><CheckCircle2 size={13} /> Saved!</>
            ) : upsert.isPending ? (
              <><Loader2 size={13} className="animate-spin" /> Saving…</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
