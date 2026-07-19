import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Bot,
  Calendar,
  Wrench,
  User,
} from "lucide-react";

// ── Service lines with descriptions ─────────────────────────────────────────
const SERVICE_LINES = [
  { id: 1, name: "Inbound Logistics", desc: "Airport/customs pickup, transport to warehouse", category: "logistics" },
  { id: 2, name: "Warehousing", desc: "Secure climate-controlled storage for crates & robots", category: "logistics" },
  { id: 3, name: "Staging & Activation", desc: "Unpack, assemble, and prepare robot for show floor", category: "activation" },
  { id: 4, name: "Live Technical Support", desc: "Sam coordinates on-site technicians during show hours", category: "support" },
  { id: 5, name: "StageHand\u2122 24/7", desc: "Sam-led round-the-clock emergency technical support", category: "support" },
  { id: 6, name: "StagePro\u2122 Training", desc: "Certified operator training for your booth staff", category: "training" },
  { id: 7, name: "Showroom & Demo", desc: "Managed demo floor presence and visitor engagement", category: "showroom" },
  { id: 8, name: "Robot Sales & Marketing", desc: "Brand promotion and lead generation at the show", category: "marketing" },
];

const CATEGORY_COLORS: Record<string, string> = {
  logistics: "oklch(0.55 0.18 240)",
  activation: "oklch(0.55 0.18 145)",
  support:    "oklch(0.65 0.18 60)",
  training:   "oklch(0.55 0.18 290)",
  showroom:   "oklch(0.55 0.18 30)",
  marketing:  "oklch(0.55 0.18 0)",
};

const ROBOT_TYPES = [
  "Humanoid / Bipedal",
  "Industrial Arm / Manipulator",
  "Mobile Ground Robot (AMR/AGV)",
  "Collaborative Robot (Cobot)",
  "Drone / Aerial Robot",
  "Quadruped / Legged Robot",
  "Service Robot",
  "Surgical / Medical Robot",
  "Other",
];

const STEPS = [
  { id: 1, label: "Robot", icon: Bot },
  { id: 2, label: "Show",  icon: Calendar },
  { id: 3, label: "Services", icon: Wrench },
  { id: 4, label: "Contact", icon: User },
];

type FormData = {
  // Step 1
  robotType: string;
  robotTypeOther: string;
  robotCount: number;
  robotDimensions: string;
  robotWeight: string;
  // Step 2
  showId: number | undefined;
  showName: string;
  // Step 3
  serviceIds: number[];
  // Step 4
  name: string;
  email: string;
  company: string;
  phone: string;
  notes: string;
};

const EMPTY: FormData = {
  robotType: "",
  robotTypeOther: "",
  robotCount: 1,
  robotDimensions: "",
  robotWeight: "",
  showId: undefined,
  showName: "",
  serviceIds: [],
  name: "",
  email: "",
  company: "",
  phone: "",
  notes: "",
};

type Props = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  preselectedShowId?: number;
};

