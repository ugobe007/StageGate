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
import { Loader2, RefreshCw, Send, X, GripVertical, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "new",       label: "Prospects"  },
  { key: "contacted", label: "Contacted"  },
  { key: "responded", label: "Replied"    },
  { key: "scheduled", label: "Qualified"  },
  { key: "converted", label: "Jobs"       },
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

// ─── Operational context per show ─────────────────────────────────────────────

const SHOW_CONTEXT: Record<string, { need: string; risk: string }> = {
  "CES":      { need: "Robot receiving, unpacking, testing, staging, and delivery",        risk: "Last-minute booth failure, technician travel, calibration issues, shipping delays" },
  "MANIFEST": { need: "Warehouse automation demo setup and floor logistics",                risk: "Customs delays, floor space conflicts, safety certification" },
  "HIMSS":    { need: "Medical robot calibration, sterile handling, and delivery",          risk: "Regulatory compliance, sterile handling requirements" },
  "NAB":      { need: "Broadcast robot setup and AV integration",                          risk: "Cable management, live broadcast risk, last-minute AV failures" },
  "MODEX":    { need: "Material handling demo, forklift sync, and floor activation",       risk: "Floor space conflicts, safety certification, heavy equipment logistics" },
};

function getShowContext(shows: string[] | null) {
  if (!shows?.length) return { need: "Robot receiving, unpacking, testing, staging, and delivery", risk: "Last-minute booth failure, technician travel, calibration issues, shipping delays" };
  for (const show of shows) {
    for (const [key, ctx] of Object.entries(SHOW_CONTEXT)) {
      if (show.toUpperCase().includes(key)) return ctx;
    }
  }
  return { need: "Robot receiving, unpacking, testing, staging, and delivery", risk: "Last-minute booth failure, technician travel, calibration issues, shipping delays" };
}

