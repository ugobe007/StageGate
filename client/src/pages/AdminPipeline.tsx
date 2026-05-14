import { useState, useMemo, useRef, useEffect } from "react";
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
  Sparkles, ChevronRight, ExternalLink,
} from "lucide-react";

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "new",       label: "Prospects",  color: "bg-slate-100 text-slate-600"   },
  { key: "contacted", label: "Contacted",  color: "bg-blue-50 text-blue-600"      },
  { key: "responded", label: "Replied",    color: "bg-amber-50 text-amber-600"    },
  { key: "scheduled", label: "Qualified",  color: "bg-emerald-50 text-emerald-600"},
  { key: "converted", label: "Jobs",       color: "bg-violet-50 text-violet-600"  },
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
      style={{ ...style, borderColor: isSelected ? "#111" : undefined }}
      className={`group rounded-lg border text-sm transition-all select-none ${
        isDragging
          ? "opacity-30"
          : isSelected
          ? "bg-white shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-sm"
      }`}
    >
      <div className="p-3">
        {/* Drag handle row */}
        <div className="flex items-start gap-1.5">
          <button
            {...listeners}
            {...attributes}
            className="mt-0.5 text-neutral-200 hover:text-neutral-400 cursor-grab active:cursor-grabbing shrink-0 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
            aria-label="Drag"
          >
            <GripVertical size={12} />
          </button>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
            <div className="font-semibold text-neutral-900 leading-tight truncate text-[13px]">
              {prospect.company}
            </div>
            {prospect.robotName && (
              <div className="flex items-center gap-1 mt-1">
                <Bot size={10} className="text-neutral-400 shrink-0" />
                <span className="text-[11px] text-neutral-500 truncate">{prospect.robotName}</span>
              </div>
            )}
            {prospect.shows?.length ? (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {prospect.shows.slice(0, 2).map(s => (
                  <span key={s} className="inline-block bg-neutral-100 text-neutral-600 text-[10px] px-1.5 py-0.5 rounded font-medium">
                    {s}
                  </span>
                ))}
                {prospect.shows.length > 2 && (
                  <span className="text-[10px] text-neutral-400">+{prospect.shows.length - 2}</span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {prospect.hqCountry && (
        <div className="px-3 pb-2.5 flex items-center gap-1">
          <MapPin size={9} className="text-neutral-300" />
          <span className="text-[10px] text-neutral-400">{prospect.hqCountry}</span>
        </div>
      )}
    </div>
  );
}

function DragOverlayCard({ prospect }: { prospect: Prospect }) {
  return (
    <div className="border border-neutral-900 rounded-lg p-3 text-sm bg-white shadow-xl w-52 rotate-1">
      <div className="font-semibold text-neutral-900 text-[13px] truncate">{prospect.company}</div>
      {prospect.robotName && (
        <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{prospect.robotName}</div>
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
    <div className="border border-neutral-900 rounded-lg p-2.5 bg-white space-y-1.5 shadow-sm">
      <input
        ref={inputRef}
        value={company}
        onChange={e => setCompany(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Company name"
        className="w-full text-[13px] border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
      />
      <input
        value={event}
        onChange={e => setEvent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Event (e.g. CES 2026)"
        className="w-full text-xs border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
      />
      <div className="flex gap-1.5 pt-0.5">
        <button
          onClick={handleSubmit}
          disabled={!company.trim() || create.isPending}
          className="flex-1 flex items-center justify-center gap-1 bg-neutral-900 text-white rounded py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {create.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-2.5 border border-neutral-200 rounded text-xs text-neutral-500 hover:border-neutral-900"
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
    <div className="flex flex-col border-r border-neutral-100 last:border-r-0 min-w-0">
      {/* Column header */}
      <div className="px-3 py-3 border-b border-neutral-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
        </div>
        <span className="text-xs text-neutral-400 tabular-nums shrink-0">{items.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-1.5 transition-colors ${
          isOver ? "bg-neutral-50" : "bg-white"
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 size={14} className="animate-spin text-neutral-300" />
          </div>
        ) : items.length === 0 && !isOver ? (
          <div className="text-[11px] text-center pt-10 text-neutral-300">Empty</div>
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
          <div className="h-8 border-2 border-dashed border-neutral-200 rounded-lg" />
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
            className="w-full flex items-center gap-1.5 text-[11px] text-neutral-300 hover:text-neutral-600 py-1.5 px-1 rounded hover:bg-neutral-50 transition-colors"
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
  const stage = PIPELINE_STAGES.find(s => s.key === prospect.status);
  const nextStage = PIPELINE_STAGES[PIPELINE_STAGES.findIndex(s => s.key === prospect.status) + 1];

  // AI brief — auto-fetches on open
  const { data: briefData, isLoading: briefLoading, error: briefError } = trpc.prospects.getBrief.useQuery(
    { id: prospect.id },
    { staleTime: 5 * 60 * 1000 } // cache for 5 min
  );

  const [draftMessage, setDraftMessage] = useState<string>("");
  const [draftEdited, setDraftEdited] = useState(false);

  // Populate draft from AI brief once loaded
  useEffect(() => {
    if (briefData?.brief?.draftMessage && !draftEdited) {
      setDraftMessage(briefData.brief.draftMessage);
    }
  }, [briefData, draftEdited]);

  // Reset draft when prospect changes
  useEffect(() => {
    setDraftMessage("");
    setDraftEdited(false);
  }, [prospect.id]);

  const updateStatus = trpc.prospects.bulkUpdateStatus.useMutation({
    onSuccess: () => { ctx.prospects.list.invalidate(); toast.success("Stage updated"); },
    onError: (e) => toast.error(e.message),
  });

  const generateDraft = trpc.admin.generateDrafts.useMutation({
    onSuccess: () => toast.success("Draft queued in Outreach"),
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

  const confidenceColor: Record<string, string> = {
    verified: "text-emerald-600 bg-emerald-50",
    high:     "text-blue-600 bg-blue-50",
    medium:   "text-amber-600 bg-amber-50",
    low:      "text-red-500 bg-red-50",
  };

  return (
    <aside className="fixed right-0 top-0 h-full w-[480px] bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* ── Header / Business Card ── */}
      <div className="px-6 pt-6 pb-5 border-b border-neutral-100">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stage?.color ?? "bg-neutral-100 text-neutral-500"}`}>
                {stage?.label ?? prospect.status}
              </span>
              {nextStage && (
                <button
                  onClick={handleAdvanceStage}
                  disabled={updateStatus.isPending}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors"
                >
                  <ArrowRight size={11} />
                  Move to {nextStage.label}
                </button>
              )}
            </div>
            <h2 className="text-xl font-bold text-neutral-900 leading-tight truncate">{prospect.company}</h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {prospect.robotName && (
                <span className="flex items-center gap-1 text-[12px] text-neutral-500">
                  <Bot size={11} className="text-neutral-400" />
                  {prospect.robotName}
                  {prospect.robotType && <span className="text-neutral-400">· {prospect.robotType}</span>}
                </span>
              )}
              {prospect.hqCountry && (
                <span className="flex items-center gap-1 text-[12px] text-neutral-400">
                  <MapPin size={10} />
                  {prospect.hqCountry}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-300 hover:text-neutral-700 ml-3 mt-0.5 shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Shows */}
        {prospect.shows?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {prospect.shows.map(s => (
              <span key={s} className="text-[11px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded font-medium">
                {s}
              </span>
            ))}
          </div>
        ) : null}

        {/* Contact row */}
        {(prospect.contactName || prospect.contactEmail) && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {prospect.contactName && (
              <span className="text-[12px] font-medium text-neutral-800">
                {prospect.contactName}
                {prospect.contactTitle && <span className="font-normal text-neutral-500"> · {prospect.contactTitle}</span>}
              </span>
            )}
            {prospect.contactEmail && (
              <a
                href={`mailto:${prospect.contactEmail}`}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <Mail size={10} />
                {prospect.contactEmail}
                {prospect.emailConfidence && (
                  <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceColor[prospect.emailConfidence] ?? "bg-neutral-100 text-neutral-500"}`}>
                    {prospect.emailConfidence}
                  </span>
                )}
              </a>
            )}
            {prospect.contactLinkedIn && (
              <a href={prospect.contactLinkedIn} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-blue-600">
                <Linkedin size={12} />
              </a>
            )}
            {prospect.website && (
              <a href={prospect.website} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-neutral-700">
                <Globe size={12} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* AI Brief */}
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Company Brief</span>
          </div>

          {briefLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-full" />
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-4/5" />
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-3/5" />
            </div>
          ) : briefError ? (
            <p className="text-[12px] text-red-500">Could not generate brief. Check API connection.</p>
          ) : briefData?.brief ? (
            <div className="space-y-3">
              <p className="text-[13px] text-neutral-700 leading-relaxed">{briefData.brief.summary}</p>
              <div className="bg-neutral-50 rounded-lg p-3 space-y-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">Show Intel</span>
                  <p className="text-[12px] text-neutral-600 leading-relaxed">{briefData.brief.showIntel}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">Why StageGate</span>
                  <p className="text-[12px] text-neutral-600 leading-relaxed">{briefData.brief.whyStageGate}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Draft Message */}
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Send size={12} className="text-neutral-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Draft Message</span>
            </div>
            {draftEdited && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Edited</span>
            )}
          </div>

          {briefLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-full" />
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-5/6" />
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-4/6" />
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-full" />
            </div>
          ) : (
            <textarea
              className="w-full h-44 text-[13px] text-neutral-800 leading-relaxed border border-neutral-200 rounded-lg p-3 resize-none focus:outline-none focus:border-neutral-900 bg-white placeholder:text-neutral-400"
              value={draftMessage}
              placeholder="AI draft will appear here once brief loads…"
              onChange={e => { setDraftMessage(e.target.value); setDraftEdited(true); }}
            />
          )}
        </div>

        {/* Notes */}
        {prospect.notes && (
          <div className="px-6 py-4 border-b border-neutral-100">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1.5">Notes</span>
            <p className="text-[12px] text-neutral-600 leading-relaxed">{prospect.notes}</p>
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="px-6 py-4 border-t border-neutral-100 bg-white space-y-2">
        {/* Primary: Send Draft */}
        <button
          onClick={handleSendDraft}
          disabled={generateDraft.isPending || briefLoading}
          className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white rounded-lg py-2.5 text-[13px] font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {generateDraft.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Send Draft to Outreach Queue
        </button>

        {/* Secondary row */}
        <div className="grid grid-cols-2 gap-2">
          {nextStage ? (
            <button
              onClick={handleAdvanceStage}
              disabled={updateStatus.isPending}
              className="flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-[12px] text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50 transition-colors"
            >
              <ChevronRight size={12} />
              Advance to {nextStage.label}
            </button>
          ) : (
            <div />
          )}
          <Link href="/admin/outreach">
            <button className="w-full flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg py-2 text-[12px] text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50 transition-colors">
              <ExternalLink size={12} />
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

  // Funnel totals
  const totalByStage = useMemo(() =>
    Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, filtered.filter(p => p.status === s.key).length])),
    [filtered]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-neutral-300" size={24} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 text-center">
          <a href={getLoginUrl()} className="text-blue-600 underline text-sm">Sign in to continue</a>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="pt-32 text-center text-sm text-neutral-500">Admin access required.</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900 flex flex-col">
      {/* ── Top bar ── */}
      <div className="border-b border-neutral-100 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-[15px] font-bold text-neutral-900">Pipeline</h1>
            <p className="text-[11px] text-neutral-400 mt-0.5">Revenue funnel · {filtered.length} companies</p>
          </div>
          {/* Funnel summary */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-neutral-500">
            {PIPELINE_STAGES.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${s.color}`}>
                  {totalByStage[s.key] ?? 0}
                </span>
                <span className="text-neutral-400">{s.label}</span>
                {i < PIPELINE_STAGES.length - 1 && <ChevronRight size={10} className="text-neutral-300 mx-0.5" />}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterShow}
            onChange={e => setFilterShow(e.target.value)}
            className="text-[11px] border border-neutral-200 rounded-md px-2.5 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          >
            <option value="all">All Events</option>
            {allShows.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => refetch()}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded hover:bg-neutral-100"
            aria-label="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-0 h-full">
            {columns.map(col => (
              <DroppableColumn
                key={col.key}
                stageKey={col.key}
                label={col.label}
                color={col.color}
                items={col.items}
                isLoading={isLoading}
                isOver={overColumnKey === col.key}
                selectedId={selectedProspect?.id ?? null}
                draggingId={activeDragProspect?.id ?? null}
                onCardClick={p => setSelectedProspect(p)}
                onCreated={() => ctx.prospects.list.invalidate()}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragProspect ? <DragOverlayCard prospect={activeDragProspect} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── CRM Panel ── */}
      {selectedProspect && (
        <>
          <div className="fixed inset-0 bg-black/5 z-40" onClick={() => setSelectedProspect(null)} />
          <CRMPanel
            prospect={selectedProspect}
            onClose={() => setSelectedProspect(null)}
            onStatusChange={(id, status) => {
              setStatusOverrides(prev => ({ ...prev, [id]: status }));
              setSelectedProspect(prev => prev?.id === id ? { ...prev, status } : prev);
            }}
          />
        </>
      )}
    </main>
  );
}
