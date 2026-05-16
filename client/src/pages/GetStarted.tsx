import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Link } from "wouter";

const SERVICES = [
  { id: "port-receiving", label: "Port Receiving & Customs Clearance", desc: "US port arrival, ATA Carnet, customs broker coordination" },
  { id: "warehousing", label: "Warehousing & Staging", desc: "Secure Las Vegas warehouse, pre-show testing, activation" },
  { id: "delivery", label: "Booth Delivery & Setup", desc: "Last-mile delivery to convention center, booth setup support" },
  { id: "onsite", label: "On-Site Support", desc: "Max coordinates dedicated StageGate technicians during show hours" },
  { id: "return", label: "Return Shipping", desc: "Post-show breakdown, re-crating, and return logistics" },
  { id: "full-service", label: "Full-Service Package (Recommended)", desc: "Everything above — end-to-end robot logistics management" },
];

const ROBOT_TYPES = ["Humanoid", "AMR (Autonomous Mobile Robot)", "Service Robot", "Industrial Robot", "Quadruped", "Drone / UAV", "Other"];
const SHOWS = ["CES 2026 (January, Las Vegas)", "NAB Show 2026 (April, Las Vegas)", "MODEX 2026 (March, Atlanta)", "PROMAT 2026 (March, Chicago)", "IMTS 2026 (September, Chicago)", "AWS re:Invent 2026 (December, Las Vegas)", "Other"];

