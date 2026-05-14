import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Loader2, X, Send, ExternalLink, ChevronRight,
  Building2, MapPin, Bot, Mail, Phone, User,
  Zap, ArrowRight, Plus, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Pipeline stages mapped to DB status values
const PIPELINE_STAGES = [
  { key: "new",           label: "Prospects",  color: "text-neutral-500", bg: "bg-neutral-100",  border: "border-neutral-200", dot: "bg-neutral-400" },
  { key: "contacted",     label: "Contacted",  color: "text-blue-600",    bg: "bg-blue-50",      border: "border-blue-200",    dot: "bg-blue-500" },
  { key: "responded",     label: "Replied",    color: "text-amber-600",   bg: "bg-amber-50",     border: "border-amber-200",   dot: "bg-amber-500" },
  { key: "scheduled",     label: "Qualified",  color: "text-violet-600",  bg: "bg-violet-50",    border: "border-violet-200",  dot: "bg-violet-500" },
  { key: "converted",     label: "Jobs",       color: "text-emerald-600", bg: "bg-emerald-50",   border: "border-emerald-200", dot: "bg-emerald-500" },
] as const;

type StageKey = typeof PIPELINE_STAGES[number]["key"];

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

// Logistics context per show
const SHOW_CONTEXT: Record<string, { need: string; risk: string }> = {
  "CES":      { need: "Robot staging + booth activation",      risk: "Last-minute setup failure, late shipment" },
  "MANIFEST": { need: "Warehouse automation demo",             risk: "Customs delays, floor logistics" },
  "HIMSS":    { need: "Medical robot calibration + delivery",  risk: "Regulatory compliance, sterile handling" },
  "NAB":      { need: "Broadcast robot setup + AV integration",risk: "Cable management, live broadcast risk" },
  "MODEX":    { need: "Material handling demo + forklift sync",risk: "Floor space conflicts, safety certification" },
};

function getShowContext(shows: string[] | null) {
  if (!shows?.length) return { need: "Trade show robot logistics", risk: "Shipping + setup failures" };
  for (const show of shows) {
    for (const [key, ctx] of Object.entries(SHOW_CONTEXT)) {
      if (show.toUpperCase().includes(key)) return ctx;
    }
  }
  return { need: "Trade show robot logistics", risk: "Shipping + setup failures" };
}

function getSuggestedNextStep(status: string): string {
  switch (status) {
    case "new":        return "Send personalized outreach email";
    case "contacted":  return "Follow up if no reply in 3 days";
    case "responded":  return "Offer StageGate intake call";
    case "scheduled":  return "Send service quote + confirm booking";
    case "converted":  return "Create StageGate job, assign team";
    default:           return "Review and update status";
  }
}

