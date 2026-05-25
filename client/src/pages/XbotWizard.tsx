import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Robot Profile", icon: "🤖" },
  { id: 2, label: "Origin & Shipping", icon: "✈️" },
  { id: 3, label: "Customs", icon: "🛃" },
  { id: 4, label: "Target Show", icon: "🎪" },
  { id: 5, label: "Services", icon: "⚙️" },
  { id: 6, label: "Contacts", icon: "👤" },
];

const XBOT_SERVICES = [
  { key: "warehouse", label: "Warehousing & Storage", desc: "Climate-controlled secure storage before and after the show" },
  { key: "staging", label: "Staging & Setup", desc: "Professional booth setup and robot positioning" },
  { key: "activation", label: "Technical Activation", desc: "Power-on, calibration, and demo readiness check" },
  { key: "drayage", label: "Drayage (Booth Delivery)", desc: "Freight delivery from dock to booth" },
  { key: "customs", label: "Customs Brokerage", desc: "Full customs clearance handled by StageGate" },
  { key: "ground_transport", label: "Ground Transport", desc: "Airport/port pickup to warehouse" },
  { key: "crating", label: "Crating & Packaging", desc: "Custom crating for safe transport" },
  { key: "teardown", label: "Teardown & Return Shipping", desc: "Post-show disassembly and outbound logistics" },
];

const PORTS_OF_ENTRY = [
  "Los Angeles (LAX/Port of LA)",
  "Las Vegas (LAS)",
  "San Francisco (SFO)",
  "New York (JFK/Port of NY)",
  "Chicago (ORD)",
  "Houston (IAH/Port of Houston)",
  "Miami (MIA/Port of Miami)",
  "Seattle (SEA/Port of Seattle)",
  "Other",
];

// ─── Session Token Storage ────────────────────────────────────────────────────

const SESSION_KEY = "xbot_session_token";
const PROJECT_KEY = "xbot_project_id";

function getStoredSession() {
  return {
    token: localStorage.getItem(SESSION_KEY),
    projectId: localStorage.getItem(PROJECT_KEY)
      ? parseInt(localStorage.getItem(PROJECT_KEY)!)
      : null,
  };
}

function storeSession(token: string, projectId: number) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(PROJECT_KEY, String(projectId));
}

// ─── Form State Types ─────────────────────────────────────────────────────────

interface WizardFormData {
  // Step 1
  robotMake: string;
  robotModel: string;
  robotDimensions: string;
  robotWeight: string;
  powerRequirements: string;
  specialHandling: string;
  // Step 2
  originCountry: string;
  originCity: string;
  shippingMethod: "air" | "sea" | "ground" | "";
  flightVesselNumber: string;
  eta: string;
  portOfEntry: string;
  // Step 3
  hsCode: string;
  ataCarnet: boolean;
  customsBroker: "stagegate" | "own" | "tbd";
  customsBrokerName: string;
  // Step 4
  showId: number | null;
  boothNumber: string;
  setupDate: string;
  teardownDate: string;
  // Step 5
  selectedServices: string[];
  groundTransportProvider: "stagegate" | "own" | "directory" | "";
  // Step 6
  primaryName: string;
  primaryEmail: string;
  primaryPhone: string;
  onsiteName: string;
  onsiteEmail: string;
  onsitePhone: string;
  emergencyName: string;
  emergencyPhone: string;
}

const EMPTY_FORM: WizardFormData = {
  robotMake: "",
  robotModel: "",
  robotDimensions: "",
  robotWeight: "",
  powerRequirements: "",
  specialHandling: "",
  originCountry: "",
  originCity: "",
  shippingMethod: "",
  flightVesselNumber: "",
  eta: "",
  portOfEntry: "",
  hsCode: "",
  ataCarnet: false,
  customsBroker: "tbd",
  customsBrokerName: "",
  showId: null,
  boothNumber: "",
  setupDate: "",
  teardownDate: "",
  selectedServices: [],
  groundTransportProvider: "",
  primaryName: "",
  primaryEmail: "",
  primaryPhone: "",
  onsiteName: "",
  onsiteEmail: "",
  onsitePhone: "",
  emergencyName: "",
  emergencyPhone: "",
};