export default function GetStarted() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [warehouseEstimate, setWarehouseEstimate] = useState<string | null>(null);

  const [form, setForm] = useState({
    company: "", contactName: "", contactEmail: "", contactPhone: "",
    website: "", country: "",
    robotName: "", robotType: "", robotCount: 1,
    robotDimensions: "", robotWeight: "", specialHandling: "",
    robotSqft: "" as string | number,
    storageDays: "" as string | number,
    showName: "", showDate: "", boothNumber: "",
    services: [] as string[],
  });

  // Debounced sqft/days for live estimate preview
  const [debouncedSqft, setDebouncedSqft] = useState<number | null>(null);
  const [debouncedDays, setDebouncedDays] = useState<number | null>(null);

  useEffect(() => {
    const sqft = Number(form.robotSqft);
    const days = Number(form.storageDays);
    if (!sqft || !days || sqft < 1 || days < 1) {
      setDebouncedSqft(null);
      setDebouncedDays(null);
      return;
    }
    const t = setTimeout(() => {
      setDebouncedSqft(sqft);
      setDebouncedDays(days);
    }, 600);
    return () => clearTimeout(t);
  }, [form.robotSqft, form.storageDays]);

  const estimateEnabled = debouncedSqft !== null && debouncedDays !== null;
  const { data: liveEstimate, isFetching: estimateFetching } = trpc.warehouse.matchSpace.useQuery(
    { robotSqft: debouncedSqft ?? 1, days: debouncedDays ?? 1 },
    { enabled: estimateEnabled, staleTime: 30_000 }
  );

  const submitMutation = trpc.bookings.create.useMutation({
    onSuccess: (data) => {
      setWarehouseEstimate(data.warehouseEstimate ?? null);
      setSubmitted(true);
    },
    onError: (e) => toast.error(e.message || "Something went wrong. Please try again."),
  });

  const update = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const toggleService = (id: string) =>
    setForm(f => ({
      ...f,
      services: f.services.includes(id) ? f.services.filter(s => s !== id) : [...f.services, id],
    }));

  const handleSubmit = () => {
    if (!form.company || !form.contactName || !form.contactEmail) {
      toast.error("Company name, contact name, and email are required.");
      return;
    }
    submitMutation.mutate({
      company: form.company,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone || undefined,
      website: form.website || undefined,
      country: form.country || undefined,
      robotName: form.robotName || undefined,
      robotType: form.robotType || undefined,
      robotCount: form.robotCount,
      robotDimensions: form.robotDimensions || undefined,
      robotWeight: form.robotWeight || undefined,
      specialHandling: form.specialHandling || undefined,
      showName: form.showName || undefined,
      showDate: form.showDate || undefined,
      boothNumber: form.boothNumber || undefined,
      services: form.services,
      robotSqft: form.robotSqft ? Number(form.robotSqft) : undefined,
      storageDays: form.storageDays ? Number(form.storageDays) : undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-3">Request received.</h1>
          <p className="text-neutral-600 text-base mb-2">
            A StageGate coordinator will contact <strong>{form.contactName}</strong> at <strong>{form.contactEmail}</strong> within 24 hours to confirm your logistics plan for <strong>{form.company}</strong>.
          </p>
          {warehouseEstimate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Warehouse Storage Estimate</p>
              <p className="text-sm text-amber-900 font-medium">${warehouseEstimate} estimated</p>
              <p className="text-xs text-amber-600 mt-1">A bay has been pre-matched for your robot. Final pricing confirmed at quote stage.</p>
            </div>
          )}
          <p className="text-sm text-neutral-500 mb-8">
            Questions? Email us at{" "}
            <a href="mailto:hello@onstage.bot" className="text-emerald-600 underline">hello@onstage.bot</a>
          </p>
          <Link href="/">
            <Button variant="outline" className="border-neutral-300 text-neutral-700 font-semibold">
              ← Back to StageGate
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const stepLabels = ["Company", "Robot", "Show & Services"];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <Link href="/">
          <span className="font-bold text-neutral-900 text-lg tracking-tight cursor-pointer">StageGate</span>
        </Link>
        <span className="text-sm text-neutral-500 font-medium">Robot Logistics Intake</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Free consultation</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-3 leading-tight">
            Get your robot to the show.<br />We handle everything else.
          </h1>
          <p className="text-neutral-600 text-base leading-relaxed">
            StageGate manages robot logistics for trade shows in Las Vegas and across the US — from port receiving and customs clearance to booth delivery and on-site support. Fill out this form and we'll build your logistics plan.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-10">
          {stepLabels.map((label, i) => {
            const s = i + 1;
            return (
              <div key={s} className="flex items-center gap-1">
                <button
                  onClick={() => s < step && setStep(s)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    s === step ? "bg-neutral-900 text-white" :
                    s < step ? "bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700" :
                    "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs">
                    {s < step ? "✓" : s}
                  </span>
                  {label}
                </button>
                {s < 3 && <div className="w-4 h-px bg-neutral-200" />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Company */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Company Name *</Label>
                <Input
                  value={form.company}
                  onChange={e => update("company", e.target.value)}
                  placeholder="e.g. Unitree Robotics"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Your Name *</Label>
                <Input
                  value={form.contactName}
                  onChange={e => update("contactName", e.target.value)}
                  placeholder="Full name"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Work Email *</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={e => update("contactEmail", e.target.value)}
                  placeholder="you@company.com"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Phone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={e => update("contactPhone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Country</Label>
                <Input
                  value={form.country}
                  onChange={e => update("country", e.target.value)}
                  placeholder="e.g. China, Japan, USA"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Website</Label>
                <Input
                  value={form.website}
                  onChange={e => update("website", e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
            </div>
            <Button
              onClick={() => {
                if (!form.company || !form.contactName || !form.contactEmail) {
                  toast.error("Company name, your name, and email are required.");
                  return;
                }
                setStep(2);
              }}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-11 text-sm"
            >
              Continue → Robot Details
            </Button>
          </div>
        )}

        {/* Step 2: Robot */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Robot Name / Model</Label>
                <Input
                  value={form.robotName}
                  onChange={e => update("robotName", e.target.value)}
                  placeholder="e.g. Go2 Pro, Atlas, Spot"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Robot Type</Label>
                <select
                  value={form.robotType}
                  onChange={e => update("robotType", e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-neutral-300 text-neutral-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  <option value="">Select type...</option>
                  {ROBOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Number of Units</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.robotCount}
                  onChange={e => update("robotCount", parseInt(e.target.value) || 1)}
                  className="border-neutral-300 text-neutral-900 h-11"
                />
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Weight</Label>
                <Input
                  value={form.robotWeight}
                  onChange={e => update("robotWeight", e.target.value)}
                  placeholder="e.g. 23 kg"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Dimensions (L × W × H)</Label>
                <Input
                  value={form.robotDimensions}
                  onChange={e => update("robotDimensions", e.target.value)}
                  placeholder="e.g. 60cm × 40cm × 120cm"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Floor Footprint (sqft)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.robotSqft}
                  onChange={e => update("robotSqft", e.target.value)}
                  placeholder="e.g. 12"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
                <p className="text-xs text-neutral-400 mt-1">Used to auto-match a warehouse bay</p>
              </div>
              <div>
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Storage Days Needed</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.storageDays}
                  onChange={e => update("storageDays", e.target.value)}
                  placeholder="e.g. 7"
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                />
                <p className="text-xs text-neutral-400 mt-1">Days in warehouse before/after show</p>
              </div>
            </div>

            {/* Live Warehouse Estimate Preview */}
            {(estimateEnabled || estimateFetching) && (
              <div className={`rounded-xl border p-4 transition-all ${
                estimateFetching
                  ? "border-neutral-200 bg-neutral-50"
                  : liveEstimate?.match
                  ? "border-amber-200 bg-amber-50"
                  : "border-red-100 bg-red-50"
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
                  estimateFetching ? "text-neutral-500" : liveEstimate?.match ? "text-amber-700" : "text-red-600"
                }`}>
                  {estimateFetching ? "Matching warehouse bay…" : liveEstimate?.match ? "Warehouse Space Estimate" : "No Bay Available"}
                </p>
                {!estimateFetching && liveEstimate && (
                  liveEstimate.match ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-amber-900">
                        ${String(liveEstimate.estimatedTotal)} estimated
                      </p>
                      <p className="text-xs text-amber-700">{liveEstimate.message}</p>
                      <p className="text-xs text-amber-600 mt-1">Bay pre-matched: <strong>{liveEstimate.match.name}</strong> ({liveEstimate.match.sqft} sqft available). Final pricing confirmed at quote stage.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-red-600">{liveEstimate.message}</p>
                  )
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Special Handling Notes</Label>
                <Textarea
                  value={form.specialHandling}
                  onChange={e => update("specialHandling", e.target.value)}
                  placeholder="e.g. Temperature-sensitive batteries, fragile sensor arrays, requires upright orientation..."
                  rows={3}
                  className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-neutral-300 text-neutral-700 font-semibold h-11">
                ← Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-11">
                Continue → Show & Services
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Show + Services */}
        {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-neutral-900">Which show are you attending?</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Show / Event</Label>
                  <select
                    value={form.showName}
                    onChange={e => update("showName", e.target.value)}
                    className="w-full h-11 px-3 rounded-md border border-neutral-300 text-neutral-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">Select show...</option>
                    {SHOWS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-neutral-900 font-semibold mb-1.5 block text-sm">Booth Number (if known)</Label>
                  <Input
                    value={form.boothNumber}
                    onChange={e => update("boothNumber", e.target.value)}
                    placeholder="e.g. Hall A, Booth 1234"
                    className="border-neutral-300 text-neutral-900 placeholder:text-neutral-400 h-11"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900">What services do you need?</h2>
                <p className="text-sm text-neutral-500 mt-1">Select all that apply. We'll build a custom quote.</p>
              </div>
              <div className="space-y-2">
                {SERVICES.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                      form.services.includes(s.id)
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300 bg-white"
                    }`}
                  >
                    <Checkbox
                      checked={form.services.includes(s.id)}
                      onCheckedChange={() => toggleService(s.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-neutral-900 text-sm">{s.label}</div>
                      <div className="text-neutral-500 text-xs mt-0.5">{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-neutral-300 text-neutral-700 font-semibold h-11">
                ← Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold h-11"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Request →"}
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-neutral-400 text-center mt-10">
          By submitting, you agree to be contacted by the StageGate team. We don't share your data with third parties.
        </p>
      </div>
    </div>
  );
}
