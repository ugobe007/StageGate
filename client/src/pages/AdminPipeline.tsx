import { useState, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Send, X, GripVertical, Plus, Check,
  Building2, Bot, MapPin, Mail, Linkedin, Globe, ArrowRight,
  Sparkles, ChevronRight, ExternalLink, Users, Activity,
  FileText, Zap, Clock, TrendingUp, Shield, Star,
  Phone, Calendar, AlertCircle, CheckCircle2,
} from "lucide-react";

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "new",       label: "Prospects",  color: "bg-zinc-800 text-zinc-300",    dot: "bg-zinc-500"   },
  { key: "contacted", label: "Contacted",  color: "bg-blue-900/60 text-blue-300", dot: "bg-blue-400"   },
  { key: "responded", label: "Replied",    color: "bg-amber-900/60 text-amber-300", dot: "bg-amber-400" },
  { key: "scheduled", label: "Qualified",  color: "bg-emerald-900/60 text-emerald-300", dot: "bg-emerald-400" },
  { key: "converted", label: "Jobs",       color: "bg-violet-900/60 text-violet-300", dot: "bg-violet-400" },
] as const;

type StageKey = typeof PIPELINE_STAGES[number]["key"];

// ─── Types ────────────────────────────────────────────────────────────────────

type Prospect = {
  id: number;
  company: string;
  robotName: string | null;
  robotType: string | null;
  hqCountry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactTitle: string | null;
  contactLinkedIn: string | null;
  website: string | null;
  shows: string[] | null;
  notes: string | null;
  status: string;
  emailConfidence: string | null;
  followUpDate: string | null;
  createdAt: string;
};

type ResearchData = {
  companyOverview: string;
  robotSpecs: {
    name: string;
    type: string;
    payload?: string;
    speed?: string;
    battery?: string;
    navigation?: string;
    useCases?: string[];
  };
  competitiveContext: string;
  useCases: string[];
  whyStageGate: string;
  showIntel: string;
  decisionMakers: Array<{
    name: string;
    title: string;
    email?: string;
    linkedin?: string;
    confidence?: string;
  }>;
};

// ─── Draggable Card ───────────────────────────────────────────────────────────