function buildSuggestedMessage(prospect: Prospect): string {
  const event = prospect.shows?.[0] ?? "your upcoming event";
  const name = prospect.company;
  return `Hi ${name},\n\nWe help robotics teams arriving for ${event} receive, unpack, test, stage, and deliver their robots before the show floor opens.\n\nThis helps avoid last-minute failures, technician travel, and setup issues when the demo matters most.\n\nWould it be useful to schedule a quick StageGate intake call?`;
}

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

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-3 text-sm transition-colors select-none ${
        isDragging
          ? "opacity-40"
          : isSelected
          ? "border-neutral-900 bg-neutral-50"
          : "border-neutral-200 bg-white hover:border-neutral-900"
      }`}
    >
      {/* Drag handle + company name row */}
      <div className="flex items-start gap-1.5">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing shrink-0 focus:outline-none"
          onClick={e => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical size={13} />
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <div className="font-medium text-neutral-900 leading-tight truncate">{prospect.company}</div>
          {prospect.shows?.length ? (
            <div className="text-xs text-neutral-500 mt-0.5 truncate">
              {prospect.shows.slice(0, 2).join(", ")}
              {prospect.shows.length > 2 ? ` +${prospect.shows.length - 2}` : ""}
            </div>
          ) : null}
          {prospect.robotName && (
            <div className="text-xs text-neutral-400 mt-1 truncate">{prospect.robotName}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Overlay card shown while dragging
function DragOverlayCard({ prospect }: { prospect: Prospect }) {
  return (
    <div className="border border-neutral-900 rounded-lg p-3 text-sm bg-white shadow-lg w-52 rotate-1">
      <div className="font-medium text-neutral-900 leading-tight truncate">{prospect.company}</div>
      {prospect.shows?.length ? (
        <div className="text-xs text-neutral-500 mt-0.5 truncate">
          {prospect.shows.slice(0, 2).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

// ─── Inline Add Card Form ────────────────────────────────────────────────────

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
    onSuccess: () => {
      toast.success(`${company.trim()} added`);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    const name = company.trim();
    if (!name) return;
    create.mutate({
      company: name,
      shows: event.trim() ? [event.trim()] : undefined,
      status: stageKey as "new" | "contacted" | "responded" | "scheduled" | "converted",
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="border border-neutral-900 rounded-lg p-2.5 bg-white space-y-1.5">
      <input
        ref={inputRef}
        value={company}
        onChange={e => setCompany(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Company name"
        className="w-full text-sm border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
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
          className="px-2.5 border border-neutral-200 rounded text-xs text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
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
    <div className="flex flex-col border-r border-neutral-200 last:border-r-0">
      {/* Column header */}
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-900">{label}</h2>
        <span className="text-xs text-neutral-500 tabular-nums">{items.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 space-y-2 transition-colors ${
          isOver ? "bg-neutral-50" : "bg-white"
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 size={16} className="animate-spin text-neutral-300" />
          </div>
        ) : items.length === 0 ? (
          <div className={`text-xs text-center pt-8 transition-colors ${isOver ? "text-neutral-500" : "text-neutral-300"}`}>
            {isOver ? "Drop here" : "No companies"}
          </div>
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
        {/* Extra drop target at bottom when column has items */}
        {items.length > 0 && isOver && (
          <div className="h-10 border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center text-xs text-neutral-400">
            Drop here
          </div>
        )}

        {/* Inline add form */}
        {adding ? (
          <AddCardForm
            stageKey={stageKey}
            onCreated={() => { setAdding(false); onCreated(); }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 py-1.5 px-1 rounded hover:bg-neutral-50 transition-colors"
          >
            <Plus size={12} />
            Add Company
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function PipelineDetailPanel({
  prospect,
  onClose,
  onStatusChange,
}: {
  prospect: Prospect;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [message, setMessage] = useState(() => buildSuggestedMessage(prospect));
  const [sending, setSending] = useState(false);

  const ctx = trpc.useUtils();
  const showCtx = getShowContext(prospect.shows);
  const stageLabel = PIPELINE_STAGES.find(s => s.key === prospect.status)?.label ?? prospect.status;

  const updateStatus = trpc.prospects.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      ctx.prospects.list.invalidate();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateDraft = trpc.admin.generateDrafts.useMutation({
    onSuccess: () => {
      toast.success("Draft generated — go to Outreach to review and send");
      setSending(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setSending(false);
    },
  });

  function handleSendMessage() {
    if (!prospect.contactEmail) {
      toast.error("No email address on file for this prospect");
      return;
    }
    setSending(true);
    generateDraft.mutate({ prospectIds: [prospect.id] });
  }

  function handleMarkQualified() {
    updateStatus.mutate({ ids: [prospect.id], status: "scheduled" });
    onStatusChange(prospect.id, "scheduled");
  }

  return (
    <aside className="fixed right-0 top-0 h-full w-[420px] border-l border-neutral-200 bg-white p-6 shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{prospect.company}</h2>
          <p className="text-sm text-neutral-500">
            {prospect.shows?.join(", ") ?? "No event assigned"}
            {prospect.hqCountry ? ` · ${prospect.hqCountry}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 mt-0.5" aria-label="Close panel">
          <X size={16} />
        </button>
      </div>

      {/* Current Stage */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Current Stage</h3>
        <div className="border border-neutral-200 rounded-md p-3 text-sm capitalize text-neutral-800">{stageLabel}</div>
      </section>

      {/* Robot */}
      {(prospect.robotName || prospect.robotType) && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Robot</h3>
          <div className="border border-neutral-200 rounded-md p-3 text-sm text-neutral-800 space-y-1">
            {prospect.robotName && <div className="font-medium">{prospect.robotName}</div>}
            {prospect.robotType && <div className="text-neutral-500">{prospect.robotType}</div>}
          </div>
        </section>
      )}

      {/* Operational Context */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Operational Context</h3>
        <div className="space-y-2 text-sm text-neutral-700">
          <p><span className="font-medium text-neutral-900">Likely need:</span> {showCtx.need}.</p>
          <p><span className="font-medium text-neutral-900">Risk:</span> {showCtx.risk}.</p>
          <p><span className="font-medium text-neutral-900">Recommended offer:</span> StageGate intake and event-readiness support.</p>
        </div>
      </section>

      {/* Contact */}
      {(prospect.contactName || prospect.contactEmail) && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Contact</h3>
          <div className="text-sm text-neutral-700 space-y-1">
            {prospect.contactName && (
              <div>
                <span className="font-medium text-neutral-900">{prospect.contactName}</span>
                {prospect.contactTitle && <span className="text-neutral-500"> · {prospect.contactTitle}</span>}
              </div>
            )}
            {prospect.contactEmail && (
              <a href={`mailto:${prospect.contactEmail}`} className="text-blue-600 hover:underline text-xs">{prospect.contactEmail}</a>
            )}
          </div>
        </section>
      )}

      {/* Suggested Message */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Suggested Message</h3>
        <textarea
          className="w-full h-44 border border-neutral-200 rounded-md p-3 text-sm resize-none focus:outline-none focus:border-neutral-900 bg-white text-neutral-800 leading-relaxed"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </section>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleSendMessage}
          disabled={sending || generateDraft.isPending}
          className="border border-neutral-900 text-neutral-900 rounded-md py-2 text-sm hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {(sending || generateDraft.isPending) ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Send Message
        </button>
        <Link href="/admin/outreach">
          <button className="w-full bg-neutral-900 text-white rounded-md py-2 text-sm hover:bg-neutral-800">Create Job</button>
        </Link>
        <button
          onClick={() => toast.info("Schedule call — coming soon")}
          className="border border-neutral-200 rounded-md py-2 text-sm hover:border-neutral-900 text-neutral-700"
        >
          Schedule Call
        </button>
        <button
          onClick={handleMarkQualified}
          disabled={updateStatus.isPending || prospect.status === "scheduled" || prospect.status === "converted"}
          className="border border-neutral-200 rounded-md py-2 text-sm hover:border-neutral-900 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Mark Qualified
        </button>
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPipeline() {
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [filterShow, setFilterShow] = useState<string>("all");
  // Local status overrides for optimistic DnD updates
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({});
  // Active drag state
  const [activeDragProspect, setActiveDragProspect] = useState<Prospect | null>(null);
  const [overColumnKey, setOverColumnKey] = useState<string | null>(null);

  const ctx = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.prospects.list.useQuery(
    {},
    { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 30_000 }
  );

  const updateStatus = trpc.prospects.bulkUpdateStatus.useMutation({
    onError: (e, vars) => {
      // Rollback optimistic update
      setStatusOverrides(prev => {
        const next = { ...prev };
        for (const id of vars.ids) delete next[id];
        return next;
      });
      toast.error(`Failed to move card: ${e.message}`);
    },
    onSuccess: () => {
      ctx.prospects.list.invalidate();
    },
  });

  const rawProspects = (data?.prospects ?? []) as unknown as Prospect[];

  // Apply local status overrides for optimistic DnD
  const prospects = useMemo(() => {
    return rawProspects.map(p =>
      statusOverrides[p.id] !== undefined ? { ...p, status: statusOverrides[p.id] } : p
    );
  }, [rawProspects, statusOverrides]);

  // Collect unique shows for filter
  const allShows = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) for (const s of p.shows ?? []) set.add(s);
    return Array.from(set).sort();
  }, [prospects]);

  // Filter by show
  const filtered = useMemo(() => {
    if (filterShow === "all") return prospects;
    return prospects.filter(p => p.shows?.includes(filterShow));
  }, [prospects, filterShow]);

  // Group by pipeline stage
  const columns = useMemo(() => {
    return PIPELINE_STAGES.map(stage => ({
      ...stage,
      items: filtered.filter(p => p.status === stage.key),
    }));
  }, [filtered]);

  // DnD sensors — require 8px movement before drag starts (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const prospect = event.active.data.current?.prospect as Prospect | undefined;
    if (prospect) setActiveDragProspect(prospect);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as string | undefined;
    if (overId?.startsWith("col-")) {
      setOverColumnKey(overId.replace("col-", ""));
    } else {
      setOverColumnKey(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragProspect(null);
    setOverColumnKey(null);

    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    if (!overId.startsWith("col-")) return;

    const targetStatus = overId.replace("col-", "") as StageKey;
    const prospect = active.data.current?.prospect as Prospect | undefined;
    if (!prospect) return;

    // No-op if same column
    const currentStatus = statusOverrides[prospect.id] ?? prospect.status;
    if (currentStatus === targetStatus) return;

    // Optimistic update
    setStatusOverrides(prev => ({ ...prev, [prospect.id]: targetStatus }));

    // Update selected panel if it's the dragged card
    setSelectedProspect(prev =>
      prev?.id === prospect.id ? { ...prev, status: targetStatus } : prev
    );

    // Sync to Supabase
    updateStatus.mutate({ ids: [prospect.id], status: targetStatus });

    const targetLabel = PIPELINE_STAGES.find(s => s.key === targetStatus)?.label ?? targetStatus;
    toast.success(`${prospect.company} → ${targetLabel}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-neutral-400" size={28} />
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
    <main className="min-h-screen bg-white text-neutral-900">
      {/* Header */}
      <div className="border-b border-neutral-200 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Pipeline</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Track how prospects turn into StageGate jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterShow}
            onChange={e => setFilterShow(e.target.value)}
            className="text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          >
            <option value="all">All Events</option>
            {allShows.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => refetch()}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded hover:bg-neutral-100"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <Link href="/admin/outreach">
            <Button size="sm" className="bg-neutral-900 text-white hover:bg-neutral-800 text-xs gap-1.5">
              <Send size={12} /> Outreach
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-0 h-[calc(100vh-89px)] overflow-hidden">
          {columns.map(col => (
            <DroppableColumn
              key={col.key}
              stageKey={col.key}
              label={col.label}
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

        {/* Drag overlay — floating card while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeDragProspect ? <DragOverlayCard prospect={activeDragProspect} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Side panel */}
      {selectedProspect && (
        <>
          <div className="fixed inset-0 bg-black/10 z-40" onClick={() => setSelectedProspect(null)} />
          <PipelineDetailPanel
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