export default function GetQuoteModal({ open, onOpenChange, onClose, preselectedShowId }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(() => ({
    ...EMPTY,
    showId: preselectedShowId,
  }));
  const [submitted, setSubmitted] = useState(false);

  const { data: shows } = trpc.shows.list.useQuery();
  const submitMutation = trpc.quotes.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => toast.error(e.message || "Failed to submit quote request"),
  });

  const upcomingShows = (shows || []).filter((s) => s.status === "upcoming" || s.status === "active");

  function reset() {
    setStep(1);
    setForm({ ...EMPTY, showId: preselectedShowId });
    setSubmitted(false);
  }

  function handleClose(v: boolean) {
    if (!v) {
      reset();
      onClose?.();
    }
    onOpenChange?.(v);
  }

  function toggleService(id: number) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((s) => s !== id)
        : [...f.serviceIds, id],
    }));
  }

  function canAdvance() {
    if (step === 1) return form.robotType !== "" && (form.robotType !== "Other" || form.robotTypeOther.trim() !== "");
    if (step === 2) return true; // show is optional
    if (step === 3) return form.serviceIds.length > 0;
    if (step === 4) return form.name.trim() !== "" && form.email.trim() !== "" && form.company.trim() !== "";
    return false;
  }

  function handleSubmit() {
    const robotType = form.robotType === "Other" ? form.robotTypeOther : form.robotType;
    const selectedShow = upcomingShows.find((s) => s.id === form.showId);
    submitMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim(),
      phone: form.phone.trim() || undefined,
      robotType,
      robotCount: form.robotCount,
      robotDimensions: form.robotDimensions.trim() || undefined,
      robotWeight: form.robotWeight.trim() || undefined,
      showId: form.showId,
      showName: selectedShow?.name || form.showName.trim() || undefined,
      serviceIds: form.serviceIds,
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-display text-xl font-bold text-foreground">
            {submitted ? "Request Received" : "Get a Quote"}
          </DialogTitle>
          {!submitted && (
            <p className="text-sm text-muted-foreground mt-1">
              Tell us about your robot and show — we'll send a custom proposal within 24 hours.
            </p>
          )}
        </DialogHeader>

        {submitted ? (
          /* ── Success screen ── */
          <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "oklch(0.55 0.18 145 / 0.12)" }}>
              <CheckCircle2 size={28} style={{ color: "oklch(0.55 0.18 145)" }} />
            </div>
            <div>
              <p className="font-display font-bold text-foreground text-lg">You're all set, {form.name.split(" ")[0]}!</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                We've received your quote request for <strong>{form.robotType === "Other" ? form.robotTypeOther : form.robotType}</strong>. Our team will follow up at <strong>{form.email}</strong> within 24 hours.
              </p>
            </div>
            <Button
              className="mt-2 btn-primary"
              onClick={() => handleClose(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* ── Step progress bar ── */}
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center gap-0">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = step === s.id;
                  const isDone = step > s.id;
                  return (
                    <div key={s.id} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                          style={{
                            background: isDone
                              ? "oklch(0.55 0.18 145)"
                              : isActive
                              ? "oklch(0.55 0.18 145 / 0.15)"
                              : "oklch(0.20 0.004 240)",
                            color: isDone
                              ? "oklch(0.10 0 0)"
                              : isActive
                              ? "oklch(0.55 0.18 145)"
                              : "oklch(0.50 0.008 240)",
                            border: isActive ? "1.5px solid oklch(0.55 0.18 145)" : "1.5px solid transparent",
                          }}
                        >
                          {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                        </div>
                        <span
                          className="text-[10px] font-mono tracking-wide"
                          style={{ color: isActive ? "oklch(0.55 0.18 145)" : "oklch(0.45 0.008 240)" }}
                        >
                          {s.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className="flex-1 h-px mx-1 mb-4"
                          style={{ background: isDone ? "oklch(0.55 0.18 145 / 0.40)" : "oklch(0.25 0.004 240)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Step content ── */}
            <div className="px-6 pb-2 min-h-[260px]">
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm mb-2 block font-medium">Robot Type *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ROBOT_TYPES.filter((t) => t !== "Other").map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, robotType: type }))}
                          className="text-left px-3 py-2 rounded-lg text-xs border transition-all"
                          style={{
                            borderColor: form.robotType === type ? "oklch(0.55 0.18 145)" : "oklch(0.25 0.004 240)",
                            background: form.robotType === type ? "oklch(0.55 0.18 145 / 0.10)" : "transparent",
                            color: form.robotType === type ? "oklch(0.72 0.21 145)" : "oklch(0.70 0.008 240)",
                          }}
                        >
                          {type}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, robotType: "Other" }))}
                        className="text-left px-3 py-2 rounded-lg text-xs border transition-all col-span-2"
                        style={{
                          borderColor: form.robotType === "Other" ? "oklch(0.55 0.18 145)" : "oklch(0.25 0.004 240)",
                          background: form.robotType === "Other" ? "oklch(0.55 0.18 145 / 0.10)" : "transparent",
                          color: form.robotType === "Other" ? "oklch(0.72 0.21 145)" : "oklch(0.70 0.008 240)",
                        }}
                      >
                        Other
                      </button>
                    </div>
                    {form.robotType === "Other" && (
                      <Input
                        className="mt-2 bg-input border-border text-sm"
                        placeholder="Describe your robot type..."
                        value={form.robotTypeOther}
                        onChange={(e) => setForm((f) => ({ ...f, robotTypeOther: e.target.value }))}
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs mb-1.5 block text-muted-foreground">Unit Count</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={form.robotCount}
                        onChange={(e) => setForm((f) => ({ ...f, robotCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="bg-input border-border text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block text-muted-foreground">Dimensions (L×W×H)</Label>
                      <Input
                        placeholder='e.g. 24"×18"×60"'
                        value={form.robotDimensions}
                        onChange={(e) => setForm((f) => ({ ...f, robotDimensions: e.target.value }))}
                        className="bg-input border-border text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block text-muted-foreground">Weight</Label>
                      <Input
                        placeholder="e.g. 80 lbs"
                        value={form.robotWeight}
                        onChange={(e) => setForm((f) => ({ ...f, robotWeight: e.target.value }))}
                        className="bg-input border-border text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm mb-2 block font-medium">Select Your Upcoming Show</Label>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {upcomingShows.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No upcoming shows found. You can enter the show name below.</p>
                      ) : (
                        upcomingShows.map((show) => (
                          <button
                            key={show.id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, showId: show.id, showName: show.name }))}
                            className="w-full text-left px-4 py-3 rounded-lg border transition-all"
                            style={{
                              borderColor: form.showId === show.id ? "oklch(0.55 0.18 145)" : "oklch(0.25 0.004 240)",
                              background: form.showId === show.id ? "oklch(0.55 0.18 145 / 0.08)" : "transparent",
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">{show.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {show.venue && `${show.venue} · `}
                                  {show.city && `${show.city}`}
                                  {show.startDate && ` · ${new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                                </p>
                              </div>
                              {form.showId === show.id && (
                                <CheckCircle2 size={16} style={{ color: "oklch(0.55 0.18 145)", flexShrink: 0 }} />
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block text-muted-foreground">
                      {upcomingShows.length > 0 ? "Or enter a different show name" : "Show name"}
                    </Label>
                    <Input
                      placeholder="e.g. CES 2027, Automate 2027..."
                      value={form.showName}
                      onChange={(e) => setForm((f) => ({ ...f, showName: e.target.value, showId: undefined }))}
                      className="bg-input border-border text-sm"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-2">
                  <Label className="text-sm mb-2 block font-medium">Select Required Services *</Label>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {SERVICE_LINES.map((svc) => {
                      const selected = form.serviceIds.includes(svc.id);
                      const color = CATEGORY_COLORS[svc.category] ?? "oklch(0.55 0.18 145)";
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => toggleService(svc.id)}
                          className="w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-start gap-3"
                          style={{
                            borderColor: selected ? color : "oklch(0.25 0.004 240)",
                            background: selected ? `${color.replace(")", " / 0.08)")}` : "transparent",
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: selected ? color : "oklch(0.20 0.004 240)",
                              border: selected ? "none" : "1px solid oklch(0.30 0.004 240)",
                            }}
                          >
                            {selected && <CheckCircle2 size={10} style={{ color: "oklch(0.10 0 0)" }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-tight">{svc.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{svc.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {form.serviceIds.length > 0 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      {form.serviceIds.length} service{form.serviceIds.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs mb-1.5 block text-muted-foreground">Full Name *</Label>
                      <Input
                        placeholder="Jane Smith"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="bg-input border-border text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block text-muted-foreground">Work Email *</Label>
                      <Input
                        type="email"
                        placeholder="jane@company.com"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="bg-input border-border text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs mb-1.5 block text-muted-foreground">Company *</Label>
                      <Input
                        placeholder="Acme Robotics"
                        value={form.company}
                        onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                        className="bg-input border-border text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block text-muted-foreground">Phone (optional)</Label>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="bg-input border-border text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block text-muted-foreground">Additional Notes</Label>
                    <textarea
                      rows={3}
                      placeholder="Any special requirements, timeline constraints, or questions..."
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border resize-none bg-input border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {/* Summary */}
                  <div className="rounded-lg px-3 py-2 text-xs space-y-0.5" style={{ background: "oklch(0.55 0.18 145 / 0.06)", border: "1px solid oklch(0.55 0.18 145 / 0.15)" }}>
                    <p className="font-medium" style={{ color: "oklch(0.72 0.21 145)" }}>Quote Summary</p>
                    <p className="text-muted-foreground">Robot: {form.robotType === "Other" ? form.robotTypeOther : form.robotType} × {form.robotCount}</p>
                    <p className="text-muted-foreground">Show: {upcomingShows.find((s) => s.id === form.showId)?.name || form.showName || "Not specified"}</p>
                    <p className="text-muted-foreground">Services: {form.serviceIds.length} selected</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Navigation buttons ── */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1"
                onClick={() => step > 1 ? setStep(step - 1) : handleClose(false)}
              >
                <ChevronLeft size={14} />
                {step > 1 ? "Back" : "Cancel"}
              </Button>
              <div className="flex items-center gap-1.5">
                {STEPS.map((s) => (
                  <div
                    key={s.id}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{ background: step === s.id ? "oklch(0.55 0.18 145)" : step > s.id ? "oklch(0.55 0.18 145 / 0.40)" : "oklch(0.25 0.004 240)" }}
                  />
                ))}
              </div>
              {step < 4 ? (
                <Button
                  size="sm"
                  className="btn-primary gap-1"
                  disabled={!canAdvance()}
                  onClick={() => setStep(step + 1)}
                >
                  Next <ChevronRight size={14} />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="btn-primary gap-1"
                  disabled={!canAdvance() || submitMutation.isPending}
                  onClick={handleSubmit}
                >
                  {submitMutation.isPending ? (
                    <><Loader2 size={13} className="animate-spin" /> Sending...</>
                  ) : (
                    <>Submit Request <ChevronRight size={14} /></>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