function DraggableCard({
  prospect,
  isSelected,
  isDragging,
  onClick,
}: {
  prospect: Prospect;
  isSelected: boolean;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `prospect-${prospect.id}`,
    data: { prospect },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const stage = PIPELINE_STAGES.find(s => s.key === prospect.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border text-sm transition-all select-none cursor-pointer ${
        isDragging
          ? "opacity-20"
          : isSelected
          ? "border-emerald-500/50 bg-zinc-800 shadow-lg shadow-emerald-500/10"
          : "border-zinc-700/60 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-800"
      }`}
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-start gap-1.5">
          <button
            {...listeners}
            {...attributes}
            className="mt-0.5 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
            aria-label="Drag"
          >
            <GripVertical size={12} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white leading-tight truncate text-[13px]">
              {prospect.company}
            </div>
            {prospect.robotName && (
              <div className="flex items-center gap-1 mt-1">
                <Bot size={10} className="text-zinc-500 shrink-0" />
                <span className="text-[11px] text-zinc-400 truncate">{prospect.robotName}</span>
                {prospect.robotType && (
                  <span className="text-[10px] text-zinc-600 truncate">· {prospect.robotType}</span>
                )}
              </div>
            )}
            {prospect.shows?.length ? (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {prospect.shows.slice(0, 2).map(s => (
                  <span key={s} className="inline-block bg-zinc-700/60 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded font-medium">
                    {s}
                  </span>
                ))}
                {prospect.shows.length > 2 && (
                  <span className="text-[10px] text-zinc-500">+{prospect.shows.length - 2}</span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {prospect.hqCountry && (
        <div className="px-3 pb-2.5 flex items-center gap-1">
          <MapPin size={9} className="text-zinc-600" />
          <span className="text-[10px] text-zinc-500">{prospect.hqCountry}</span>
        </div>
      )}
    </div>
  );
}

function DragOverlayCard({ prospect }: { prospect: Prospect }) {
  return (
    <div className="border border-emerald-500/50 rounded-lg p-3 text-sm bg-zinc-800 shadow-2xl shadow-emerald-500/20 w-52 rotate-1">
      <div className="font-semibold text-white text-[13px] truncate">{prospect.company}</div>
      {prospect.robotName && (
        <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{prospect.robotName}</div>
      )}
    </div>
  );
}

// ─── Inline Add Card Form ─────────────────────────────────────────────────────

function AddCardForm({
  stageKey,
  onCreated,
  onCancel,
}: {
  stageKey: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [company, setCompany] = useState("");
  const [event, setEvent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const create = trpc.prospects.create.useMutation({
    onSuccess: () => { toast.success(`${company.trim()} added`); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    const name = company.trim();
    if (!name) return;
    create.mutate({
      company: name,
      shows: event.trim() ? [event.trim()] : undefined,
      status: stageKey as StageKey,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="border border-emerald-500/40 rounded-lg p-2.5 bg-zinc-800 space-y-1.5 shadow-lg">
      <input
        ref={inputRef}
        value={company}
        onChange={e => setCompany(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Company name"
        className="w-full text-[13px] border border-zinc-600 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-500 bg-zinc-900 text-white"
      />
      <input
        value={event}
        onChange={e => setEvent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Event (e.g. CES 2026)"
        className="w-full text-xs border border-zinc-600 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-500 bg-zinc-900 text-white"
      />
      <div className="flex gap-1.5 pt-0.5">
        <button
          onClick={handleSubmit}
          disabled={!company.trim() || create.isPending}
          className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 text-white rounded py-1.5 text-xs hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {create.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-2.5 border border-zinc-600 rounded text-xs text-zinc-400 hover:border-zinc-400"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

function DroppableColumn({
  stageKey,
  label,
  color,
  dot,
  items,
  isLoading,
  isOver,
  selectedId,
  draggingId,
  onCardClick,
  onCreated,
}: {
  stageKey: string;
  label: string;
  color: string;
  dot: string;
  items: Prospect[];
  isLoading: boolean;
  isOver: boolean;
  selectedId: number | null;
  draggingId: number | null;
  onCardClick: (p: Prospect) => void;
  onCreated: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: `col-${stageKey}` });
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col border-r border-zinc-800 last:border-r-0 min-w-0">
      {/* Column header */}
      <div className="px-3 py-3 border-b border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
          <span className="text-[12px] font-semibold text-zinc-200">{label}</span>
        </div>
        <span className="text-xs text-zinc-500 tabular-nums shrink-0 font-mono">{items.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-1.5 transition-colors ${
          isOver ? "bg-zinc-700/20" : ""
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 size={14} className="animate-spin text-zinc-600" />
          </div>
        ) : items.length === 0 && !isOver ? (
          <div className="text-[11px] text-center pt-10 text-zinc-600">Empty</div>
        ) : (
          items.map(p => (
            <DraggableCard
              key={p.id}
              prospect={p}
              isSelected={selectedId === p.id}
              isDragging={draggingId === p.id}
              onClick={() => onCardClick(p)}
            />
          ))
        )}
        {isOver && (
          <div className="h-8 border-2 border-dashed border-emerald-500/30 rounded-lg" />
        )}

        {/* Inline add */}
        {adding ? (
          <AddCardForm
            stageKey={stageKey}
            onCreated={() => { setAdding(false); onCreated(); }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 py-1.5 px-1 rounded hover:bg-zinc-800 transition-colors"
          >
            <Plus size={11} />
            Add Company
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CRM Detail Panel ─────────────────────────────────────────────────────────

type PanelTab = "overview" | "research" | "email" | "activity";

function CRMPanel({
  prospect,
  onClose,
  onStatusChange,
}: {
  prospect: Prospect;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const ctx = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<PanelTab>("overview");
  const stage = PIPELINE_STAGES.find(s => s.key === prospect.status);
  const nextStage = PIPELINE_STAGES[PIPELINE_STAGES.findIndex(s => s.key === prospect.status) + 1];

  // AI brief — auto-fetches on open
  const { data: briefData, isLoading: briefLoading } = trpc.prospects.getBrief.useQuery(
    { id: prospect.id },
    { staleTime: 5 * 60 * 1000 }
  );

  // Research data (nightly job results)
  const { data: researchData, isLoading: researchLoading, refetch: refetchResearch } = trpc.prospects.getResearch.useQuery(
    { prospectId: prospect.id },
    { staleTime: 10 * 60 * 1000 }
  );

  // Activity log
  const { data: activitiesData, isLoading: activitiesLoading } = trpc.prospects.getActivities.useQuery(
    { prospectId: prospect.id },
    { staleTime: 2 * 60 * 1000 }
  );

  const [draftMessage, setDraftMessage] = useState<string>("");
  const [draftEdited, setDraftEdited] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [tone, setTone] = useState<"professional" | "friendly" | "concise" | "bold">("professional");
  const [regenerating, setRegenerating] = useState(false);

  // Populate draft from AI brief once loaded
  useEffect(() => {
    if (briefData?.brief?.draftMessage && !draftEdited) {
      setDraftMessage(briefData.brief.draftMessage);
    }
  }, [briefData, draftEdited]);

  // Reset when prospect changes
  useEffect(() => {
    setDraftMessage("");
    setDraftEdited(false);
    setActiveTab("overview");
  }, [prospect.id]);

  const updateStatus = trpc.prospects.bulkUpdateStatus.useMutation({
    onSuccess: () => { ctx.prospects.list.invalidate(); toast.success("Stage updated"); },
    onError: (e) => toast.error(e.message),
  });

  const regenerateDraft = trpc.prospects.regenerateDraft.useMutation({
    onMutate: () => setRegenerating(true),
    onSuccess: (data) => {
      setDraftMessage(data.draft);
      setDraftEdited(true);
      setRegenerating(false);
      toast.success("Draft rewritten");
    },
    onError: (e) => { setRegenerating(false); toast.error(e.message); },
  });

  const triggerResearch = trpc.prospects.triggerResearch.useMutation({
    onSuccess: () => { refetchResearch(); toast.success("Research queued — refreshing in a moment"); },
    onError: (e) => toast.error(e.message),
  });

  const generateDraft = trpc.admin.generateDrafts.useMutation({
    onSuccess: () => {
      setSendSuccess(true);
      // Log activity
      ctx.prospects.getActivities.invalidate({ prospectId: prospect.id });
      toast.success(`Draft queued for ${prospect.company}`, {
        description: "Review and send from the Outreach queue.",
        action: { label: "View Outreach", onClick: () => window.location.href = "/admin/outreach" },
        duration: 5000,
      });
      setTimeout(() => setSendSuccess(false), 2000);
    },
    onError: (e) => toast.error(e.message),
  });

  function handleAdvanceStage() {
    if (!nextStage) return;
    updateStatus.mutate({ ids: [prospect.id], status: nextStage.key });
    onStatusChange(prospect.id, nextStage.key);
  }

  function handleSendDraft() {
    if (!prospect.contactEmail) {
      toast.error("No email on file — add a contact email first");
      return;
    }
    generateDraft.mutate({ prospectIds: [prospect.id] });
  }

  // researchData is the raw row from prospectResearch table
  const research: ResearchData | null = researchData ? {
    companyOverview: researchData.companyOverview ?? "",
    robotSpecs: researchData.robotSpecs as ResearchData["robotSpecs"] ?? { name: "", type: "" },
    competitiveContext: researchData.competitiveContext ?? "",
    useCases: (researchData.useCases as string[]) ?? [],
    whyStageGate: researchData.whyStageGate ?? "",
    showIntel: researchData.showIntel ?? "",
    decisionMakers: (researchData.decisionMakers as ResearchData["decisionMakers"]) ?? [],
  } : null;

  const confidenceColor: Record<string, string> = {
    verified: "text-emerald-400 bg-emerald-900/40 border border-emerald-700/40",
    high:     "text-blue-400 bg-blue-900/40 border border-blue-700/40",
    medium:   "text-amber-400 bg-amber-900/40 border border-amber-700/40",
    low:      "text-red-400 bg-red-900/40 border border-red-700/40",
  };

  const TABS: { key: PanelTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Building2 size={12} /> },
    { key: "research", label: "Research", icon: <Sparkles size={12} /> },
    { key: "email",    label: "Email",    icon: <Send size={12} /> },
    { key: "activity", label: "Activity", icon: <Activity size={12} /> },
  ];

  return (
    <aside className="fixed right-0 top-0 h-full w-[500px] bg-zinc-900 border-l border-zinc-700/60 shadow-2xl z-50 flex flex-col overflow-hidden">

      {/* ── Business Card Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            {/* Stage pill + advance */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${stage?.color ?? "bg-zinc-800 text-zinc-400"}`}>
                {stage?.label ?? prospect.status}
              </span>
              {nextStage && (
                <button
                  onClick={handleAdvanceStage}
                  disabled={updateStatus.isPending}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  {updateStatus.isPending ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
                  Move to {nextStage.label}
                </button>
              )}
            </div>

            {/* Company name */}
            <h2 className="text-[20px] font-bold text-white leading-tight truncate">{prospect.company}</h2>

            {/* Robot + country */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {prospect.robotName && (
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-300">
                  <Bot size={12} className="text-zinc-500" />
                  <span className="font-medium">{prospect.robotName}</span>
                  {prospect.robotType && <span className="text-zinc-500">· {prospect.robotType}</span>}
                </span>
              )}
              {prospect.hqCountry && (
                <span className="flex items-center gap-1 text-[12px] text-zinc-500">
                  <MapPin size={10} />
                  {prospect.hqCountry}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 ml-3 mt-0.5 shrink-0 p-1 rounded hover:bg-zinc-800">
            <X size={15} />
          </button>
        </div>

        {/* Shows */}
        {prospect.shows?.length ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {prospect.shows.map(s => (
              <span key={s} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700/60 font-medium">
                📍 {s}
              </span>
            ))}
          </div>
        ) : null}

        {/* Primary contact */}
        {(prospect.contactName || prospect.contactEmail) && (
          <div className="flex items-center gap-3 flex-wrap">
            {prospect.contactName && (
              <span className="text-[12px] font-semibold text-zinc-200">
                {prospect.contactName}
                {prospect.contactTitle && <span className="font-normal text-zinc-500"> · {prospect.contactTitle}</span>}
              </span>
            )}
            {prospect.contactEmail && (
              <a href={`mailto:${prospect.contactEmail}`} className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 hover:underline">
                <Mail size={10} />
                {prospect.contactEmail}
                {prospect.emailConfidence && (
                  <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceColor[prospect.emailConfidence] ?? "bg-zinc-800 text-zinc-400"}`}>
                    {prospect.emailConfidence}
                  </span>
                )}
              </a>
            )}
            <div className="flex items-center gap-2">
              {prospect.contactLinkedIn && (
                <a href={prospect.contactLinkedIn} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-400 transition-colors">
                  <Linkedin size={13} />
                </a>
              )}
              {prospect.website && (
                <a href={prospect.website} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-zinc-300 transition-colors">
                  <Globe size={13} />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-zinc-800 bg-zinc-900 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors ${
              activeTab === tab.key
                ? "text-white border-b-2 border-emerald-500"
                : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="p-5 space-y-5">

            {/* AI Company Brief */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} className="text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Company Brief</span>
              </div>
              {briefLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-3 bg-zinc-800 rounded animate-pulse" style={{ width: `${85 - i*10}%` }} />)}
                </div>
              ) : briefData?.brief ? (
                <p className="text-[13px] text-zinc-200 leading-relaxed">{briefData.brief.summary}</p>
              ) : (
                <p className="text-[12px] text-zinc-500 italic">Brief not available — click Research tab to trigger AI analysis.</p>
              )}
            </div>

            {/* Show Intel */}
            {briefData?.brief?.showIntel && (
              <div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/40">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar size={11} className="text-zinc-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Show Intel</span>
                </div>
                <p className="text-[12px] text-zinc-300 leading-relaxed">{briefData.brief.showIntel}</p>
              </div>
            )}

            {/* Why StageGate */}
            {briefData?.brief?.whyStageGate && (
              <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-700/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap size={11} className="text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Why StageGate</span>
                </div>
                <p className="text-[12px] text-emerald-200 leading-relaxed">{briefData.brief.whyStageGate}</p>
              </div>
            )}

            {/* Notes */}
            {prospect.notes && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Notes</span>
                <p className="text-[12px] text-zinc-400 leading-relaxed">{prospect.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── RESEARCH TAB ── */}
        {activeTab === "research" && (
          <div className="p-5 space-y-5">
            {/* Trigger research button */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                {researchData?.researchStatus === "done"
                  ? `Last researched ${researchData.updatedAt ? new Date(researchData.updatedAt).toLocaleDateString() : "recently"}`
                  : researchData?.researchStatus === "running"
                  ? "Research in progress…"
                  : "Not yet researched"}
              </span>
              <button
                onClick={() => triggerResearch.mutate({ prospectId: prospect.id })}
                disabled={triggerResearch.isPending || researchData?.researchStatus === "running"}
                className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded px-2.5 py-1.5 transition-colors disabled:opacity-40"
              >
                {triggerResearch.isPending ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Run Research
              </button>
            </div>

            {researchLoading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-24" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-full" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-4/5" />
                  </div>
                ))}
              </div>
            ) : research ? (
              <div className="space-y-5">

                {/* Company Overview */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 size={11} className="text-zinc-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Company Overview</span>
                  </div>
                  <p className="text-[13px] text-zinc-200 leading-relaxed">{research.companyOverview}</p>
                </div>

                {/* Robot Specs */}
                {research.robotSpecs && (
                  <div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/40">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Bot size={11} className="text-zinc-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Robot Specs — {research.robotSpecs.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Type", value: research.robotSpecs.type },
                        { label: "Payload", value: research.robotSpecs.payload },
                        { label: "Speed", value: research.robotSpecs.speed },
                        { label: "Battery", value: research.robotSpecs.battery },
                        { label: "Navigation", value: research.robotSpecs.navigation },
                      ].filter(r => r.value).map(row => (
                        <div key={row.label}>
                          <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{row.label}</span>
                          <p className="text-[12px] text-zinc-300 font-medium">{row.value}</p>
                        </div>
                      ))}
                    </div>
                    {research.robotSpecs.useCases?.length ? (
                      <div className="mt-3 pt-3 border-t border-zinc-700/40">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wide block mb-1.5">Use Cases</span>
                        <div className="flex flex-wrap gap-1.5">
                          {research.robotSpecs.useCases.map(uc => (
                            <span key={uc} className="text-[10px] bg-zinc-700/60 text-zinc-300 px-2 py-0.5 rounded border border-zinc-600/40">{uc}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Competitive Context */}
                {research.competitiveContext && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp size={11} className="text-zinc-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Competitive Context</span>
                    </div>
                    <p className="text-[12px] text-zinc-300 leading-relaxed">{research.competitiveContext}</p>
                  </div>
                )}

                {/* Decision Makers */}
                {research.decisionMakers?.length ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Users size={11} className="text-zinc-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Decision Makers</span>
                      <span className="text-[10px] text-zinc-600 ml-1">via Apollo.io</span>
                    </div>
                    <div className="space-y-2.5">
                      {research.decisionMakers.map((dm, i) => (
                        <div key={i} className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/40">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-semibold text-white">{dm.name}</div>
                              <div className="text-[11px] text-zinc-400 mt-0.5">{dm.title}</div>
                              {dm.email && (
                                <a href={`mailto:${dm.email}`} className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline mt-1">
                                  <Mail size={9} />
                                  {dm.email}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {dm.confidence && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceColor[dm.confidence] ?? "bg-zinc-800 text-zinc-400"}`}>
                                  {dm.confidence}
                                </span>
                              )}
                              {dm.linkedin && (
                                <a href={dm.linkedin} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-400">
                                  <Linkedin size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users size={24} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-[12px] text-zinc-500">No decision makers found yet.</p>
                    <p className="text-[11px] text-zinc-600 mt-1">Run Research to fetch contacts via Apollo.io</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <Sparkles size={28} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-[13px] text-zinc-400 font-medium">No research data yet</p>
                <p className="text-[12px] text-zinc-600 mt-1 mb-4">The nightly job will research this company automatically, or click Run Research now.</p>
                <button
                  onClick={() => triggerResearch.mutate({ prospectId: prospect.id })}
                  disabled={triggerResearch.isPending}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-40"
                >
                  {triggerResearch.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Run Research Now
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── EMAIL TAB ── */}
        {activeTab === "email" && (
          <div className="p-5 space-y-4">
            {/* Tone + Regenerate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={12} className="text-zinc-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Intro Email Draft</span>
                {draftEdited && (
                  <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 rounded">Edited</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value as typeof tone)}
                  className="text-[10px] border border-zinc-700 rounded px-1.5 py-1 bg-zinc-800 text-zinc-300 focus:outline-none focus:border-zinc-500"
                  disabled={regenerating}
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="concise">Concise</option>
                  <option value="bold">Bold</option>
                </select>
                <button
                  onClick={() => regenerateDraft.mutate({ id: prospect.id, tone })}
                  disabled={regenerating || briefLoading}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded px-2 py-1 transition-colors disabled:opacity-40"
                >
                  {regenerating ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  Regenerate
                </button>
              </div>
            </div>

            {/* Draft textarea */}
            {(briefLoading || regenerating) ? (
              <div className="space-y-2 p-3 bg-zinc-800/60 rounded-lg border border-zinc-700/40">
                {[1,2,3,4,5].map(i => <div key={i} className="h-3 bg-zinc-700 rounded animate-pulse" style={{ width: `${90 - i*5}%` }} />)}
                {regenerating && (
                  <p className="text-[11px] text-amber-400 pt-1 flex items-center gap-1">
                    <Sparkles size={10} />
                    Rewriting draft…
                  </p>
                )}
              </div>
            ) : (
              <textarea
                className="w-full h-52 text-[13px] text-zinc-200 leading-relaxed border border-zinc-700 rounded-lg p-3.5 resize-none focus:outline-none focus:border-emerald-500 bg-zinc-800/60 placeholder:text-zinc-600"
                value={draftMessage}
                placeholder="AI draft will appear here once brief loads…"
                onChange={e => { setDraftMessage(e.target.value); setDraftEdited(true); }}
              />
            )}

            {/* Signup link reminder */}
            <div className="flex items-start gap-2 bg-zinc-800/40 rounded-lg p-3 border border-zinc-700/40">
              <Globe size={12} className="text-zinc-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-zinc-400">Registration link included in draft:</p>
                <a href="/get-started" target="_blank" className="text-[11px] text-blue-400 hover:underline font-mono">
                  onstage.bot/get-started
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === "activity" && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={12} className="text-zinc-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Activity Timeline</span>
            </div>

            {activitiesLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-zinc-700 mt-1.5 shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
                      <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (activitiesData as typeof activitiesData & { length?: number })?.length ? (
              <div className="space-y-1">
                {(activitiesData as Array<{id: number; type: string; title: string; description?: string | null; createdAt: string | Date}>).map((act: {
                  id: number;
                  type: string;
                  title: string;
                  description?: string | null;
                  createdAt: string | Date;
                }) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    email_sent:           <Send size={10} className="text-blue-400" />,
                    stage_changed:        <ArrowRight size={10} className="text-emerald-400" />,
                    follow_up_scheduled:  <Clock size={10} className="text-amber-400" />,
                    note_added:           <FileText size={10} className="text-zinc-400" />,
                    call_scheduled:       <Phone size={10} className="text-violet-400" />,
                    replied:              <CheckCircle2 size={10} className="text-emerald-400" />,
                  };
                  const dotColor: Record<string, string> = {
                    email_sent:           "bg-blue-500",
                    stage_changed:        "bg-emerald-500",
                    follow_up_scheduled:  "bg-amber-500",
                    note_added:           "bg-zinc-500",
                    call_scheduled:       "bg-violet-500",
                    replied:              "bg-emerald-500",
                  };
                  return (
                    <div key={act.id} className="flex gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor[act.type] ?? "bg-zinc-600"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[12px] font-semibold text-zinc-200">{act.title}</span>
                          <span className="text-[10px] text-zinc-600 shrink-0 font-mono">
                            {new Date(act.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{act.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <Activity size={24} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-[12px] text-zinc-500">No activity yet</p>
                <p className="text-[11px] text-zinc-600 mt-1">Actions like sending emails and stage changes will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-900 space-y-2.5">
        {/* Primary: Send Draft */}
        <button
          onClick={() => { setActiveTab("email"); handleSendDraft(); }}
          disabled={generateDraft.isPending || briefLoading || sendSuccess}
          className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 text-[13px] font-bold transition-all duration-300 disabled:cursor-not-allowed ${
            sendSuccess
              ? "bg-emerald-600 text-white scale-[0.98]"
              : "bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-40"
          }`}
        >
          {generateDraft.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : sendSuccess ? (
            <Check size={14} />
          ) : (
            <Send size={14} />
          )}
          {sendSuccess ? "Queued!" : "Send Intro Email to Outreach Queue"}
        </button>

        {/* Secondary row */}
        <div className="grid grid-cols-2 gap-2">
          {nextStage ? (
            <button
              onClick={handleAdvanceStage}
              disabled={updateStatus.isPending}
              className="flex items-center justify-center gap-1.5 border border-zinc-700 hover:border-zinc-500 rounded-lg py-2.5 text-[12px] font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight size={13} />
              Advance to {nextStage.label}
            </button>
          ) : (
            <div />
          )}
          <Link href="/admin/outreach">
            <button className="w-full flex items-center justify-center gap-1.5 border border-zinc-700 hover:border-zinc-500 rounded-lg py-2.5 text-[12px] font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
              <ExternalLink size={13} />
              View Outreach
            </button>
          </Link>
        </div>
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPipeline() {
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [filterShow, setFilterShow] = useState<string>("all");
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({});
  const [activeDragProspect, setActiveDragProspect] = useState<Prospect | null>(null);
  const [overColumnKey, setOverColumnKey] = useState<string | null>(null);

  const ctx = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.prospects.list.useQuery(
    {},
    { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 30_000 }
  );

  const updateStatus = trpc.prospects.bulkUpdateStatus.useMutation({
    onError: (e, vars) => {
      setStatusOverrides(prev => {
        const next = { ...prev };
        for (const id of vars.ids) delete next[id];
        return next;
      });
      toast.error(`Failed: ${e.message}`);
    },
    onSuccess: () => ctx.prospects.list.invalidate(),
  });

  const rawProspects = (data?.prospects ?? []) as unknown as Prospect[];

  const prospects = useMemo(() =>
    rawProspects.map(p => statusOverrides[p.id] !== undefined ? { ...p, status: statusOverrides[p.id] } : p),
    [rawProspects, statusOverrides]
  );

  const allShows = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) for (const s of p.shows ?? []) set.add(s);
    return Array.from(set).sort();
  }, [prospects]);

  const filtered = useMemo(() =>
    filterShow === "all" ? prospects : prospects.filter(p => p.shows?.includes(filterShow)),
    [prospects, filterShow]
  );

  const columns = useMemo(() =>
    PIPELINE_STAGES.map(stage => ({ ...stage, items: filtered.filter(p => p.status === stage.key) })),
    [filtered]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    const p = event.active.data.current?.prospect as Prospect | undefined;
    if (p) setActiveDragProspect(p);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as string | undefined;
    setOverColumnKey(overId?.startsWith("col-") ? overId.replace("col-", "") : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragProspect(null);
    setOverColumnKey(null);
    const { active, over } = event;
    if (!over) return;
    const overId = over.id as string;
    if (!overId.startsWith("col-")) return;
    const targetStatus = overId.replace("col-", "") as StageKey;
    const p = active.data.current?.prospect as Prospect | undefined;
    if (!p) return;
    const currentStatus = statusOverrides[p.id] ?? p.status;
    if (currentStatus === targetStatus) return;
    setStatusOverrides(prev => ({ ...prev, [p.id]: targetStatus }));
    setSelectedProspect(prev => prev?.id === p.id ? { ...prev, status: targetStatus } : prev);
    updateStatus.mutate({ ids: [p.id], status: targetStatus });
    const targetLabel = PIPELINE_STAGES.find(s => s.key === targetStatus)?.label ?? targetStatus;
    toast.success(`${p.company} → ${targetLabel}`);
  }

  const totalByStage = useMemo(() =>
    Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, filtered.filter(p => p.status === s.key).length])),
    [filtered]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-600" size={24} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        <div className="pt-32 text-center">
          <a href={getLoginUrl()} className="text-blue-400 underline text-sm">Sign in to continue</a>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        <div className="pt-32 text-center text-sm text-zinc-500">Admin access required.</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* ── Top bar ── */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0 bg-zinc-900">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-[15px] font-bold text-white">Pipeline</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">Revenue funnel · {filtered.length} companies</p>
          </div>
          {/* Funnel summary */}
          <div className="hidden lg:flex items-center gap-1 text-[11px]">
            {PIPELINE_STAGES.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className="text-zinc-400 font-mono tabular-nums">{totalByStage[s.key] ?? 0}</span>
                <span className="text-zinc-600">{s.label}</span>
                {i < PIPELINE_STAGES.length - 1 && <ChevronRight size={10} className="text-zinc-700 mx-0.5" />}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterShow}
            onChange={e => setFilterShow(e.target.value)}
            className="text-[11px] border border-zinc-700 rounded-md px-2.5 py-1.5 bg-zinc-800 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <option value="all">All Events</option>
            {allShows.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => refetch()}
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded hover:bg-zinc-800"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Board ── */}
      <div className={`flex-1 flex overflow-hidden transition-all ${selectedProspect ? "mr-[500px]" : ""}`}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(0, 1fr))` }}>
            {columns.map(col => (
              <DroppableColumn
                key={col.key}
                stageKey={col.key}
                label={col.label}
                color={col.color}
                dot={col.dot}
                items={col.items}
                isLoading={isLoading}
                isOver={overColumnKey === col.key}
                selectedId={selectedProspect?.id ?? null}
                draggingId={activeDragProspect?.id ?? null}
                onCardClick={p => setSelectedProspect(prev => prev?.id === p.id ? null : p)}
                onCreated={() => refetch()}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragProspect && <DragOverlayCard prospect={activeDragProspect} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── CRM Panel ── */}
      {selectedProspect && (
        <CRMPanel
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onStatusChange={(id, status) => {
            setStatusOverrides(prev => ({ ...prev, [id]: status }));
            setSelectedProspect(prev => prev?.id === id ? { ...prev, status } : prev);
          }}
        />
      )}
    </main>
  );
}