// ─── Step Components ──────────────────────────────────────────────────────────

function StepRobotProfile({
  form,
  onChange,
}: {
  form: WizardFormData;
  onChange: (k: keyof WizardFormData, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Robot Make / Manufacturer *</Label>
          <Input
            placeholder="e.g. Unitree, Boston Dynamics, UBTECH"
            value={form.robotMake}
            onChange={(e) => onChange("robotMake", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Robot Model *</Label>
          <Input
            placeholder="e.g. G1, Spot, Walker X"
            value={form.robotModel}
            onChange={(e) => onChange("robotModel", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Dimensions (L × W × H cm)</Label>
          <Input
            placeholder="e.g. 60 × 45 × 130"
            value={form.robotDimensions}
            onChange={(e) => onChange("robotDimensions", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Weight (kg)</Label>
          <Input
            placeholder="e.g. 35"
            value={form.robotWeight}
            onChange={(e) => onChange("robotWeight", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Power Requirements</Label>
        <Input
          placeholder="e.g. 110V/220V AC, 15A, or battery only"
          value={form.powerRequirements}
          onChange={(e) => onChange("powerRequirements", e.target.value)}
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Special Handling Notes</Label>
        <Textarea
          placeholder="Fragile components, orientation requirements, temperature sensitivity, etc."
          value={form.specialHandling}
          onChange={(e) => onChange("specialHandling", e.target.value)}
          rows={3}
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 resize-none"
        />
      </div>
    </div>
  );
}

function StepOriginShipping({
  form,
  onChange,
}: {
  form: WizardFormData;
  onChange: (k: keyof WizardFormData, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Origin Country *</Label>
          <Input
            placeholder="e.g. China, Japan, Germany"
            value={form.originCountry}
            onChange={(e) => onChange("originCountry", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Origin City *</Label>
          <Input
            placeholder="e.g. Shenzhen, Tokyo, Munich"
            value={form.originCity}
            onChange={(e) => onChange("originCity", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Shipping Method *</Label>
        <Select
          value={form.shippingMethod}
          onValueChange={(v) => onChange("shippingMethod", v)}
        >
          <SelectTrigger className="bg-white/5 border-white/15 text-white focus:border-emerald-400">
            <SelectValue placeholder="Select shipping method" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/15 text-white">
            <SelectItem value="air">✈️ Air Freight (fastest, recommended for robots)</SelectItem>
            <SelectItem value="sea">🚢 Sea Freight (cost-effective for large shipments)</SelectItem>
            <SelectItem value="ground">🚛 Ground Transport (North America only)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Flight / Vessel Number</Label>
          <Input
            placeholder="e.g. CA881, COSCO SHIPPING"
            value={form.flightVesselNumber}
            onChange={(e) => onChange("flightVesselNumber", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Estimated Arrival (ETA)</Label>
          <Input
            type="date"
            value={form.eta}
            onChange={(e) => onChange("eta", e.target.value)}
            className="bg-white/5 border-white/15 text-white focus:border-emerald-400"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Port / Airport of Entry</Label>
        <Select
          value={form.portOfEntry}
          onValueChange={(v) => onChange("portOfEntry", v)}
        >
          <SelectTrigger className="bg-white/5 border-white/15 text-white focus:border-emerald-400">
            <SelectValue placeholder="Select port of entry" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/15 text-white">
            {PORTS_OF_ENTRY.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepCustoms({
  form,
  onChange,
  onBoolChange,
}: {
  form: WizardFormData;
  onChange: (k: keyof WizardFormData, v: string) => void;
  onBoolChange: (k: keyof WizardFormData, v: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="p-4 border border-amber-500/30 rounded-lg bg-amber-500/5">
        <p className="text-amber-400 text-sm font-medium mb-1">Why this matters</p>
        <p className="text-white/60 text-sm">
          Robots are complex goods that often face customs scrutiny. Providing accurate HS codes and
          ATA Carnet eligibility upfront prevents costly delays at the border.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">HS Code (Harmonized System)</Label>
        <Input
          placeholder="e.g. 8479.89 — leave blank for XBOT to suggest one"
          value={form.hsCode}
          onChange={(e) => onChange("hsCode", e.target.value)}
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
        />
        <p className="text-white/40 text-xs">
          XBOT will suggest the most appropriate HS code for your robot type in the logistics brief.
        </p>
      </div>
      <div className="flex items-start gap-3 p-4 border border-white/10 rounded-lg bg-white/3">
        <Checkbox
          id="ataCarnet"
          checked={form.ataCarnet}
          onCheckedChange={(v) => onBoolChange("ataCarnet", !!v)}
          className="mt-0.5 border-white/30 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
        />
        <div>
          <Label htmlFor="ataCarnet" className="text-white/90 text-sm cursor-pointer">
            Request ATA Carnet (Temporary Import)
          </Label>
          <p className="text-white/40 text-xs mt-1">
            An ATA Carnet allows temporary duty-free import of your robot for the show and
            re-export afterward. Recommended for robots valued over $10,000.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Customs Broker</Label>
        <Select
          value={form.customsBroker}
          onValueChange={(v) => onChange("customsBroker", v)}
        >
          <SelectTrigger className="bg-white/5 border-white/15 text-white focus:border-emerald-400">
            <SelectValue placeholder="Select customs broker" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/15 text-white">
            <SelectItem value="stagegate">🏢 Use StageGate's customs broker (recommended)</SelectItem>
            <SelectItem value="own">👤 I have my own customs broker</SelectItem>
            <SelectItem value="tbd">❓ To be determined</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.customsBroker === "own" && (
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Your Customs Broker Name / Company</Label>
          <Input
            placeholder="e.g. ABC Customs Brokers Inc."
            value={form.customsBrokerName}
            onChange={(e) => onChange("customsBrokerName", e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
          />
        </div>
      )}
    </div>
  );
}

function StepTargetShow({
  form,
  onChange,
}: {
  form: WizardFormData;
  onChange: (k: keyof WizardFormData, v: string | number | null) => void;
}) {
  const showsQuery = trpc.shows.lasVegas2026.useQuery();
  const shows = showsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Target Trade Show *</Label>
        {showsQuery.isLoading ? (
          <div className="h-10 bg-white/5 border border-white/15 rounded-md animate-pulse" />
        ) : (
          <Select
            value={form.showId ? String(form.showId) : ""}
            onValueChange={(v) => onChange("showId", v ? parseInt(v) : null)}
          >
            <SelectTrigger className="bg-white/5 border-white/15 text-white focus:border-emerald-400">
              <SelectValue placeholder="Select a Las Vegas trade show" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1d27] border-white/15 text-white max-h-64">
              {shows.map((show) => (
                <SelectItem key={show.id} value={String(show.id)}>
                  {show.name}
                  {show.startDate
                    ? ` — ${new Date(show.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-white/40 text-xs">
          Only showing upcoming Las Vegas shows. Don't see yours?{" "}
          <a href="mailto:hello@stagegate.com" className="text-amber-400 hover:underline">
            Contact us
          </a>
          .
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Booth Number</Label>
        <Input
          placeholder="e.g. 4521, Hall C-12"
          value={form.boothNumber}
          onChange={(e) => onChange("boothNumber", e.target.value)}
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Setup Date</Label>
          <Input
            type="date"
            value={form.setupDate}
            onChange={(e) => onChange("setupDate", e.target.value)}
            className="bg-white/5 border-white/15 text-white focus:border-emerald-400"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Teardown Date</Label>
          <Input
            type="date"
            value={form.teardownDate}
            onChange={(e) => onChange("teardownDate", e.target.value)}
            className="bg-white/5 border-white/15 text-white focus:border-emerald-400"
          />
        </div>
      </div>
    </div>
  );
}

function StepServices({
  form,
  onServicesChange,
  onChange,
}: {
  form: WizardFormData;
  onServicesChange: (services: string[]) => void;
  onChange: (k: keyof WizardFormData, v: string) => void;
}) {
  const toggleService = (key: string) => {
    const current = form.selectedServices;
    if (current.includes(key)) {
      onServicesChange(current.filter((s) => s !== key));
    } else {
      onServicesChange([...current, key]);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-white/60 text-sm mb-4">
          Select the services you need. XBOT will build a custom service package and timeline based
          on your selections.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {XBOT_SERVICES.map((svc) => {
            const selected = form.selectedServices.includes(svc.key);
            return (
              <button
                key={svc.key}
                type="button"
                onClick={() => toggleService(svc.key)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  selected
                    ? "border-emerald-500/60 bg-emerald-500/8 text-white"
                    : "border-white/10 bg-white/3 text-white/70 hover:border-white/25 hover:bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-medium ${selected ? "text-white" : "text-white/80"}`}>
                      {svc.label}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{svc.desc}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                      selected ? "border-emerald-500 bg-emerald-600/80" : "border-white/20"
                    }`}
                  >
                    {selected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 text-sm">Ground Transport Preference</Label>
        <Select
          value={form.groundTransportProvider}
          onValueChange={(v) => onChange("groundTransportProvider", v)}
        >
          <SelectTrigger className="bg-white/5 border-white/15 text-white focus:border-emerald-400">
            <SelectValue placeholder="How should we handle ground transport?" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/15 text-white">
            <SelectItem value="stagegate">🚛 StageGate handles ground transport</SelectItem>
            <SelectItem value="own">🔧 I'll arrange my own ground transport</SelectItem>
            <SelectItem value="directory">📋 Show me a directory of Las Vegas freight companies</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepContacts({
  form,
  onChange,
}: {
  form: WizardFormData;
  onChange: (k: keyof WizardFormData, v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-600/80 text-white text-xs flex items-center justify-center">1</span>
          Primary Contact *
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Full Name</Label>
            <Input
              placeholder="Jane Smith"
              value={form.primaryName}
              onChange={(e) => onChange("primaryName", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Email</Label>
            <Input
              type="email"
              placeholder="jane@company.com"
              value={form.primaryEmail}
              onChange={(e) => onChange("primaryEmail", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Phone</Label>
            <Input
              placeholder="+1 555 000 0000"
              value={form.primaryPhone}
              onChange={(e) => onChange("primaryPhone", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/10 text-white/60 text-xs flex items-center justify-center">2</span>
          On-Site Contact <span className="text-white/30 font-normal">(optional)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Full Name</Label>
            <Input
              placeholder="John Doe"
              value={form.onsiteName}
              onChange={(e) => onChange("onsiteName", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Email</Label>
            <Input
              type="email"
              placeholder="john@company.com"
              value={form.onsiteEmail}
              onChange={(e) => onChange("onsiteEmail", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Phone</Label>
            <Input
              placeholder="+1 555 000 0000"
              value={form.onsitePhone}
              onChange={(e) => onChange("onsitePhone", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/10 text-white/60 text-xs flex items-center justify-center">3</span>
          Emergency Contact <span className="text-white/30 font-normal">(optional)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Full Name</Label>
            <Input
              placeholder="Emergency Contact"
              value={form.emergencyName}
              onChange={(e) => onChange("emergencyName", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Phone</Label>
            <Input
              placeholder="+1 555 000 0000"
              value={form.emergencyPhone}
              onChange={(e) => onChange("emergencyPhone", e.target.value)}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 h-9 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

export default function XbotWizard() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<WizardFormData>(EMPTY_FORM);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  // Animation state
  const [animKey, setAnimKey] = useState(0);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createProject = trpc.xbot.createProject.useMutation();
  const updateProject = trpc.xbot.updateProject.useMutation();

  // Initialize: create project on mount or restore from localStorage
  useEffect(() => {
    const stored = getStoredSession();
    if (stored.projectId && stored.token) {
      setProjectId(stored.projectId);
      setSessionToken(stored.token);
      setIsInitialized(true);
    } else {
      createProject.mutate(
        {},
        {
          onSuccess: (data) => {
            setProjectId(data.projectId);
            setSessionToken(data.sessionToken);
            storeSession(data.sessionToken, data.projectId);
            setIsInitialized(true);
          },
          onError: () => {
            toast.error("Failed to initialize XBOT. Please try again.");
          },
        }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((k: keyof WizardFormData, v: string | number | boolean | null) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  const handleServicesChange = useCallback((services: string[]) => {
    setForm((prev) => ({ ...prev, selectedServices: services }));
  }, []);

  // Auto-save current step data
  const saveStep = useCallback(async () => {
    if (!projectId || !sessionToken || !isInitialized) return;
    setIsSaving(true);
    try {
      const contacts =
        form.primaryName || form.primaryEmail
          ? {
              primary: {
                name: form.primaryName,
                email: form.primaryEmail,
                phone: form.primaryPhone,
              },
              ...(form.onsiteName
                ? {
                    onsite: {
                      name: form.onsiteName,
                      email: form.onsiteEmail,
                      phone: form.onsitePhone,
                    },
                  }
                : {}),
              ...(form.emergencyName
                ? {
                    emergency: {
                      name: form.emergencyName,
                      phone: form.emergencyPhone,
                    },
                  }
                : {}),
            }
          : undefined;

      await updateProject.mutateAsync({
        projectId,
        sessionToken,
        data: {
          robotMake: form.robotMake || undefined,
          robotModel: form.robotModel || undefined,
          robotDimensions: form.robotDimensions || undefined,
          robotWeight: form.robotWeight || undefined,
          powerRequirements: form.powerRequirements || undefined,
          specialHandling: form.specialHandling || undefined,
          originCountry: form.originCountry || undefined,
          originCity: form.originCity || undefined,
          shippingMethod: form.shippingMethod || undefined,
          flightVesselNumber: form.flightVesselNumber || undefined,
          eta: form.eta || undefined,
          portOfEntry: form.portOfEntry || undefined,
          hsCode: form.hsCode || undefined,
          ataCarnet: form.ataCarnet,
          customsBroker: form.customsBroker,
          customsBrokerName: form.customsBrokerName || undefined,
          showId: form.showId ?? undefined,
          boothNumber: form.boothNumber || undefined,
          setupDate: form.setupDate || undefined,
          teardownDate: form.teardownDate || undefined,
          selectedServices: form.selectedServices.length > 0 ? form.selectedServices : undefined,
          groundTransportProvider: form.groundTransportProvider || undefined,
          contacts,
          currentStep,
        },
      });
    } catch {
      // Silent auto-save failure — don't block user
    } finally {
      setIsSaving(false);
    }
  }, [projectId, sessionToken, isInitialized, form, currentStep, updateProject]);

  // Cleanup animation timer on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  const transitionToStep = useCallback((nextStep: number, dir: "forward" | "back") => {
    setAnimDir(dir);
    setIsAnimating(true);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => {
      setCurrentStep(nextStep);
      setAnimKey((k) => k + 1);
      setIsAnimating(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 220); // half the transition duration — swap content mid-fade
  }, []);

  const handleNext = () => {
    // Validate required fields per step
    if (currentStep === 1 && (!form.robotMake || !form.robotModel)) {
      toast.error("Please enter the robot make and model to continue.");
      return;
    }
    if (currentStep === 2 && (!form.originCountry || !form.originCity || !form.shippingMethod)) {
      toast.error("Please fill in origin country, city, and shipping method.");
      return;
    }

    if (currentStep < 6) {
      // Fire save in background — transition starts immediately
      saveStep().catch(() => { /* silent */ });
      transitionToStep(currentStep + 1, "forward");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      transitionToStep(currentStep - 1, "back");
    }
  };

  const handleFinish = async () => {
    if (!form.primaryName || !form.primaryEmail) {
      toast.error("Please provide at least a primary contact name and email.");
      return;
    }
    await saveStep();
    if (projectId) {
      // Clear stored session so next visit starts fresh
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(PROJECT_KEY);
      navigate(`/xbot/project/${projectId}?token=${sessionToken}`);
    }
  };

  // step N / 6 * 100 → step 1 = 17%, step 6 = 100%
  const progressPercent = Math.round((currentStep / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 pt-32 pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono text-emerald-400 border border-emerald-500/60/40 px-2 py-0.5 rounded">
              XBOT
            </span>
            <span className="text-white/30 text-xs">Automated Logistics Intake</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Plan Your Robot's Journey to Las Vegas
          </h1>
          <p className="text-white/50 text-sm">
            Complete all 6 steps and XBOT will generate a custom logistics brief with timeline,
            customs checklist, and service package.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          {/* Step bubbles + labels */}
          <div className="relative flex items-start justify-between mb-4">
            {/* Connector track behind bubbles */}
            <div
              className="absolute top-4 left-4 right-4 h-px bg-white/10"
              aria-hidden="true"
            />
            {STEPS.map((step) => {
              const isCompleted = step.id < currentStep;
              const isActive = step.id === currentStep;
              return (
                <div key={step.id} className="relative flex flex-col items-center gap-1.5 z-10">
                  {/* Bubble */}
                  <div
                    className={[
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-400",
                      isCompleted
                        ? "bg-emerald-600/80 border-emerald-500 text-white shadow-[0_0_12px_rgba(0,232,122,0.4)]"
                        : isActive
                        ? "bg-[#0d0f14] border-emerald-500/60 text-emerald-300 shadow-[0_0_14px_rgba(0,232,122,0.25)]"
                        : "bg-white/5 border-white/15 text-white/30",
                    ].join(" ")}
                  >
                    {isCompleted ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-[11px] font-mono font-bold">{step.id}</span>
                    )}
                  </div>
                  {/* Label */}
                  <span
                    className={[
                      "hidden sm:block text-[10px] font-medium transition-colors duration-300 text-center max-w-[64px] leading-tight",
                      isCompleted ? "text-emerald-400" : isActive ? "text-white" : "text-white/30",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Animated progress track */}
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-in-out"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)",
                boxShadow: progressPercent > 0 ? "0 0 8px rgba(0,232,122,0.5)" : "none",
              }}
            />
          </div>

          {/* Percentage label */}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono text-white/30">
              Step {currentStep} of {STEPS.length}
            </span>
            <span
              className="text-[10px] font-mono text-emerald-400 transition-all duration-500"
            >
              {progressPercent}% complete
            </span>
          </div>
        </div>

        {/* Step Card */}
        <div className="border border-white/10 rounded-xl bg-white/3 overflow-hidden">
          {/* Card header */}
          <div className="flex items-center gap-3 px-6 sm:px-8 pt-6 pb-5 border-b border-white/8">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl
                         bg-emerald-600/80/15 border border-emerald-500/60/30 transition-all duration-300"
            >
              {STEPS[currentStep - 1].icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider">
                Step {currentStep} of {STEPS.length}
              </p>
              <h2 className="text-base sm:text-lg font-semibold text-white leading-tight">
                {STEPS[currentStep - 1].label}
              </h2>
            </div>
            {isSaving && (
              <span className="text-xs text-white/30 flex items-center gap-1.5 shrink-0">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            )}
          </div>

          {/* Step Content — direction-aware slide+fade */}
          <div
            key={animKey}
            className="px-6 sm:px-8 py-6"
            style={{
              animation: isAnimating
                ? `xbot-exit-${animDir} 220ms ease-in forwards`
                : `xbot-enter-${animDir} 280ms ease-out both`,
            }}
          >
            {currentStep === 1 && (
              <StepRobotProfile form={form} onChange={handleChange} />
            )}
            {currentStep === 2 && (
              <StepOriginShipping form={form} onChange={handleChange} />
            )}
            {currentStep === 3 && (
              <StepCustoms form={form} onChange={handleChange} onBoolChange={handleChange} />
            )}
            {currentStep === 4 && (
              <StepTargetShow form={form} onChange={handleChange} />
            )}
            {currentStep === 5 && (
              <StepServices form={form} onServicesChange={handleServicesChange} onChange={handleChange} />
            )}
            {currentStep === 6 && (
              <StepContacts form={form} onChange={handleChange} />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 sm:px-8 pb-6 pt-4 border-t border-white/8">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1 || isAnimating}
              className="text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-30"
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              {currentStep < 6 ? (
                <Button
                  onClick={handleNext}
                  disabled={isSaving || !isInitialized || isAnimating}
                  className="bg-emerald-600/80 hover:bg-emerald-500 text-white border-0 px-6"
                >
                  {isSaving ? "Saving…" : "Continue →"}
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={isSaving || !isInitialized || isAnimating}
                  className="border border-amber-500 text-amber-400 bg-transparent hover:bg-amber-500/10 px-6"
                >
                  {isSaving ? "Saving…" : "Generate Logistics Brief →"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-white/25 text-xs mt-6">
          Your progress is auto-saved. You can return to this browser to continue later.
        </p>
      </div>
    </div>
  );
}