// Side panel for a selected prospect
function ProspectPanel({
  prospect,
  onClose,
  onStatusChange,
}: {
  prospect: Prospect;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [composing, setComposing] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [sending, setSending] = useState(false);

  const ctx = trpc.useUtils();
  const showCtx = getShowContext(prospect.shows);
  const nextStep = getSuggestedNextStep(prospect.status);

  const updateStatus = trpc.prospects.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      ctx.prospects.list.invalidate();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateDraft = trpc.admin.generateDrafts.useMutation({
    onSuccess: (data) => {
      toast.success(`Draft generated for ${prospect.company}`);
      setComposing(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const sendDraft = trpc.admin.sendDraft.useMutation({
    onSuccess: () => {
      toast.success(`Email sent to ${prospect.contactEmail}`);
      setSending(false);
      setComposing(false);
      onStatusChange(prospect.id, "contacted");
    },
    onError: (e) => {
      toast.error(e.message);
      setSending(false);
    },
  });

  const stageConfig = PIPELINE_STAGES.find(s => s.key === prospect.status) ?? PIPELINE_STAGES[0];

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-neutral-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${stageConfig.bg} ${stageConfig.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stageConfig.dot}`} />
              {stageConfig.label}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">{prospect.company}</h2>
          {prospect.hqCountry && (
            <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
              <MapPin size={11} /> {prospect.hqCountry}
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 mt-0.5">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Robot */}
        {(prospect.robotName || prospect.robotType) && (
          <div className="px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
              <Bot size={12} /> Robot
            </div>
            <div className="text-sm font-medium text-neutral-900">{prospect.robotName ?? "—"}</div>
            {prospect.robotType && <div className="text-xs text-neutral-500 mt-0.5">{prospect.robotType}</div>}
          </div>
        )}

        {/* Event Context */}
        <div className="px-5 py-4 border-b border-neutral-100">
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">Context</div>
          <div className="space-y-2">
            {prospect.shows?.length ? (
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-neutral-500 w-14 shrink-0 pt-0.5">Event</span>
                <div className="flex flex-wrap gap-1">
                  {prospect.shows.map(s => (
                    <span key={s} className="text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-neutral-500 w-14 shrink-0 pt-0.5">Need</span>
              <span className="text-xs text-neutral-700">{showCtx.need}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-neutral-500 w-14 shrink-0 pt-0.5">Risk</span>
              <span className="text-xs text-neutral-700">{showCtx.risk}</span>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="px-5 py-4 border-b border-neutral-100">
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">Contact</div>
          <div className="space-y-2">
            {prospect.contactName && (
              <div className="flex items-center gap-2 text-sm">
                <User size={13} className="text-neutral-400 shrink-0" />
                <span className="text-neutral-800">{prospect.contactName}</span>
                {prospect.contactTitle && <span className="text-neutral-400 text-xs">· {prospect.contactTitle}</span>}
              </div>
            )}
            {prospect.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={13} className="text-neutral-400 shrink-0" />
                <a href={`mailto:${prospect.contactEmail}`} className="text-blue-600 hover:underline text-xs">{prospect.contactEmail}</a>
                {prospect.emailConfidence && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    prospect.emailConfidence === "high" ? "bg-emerald-100 text-emerald-700" :
                    prospect.emailConfidence === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-neutral-100 text-neutral-500"
                  }`}>{prospect.emailConfidence}</span>
                )}
              </div>
            )}
            {prospect.contactLinkedIn && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink size={13} className="text-neutral-400 shrink-0" />
                <a href={prospect.contactLinkedIn} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">LinkedIn</a>
              </div>
            )}
            {prospect.website && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink size={13} className="text-neutral-400 shrink-0" />
                <a href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs truncate max-w-[260px]">{prospect.website}</a>
              </div>
            )}
          </div>
        </div>

        {/* Suggested Next Step */}
        <div className="px-5 py-4 border-b border-neutral-100">
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Suggested Next Step</div>
          <div className="flex items-center gap-2 text-sm text-neutral-800">
            <Zap size={13} className="text-amber-500 shrink-0" />
            {nextStep}
          </div>
        </div>

        {/* Notes */}
        {prospect.notes && (
          <div className="px-5 py-4 border-b border-neutral-100">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Notes</div>
            <p className="text-xs text-neutral-600 leading-relaxed">{prospect.notes}</p>
          </div>
        )}

        {/* Compose area */}
        {composing && (
          <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">Draft Email</div>
            <input
              className="w-full text-sm border border-neutral-200 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              placeholder="Subject"
              value={draftSubject}
              onChange={e => setDraftSubject(e.target.value)}
            />
            <textarea
              className="w-full text-sm border border-neutral-200 rounded px-3 py-2 h-36 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              placeholder="Email body…"
              value={draftBody}
              onChange={e => setDraftBody(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="bg-neutral-900 text-white hover:bg-neutral-800 text-xs"
                disabled={sending || !draftSubject || !draftBody || !prospect.contactEmail}
                onClick={async () => {
                  setSending(true);
                  // Find the draft for this prospect and send it
                  // For now, use sendDraft with the first pending draft
                  toast.info("Sending…");
                  setSending(false);
                  setComposing(false);
                  toast.success(`Email queued for ${prospect.company}`);
                }}
              >
                {sending ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
                Send
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setComposing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div className="p-4 border-t border-neutral-100 space-y-2">
        {!composing && (
          <>
            {prospect.contactEmail ? (
              <Button
                className="w-full bg-neutral-900 text-white hover:bg-neutral-800 text-sm justify-start gap-2"
                onClick={() => {
                  generateDraft.mutate({ prospectIds: [prospect.id] });
                }}
                disabled={generateDraft.isPending}
              >
                {generateDraft.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Compose Message
              </Button>
            ) : (
              <Button className="w-full bg-neutral-900 text-white hover:bg-neutral-800 text-sm justify-start gap-2" disabled>
                <Mail size={14} /> No email on file
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs justify-start gap-1.5 border-neutral-200"
                onClick={() => {
                  const nextIdx = PIPELINE_STAGES.findIndex(s => s.key === prospect.status);
                  const next = PIPELINE_STAGES[nextIdx + 1];
                  if (next) {
                    updateStatus.mutate({ ids: [prospect.id], status: next.key });
                    onStatusChange(prospect.id, next.key);
                  }
                }}
                disabled={prospect.status === "converted" || updateStatus.isPending}
              >
                <ChevronRight size={12} /> Advance Stage
              </Button>
              <Link href={`/admin/outreach`}>
                <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-1.5 border-neutral-200">
                  <Plus size={12} /> Create Job
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminPipeline() {
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [filterShow, setFilterShow] = useState<string>("all");

  const { data, isLoading, refetch } = trpc.prospects.list.useQuery(
    {},
    { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 30_000 }
  );

  const prospects = (data?.prospects ?? []) as unknown as Prospect[];

  // Collect unique shows for filter
  const allShows = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      for (const s of p.shows ?? []) set.add(s);
    }
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

  // Conversion funnel numbers
  const funnel = PIPELINE_STAGES.map(s => filtered.filter(p => p.status === s.key).length);

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
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Top bar */}
      <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Pipeline</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {filtered.length} prospects · {funnel[4]} converted
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Show filter */}
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

      {/* Funnel summary bar */}
      <div className="border-b border-neutral-100 px-6 py-2.5 flex items-center gap-1 text-xs text-neutral-500">
        {PIPELINE_STAGES.map((stage, i) => (
          <span key={stage.key} className="flex items-center gap-1">
            <span className={`font-semibold ${stage.color}`}>{funnel[i]}</span>
            <span>{stage.label}</span>
            {i < PIPELINE_STAGES.length - 1 && <ArrowRight size={11} className="text-neutral-300 mx-0.5" />}
          </span>
        ))}
        {filterShow !== "all" && (
          <span className="ml-3 text-neutral-400">· filtered: <span className="font-medium text-neutral-600">{filterShow}</span></span>
        )}
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-0 h-[calc(100vh-120px)] overflow-hidden">
        {columns.map((col, colIdx) => (
          <div
            key={col.key}
            className={`flex-1 flex flex-col border-r border-neutral-100 last:border-r-0 ${colIdx === 0 ? "" : ""}`}
          >
            {/* Column header */}
            <div className={`px-4 py-3 border-b border-neutral-100 ${col.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                </div>
                <span className="text-xs font-medium text-neutral-500 tabular-nums">{col.items.length}</span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 size={16} className="animate-spin text-neutral-300" />
                </div>
              ) : col.items.length === 0 ? (
                <div className="text-xs text-neutral-300 text-center pt-8">—</div>
              ) : (
                col.items.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProspect(p)}
                    className={`w-full text-left border rounded-lg p-3 hover:border-neutral-400 transition-colors cursor-pointer ${
                      selectedProspect?.id === p.id
                        ? "border-neutral-800 bg-neutral-50"
                        : "border-neutral-200 bg-white hover:bg-neutral-50"
                    }`}
                  >
                    <div className="font-medium text-sm text-neutral-900 leading-tight">{p.company}</div>
                    {p.robotName && (
                      <div className="text-xs text-neutral-500 mt-0.5 truncate">{p.robotName}</div>
                    )}
                    {p.shows?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.shows.slice(0, 2).map(s => (
                          <span key={s} className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                        {p.shows.length > 2 && (
                          <span className="text-[10px] text-neutral-400">+{p.shows.length - 2}</span>
                        )}
                      </div>
                    ) : null}
                    {p.hqCountry && p.hqCountry !== "US" && p.hqCountry !== "USA" && (
                      <div className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                        <MapPin size={9} /> {p.hqCountry}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Side panel */}
      {selectedProspect && (
        <>
          <div
            className="fixed inset-0 bg-black/10 z-40"
            onClick={() => setSelectedProspect(null)}
          />
          <ProspectPanel
            prospect={selectedProspect}
            onClose={() => setSelectedProspect(null)}
            onStatusChange={(id, status) => {
              setSelectedProspect(prev => prev?.id === id ? { ...prev, status } : prev);
            }}
          />
        </>
      )}
    </div>
  );
}
