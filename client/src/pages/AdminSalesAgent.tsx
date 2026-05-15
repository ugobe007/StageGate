/**
 * client/src/pages/AdminSalesAgent.tsx
 *
 * Frank's Mission Control — Pipeline board + Pending Drafts review queue
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bot, Mail, Clock, MessageSquare,
  Zap, Send, RefreshCw, Eye, Users,
  TrendingUp, Calendar, Star, Cpu, Factory,
  CheckCircle, XCircle, Edit3, Inbox,
  ShieldCheck, Upload, FileText, Loader2,
  MousePointerClick
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const STAGES = [
  { id: "discovery",      label: "Discovered",     color: "bg-zinc-700 text-zinc-300" },
  { id: "intro_sent",     label: "Intro Sent",      color: "bg-blue-500/20 text-blue-400" },
  { id: "followup_1",     label: "Follow-up 1",     color: "bg-indigo-500/20 text-indigo-400" },
  { id: "followup_2",     label: "Follow-up 2",     color: "bg-violet-500/20 text-violet-400" },
  { id: "robot_guild",    label: "Robot Guild",     color: "bg-amber-500/20 text-amber-400" },
  { id: "responded",      label: "Responded",       color: "bg-emerald-500/20 text-emerald-400" },
  { id: "scheduling",     label: "Scheduling",      color: "bg-teal-500/20 text-teal-400" },
  { id: "booked",         label: "Booked",          color: "bg-emerald-600/20 text-emerald-300" },
  { id: "not_interested", label: "Not Interested",  color: "bg-zinc-600/40 text-zinc-500" },
  { id: "email_opened",  label: "Email Opened",    color: "bg-sky-500/20 text-sky-400" },
  { id: "link_clicked",  label: "Link Clicked",    color: "bg-cyan-500/20 text-cyan-400" },
  { id: "converted",      label: "Converted",       color: "bg-yellow-500/20 text-yellow-400" },
] as const;

type Stage = typeof STAGES[number]["id"];
const STAGE_MAP = Object.fromEntries(
  STAGES.map(s => [s.id, s])
) as Record<Stage, typeof STAGES[number]>;

function stageBadge(state: string) {
  const s = STAGE_MAP[state as Stage];
  if (!s) return <Badge className="bg-zinc-700 text-zinc-300 text-xs">{state}</Badge>;
  return <Badge className={`${s.color} text-xs border-0`}>{s.label}</Badge>;
}

function robotCategoryBadge(category: string | null | undefined) {
  if (!category || category === "light") return null;
  if (category === "heavy_industrial") {
    return (
      <Badge className="bg-orange-500/20 text-orange-400 text-xs border-0 gap-1">
        <Factory className="w-2.5 h-2.5" /> Heavy Industrial
      </Badge>
    );
  }
  return (
    <Badge className="bg-purple-500/20 text-purple-400 text-xs border-0 gap-1">
      <Cpu className="w-2.5 h-2.5" /> Mixed
    </Badge>
  );
}

function timeAgo(date: Date | string | null | undefined) {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TERMINAL = ["booked", "not_interested", "converted", "responded", "scheduling"];

function nextActionLabel(state: string, nextAt: Date | string | null | undefined) {
  if (TERMINAL.includes(state)) return null;
  if (!nextAt) return "Ready now";
  const d = new Date(nextAt);
  if (d <= new Date()) return "Ready now";
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return `In ${days}d`;
}

// ─── Preview Email Modal ──────────────────────────────────────────────────────
interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  prospectId: number | null;
  companyName: string;
  currentStage: string;
}

function PreviewEmailModal({ open, onClose, prospectId, companyName, currentStage }: PreviewModalProps) {
  const [selectedStage, setSelectedStage] = useState<string>(currentStage);
  const [preview, setPreview] = useState<{ subject: string; body: string; stage: string; nextStage: string } | null>(null);

  const previewMutation = trpc.salesAgent.previewEmail.useMutation({
    onSuccess: (data) => setPreview(data),
    onError: (err) => toast.error(`Preview failed: ${err.message}`),
  });

  const PREVIEW_STAGES = ["discovery", "intro_sent", "followup_1", "followup_2", "robot_guild"] as const;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setPreview(null); } }}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Eye className="w-4 h-4 text-amber-400" />
            Frank Email Preview — {companyName}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Generate a live LLM draft for any stage. This does not send anything.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 py-3 border-b border-zinc-800">
          <span className="text-xs text-zinc-500 whitespace-nowrap">Preview stage:</span>
          <div className="flex gap-1.5 flex-wrap">
            {PREVIEW_STAGES.map(s => {
              const stageInfo = STAGE_MAP[s];
              return (
                <button
                  key={s}
                  onClick={() => { setSelectedStage(s); setPreview(null); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedStage === s
                      ? (stageInfo?.color ?? "bg-zinc-700 text-white") + " ring-1 ring-current"
                      : "text-zinc-500 hover:text-zinc-300 bg-zinc-800"
                  }`}
                >
                  {stageInfo?.label ?? s}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            className="ml-auto bg-amber-500 hover:bg-amber-600 text-black font-medium gap-1.5 flex-shrink-0"
            disabled={previewMutation.isPending || !prospectId}
            onClick={() => {
              if (!prospectId) return;
              setPreview(null);
              previewMutation.mutate({
                prospectId,
                stage: selectedStage as "discovery" | "intro_sent" | "followup_1" | "followup_2" | "robot_guild",
              });
            }}
          >
            {previewMutation.isPending
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>
              : <><Zap className="w-3.5 h-3.5" /> Generate</>
            }
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {previewMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <p className="text-sm">Frank is thinking…</p>
            </div>
          )}
          {preview && !previewMutation.isPending && (
            <div className="space-y-4">
              <div className="bg-zinc-800/60 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Subject</span>
                  <div className="flex items-center gap-1.5">
                    {stageBadge(preview.stage)}
                    <span className="text-zinc-600 text-xs">→</span>
                    {stageBadge(preview.nextStage)}
                  </div>
                </div>
                <p className="text-white font-medium text-sm">{preview.subject}</p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-4 space-y-2">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Body</span>
                <pre className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{preview.body}</pre>
              </div>
              <p className="text-xs text-zinc-600 text-center">
                This is a live LLM draft. Use "Send Frank's Next Email" in the detail panel to actually send.
              </p>
            </div>
          )}
          {!preview && !previewMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-3">
              <Bot className="w-8 h-8" />
              <p className="text-sm">Select a stage and click Generate to see Frank's draft</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pending Drafts Tab ───────────────────────────────────────────────────────
function PendingDraftsTab() {
  const utils = trpc.useUtils();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [discardingId, setDiscardingId] = useState<number | null>(null);

  const { data: drafts = [], isLoading, refetch } = trpc.admin.getDrafts.useQuery(
    { statuses: ["pending"] }
  );

  const sendDraft = trpc.admin.sendDraft.useMutation({
    onSuccess: (data) => {
      toast.success(`Sent to ${(data as { sentTo?: string }).sentTo ?? "prospect"}`);
      setSendingId(null);
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Send failed: ${err.message}`);
      setSendingId(null);
    },
  });

  const editDraft = trpc.admin.editDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft updated");
      setEditingId(null);
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Edit failed: ${err.message}`);
    },
  });

  const discardDraft = trpc.admin.discardDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft discarded");
      setDiscardingId(null);
      utils.admin.getDraftCount.invalidate();
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Discard failed: ${err.message}`);
      setDiscardingId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading drafts…
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-600 gap-3">
        <Inbox className="w-10 h-10" />
        <p className="text-sm font-medium text-zinc-500">No pending drafts</p>
        <p className="text-xs text-center max-w-xs">
          When a prospect replies to Frank, an AI-generated response will appear here for your review before it goes out.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-zinc-400">
          <span className="text-white font-medium">{drafts.length}</span> draft{drafts.length !== 1 ? "s" : ""} awaiting review
        </p>
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {(drafts as Array<{ draft: { id: number; subject: string; body: string; createdAt: Date | string; agentReasoning?: string | null }; prospect: { id: number; company: string; contactEmail?: string | null; robotType?: string | null } }>).map(({ draft, prospect }) => (
        <div
          key={draft.id}
          className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
        >
          {/* Draft header */}
          <div className="px-5 py-4 border-b border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white text-sm">{prospect.company}</p>
                {prospect.contactEmail && (
                  <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {prospect.contactEmail}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0">Pending Reply</Badge>
                <span className="text-xs text-zinc-600">{timeAgo(draft.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Draft body */}
          <div className="px-5 py-4 space-y-3">
            {editingId === draft.id ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1">Subject</label>
                  <input
                    value={editSubject}
                    onChange={e => setEditSubject(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1">Body</label>
                  <Textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={10}
                    className="w-full bg-zinc-800 border-zinc-700 text-sm text-zinc-200 resize-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide block mb-1">Subject</span>
                  <p className="text-white font-medium text-sm">{draft.subject}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wide block mb-1">Body</span>
                  <pre className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">{draft.body}</pre>
                </div>
                {draft.agentReasoning && (
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <span className="text-xs text-zinc-600 uppercase tracking-wide block mb-1">Frank's Reasoning</span>
                    <p className="text-xs text-zinc-500 leading-relaxed">{draft.agentReasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-3 border-t border-zinc-800 flex items-center gap-2">
            {editingId === draft.id ? (
              <>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-black font-medium gap-1.5"
                  disabled={editDraft.isPending}
                  onClick={() => editDraft.mutate({ draftId: draft.id, subject: editSubject, body: editBody })}
                >
                  {editDraft.isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : "Save Changes"
                  }
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
                  disabled={sendingId === draft.id}
                  onClick={() => {
                    setSendingId(draft.id);
                    sendDraft.mutate({ draftId: draft.id });
                  }}
                >
                  {sendingId === draft.id
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                    : <><CheckCircle className="w-3.5 h-3.5" /> Approve & Send</>
                  }
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
                  onClick={() => {
                    setEditingId(draft.id);
                    setEditSubject(draft.subject);
                    setEditBody(draft.body);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-red-400 hover:bg-red-950/30 hover:border-red-800 gap-1.5 ml-auto"
                  disabled={discardingId === draft.id}
                  onClick={() => {
                    setDiscardingId(draft.id);
                    discardDraft.mutate({ draftId: draft.id });
                  }}
                >
                  {discardingId === draft.id
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Discarding…</>
                    : <><XCircle className="w-3.5 h-3.5" /> Discard</>
                  }
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminSalesAgent() {
  const [activeTab, setActiveTab] = useState<"pipeline" | "drafts">("pipeline");
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [filterStage, setFilterStage] = useState<string>("all");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ found: boolean; email: string | null; confidence: string; name: string | null; title: string | null; linkedIn: string | null; suggestions: string[]; orgFound: boolean } | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  // Bulk verify state — v34 real-time progress
  const [bulkVerifyResult, setBulkVerifyResult] = useState<{ total: number; verified: number; notFound: number; message: string } | null>(null);
  const [bulkVerifyModalOpen, setBulkVerifyModalOpen] = useState(false);
  const [verifyBatchId, setVerifyBatchId] = useState<string | null>(null);
  const [verifyProgressOpen, setVerifyProgressOpen] = useState(false);
  // CSV import state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvImportResult, setCsvImportResult] = useState<{ imported: number; skipped: number; errors: string[]; total: number; message: string } | null>(null);

  const utils = trpc.useUtils();

  const {
    data: conversations = [],
    isLoading: convsLoading,
    refetch: refetchConvs
  } = trpc.salesAgent.getConversations.useQuery();

  const { data: runs = [] } = trpc.salesAgent.getRuns.useQuery();
  const { data: draftCount } = trpc.admin.getDraftCount.useQuery();

  const { data: thread = [], isLoading: threadLoading } =
    trpc.salesAgent.getEmailThread.useQuery(
      { prospectId: selectedProspectId! },
      { enabled: selectedProspectId !== null }
    );

  const manualSend = trpc.salesAgent.manualSend.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`Frank sent: ${data.subject}`);
      setSendingId(null);
      refetchConvs();
      if (selectedProspectId === vars.prospectId) {
        utils.salesAgent.getEmailThread.invalidate({ prospectId: vars.prospectId });
      }
    },
    onError: (err) => {
      toast.error(`Send failed: ${err.message}`);
      setSendingId(null);
    },
  });

  const verifyAllUnverified = trpc.salesAgent.verifyAllUnverified.useMutation({
    onSuccess: (data) => {
      // v34: fire-and-forget — server returns batchId immediately
      setVerifyBatchId(data.batchId);
      setVerifyProgressOpen(true);
    },
    onError: (err) => toast.error(`Bulk verify failed: ${err.message}`),
  });

  // v34: poll getVerifyProgress while a batch is running
  const { data: verifyProgress } = trpc.salesAgent.getVerifyProgress.useQuery(
    { batchId: verifyBatchId ?? "" },
    {
      enabled: !!verifyBatchId && verifyProgressOpen,
      refetchInterval: verifyBatchId && verifyProgressOpen ? 1500 : false,
    }
  );

  // When batch completes, stop polling and refresh the conversation list
  useEffect(() => {
    if (verifyProgress?.status === "complete" || verifyProgress?.status === "error") {
      refetchConvs();
    }
  }, [verifyProgress?.status]);

  function handleCloseProgressModal() {
    setVerifyProgressOpen(false);
    setVerifyBatchId(null);
    if (verifyProgress?.status === "complete") {
      setBulkVerifyResult({
        total: verifyProgress.total,
        verified: verifyProgress.verified,
        notFound: verifyProgress.notFound,
        message: `Verified ${verifyProgress.verified} of ${verifyProgress.total} prospects. ${verifyProgress.notFound} not found in Apollo.`,
      });
      setBulkVerifyModalOpen(true);
    }
  }
  const importProspects = trpc.salesAgent.importProspects.useMutation({
    onSuccess: (data) => {
      setCsvImportResult(data);
      toast.success(data.message);
      refetchConvs();
    },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
  });
  const verifyEmail = trpc.salesAgent.verifyProspectEmail.useMutation({
    onSuccess: (data, vars) => {
      setVerifyingId(null);
      setVerifyResult(data as { found: boolean; email: string | null; confidence: string; name: string | null; title: string | null; linkedIn: string | null; suggestions: string[]; orgFound: boolean });
      setVerifyModalOpen(true);
      if (data.found) {
        toast.success(`Apollo found: ${data.email} (${data.confidence} confidence)`);
        utils.salesAgent.getConversations.invalidate();
      } else {
        toast.info(`No verified email found for this company in Apollo`);
      }
      void vars;
    },
    onError: (err) => {
      toast.error(`Verify failed: ${err.message}`);
      setVerifyingId(null);
    },
  });

  const triggerDiscovery = trpc.salesAgent.triggerDiscovery.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchConvs();
    },
    onError: (err) => toast.error(`Discovery failed: ${err.message}`),
  });

  const updateStage = trpc.salesAgent.updateConversationStage.useMutation({
    onSuccess: () => {
      toast.success("Stage updated");
      setUpdatingId(null);
      refetchConvs();
    },
    onError: (err) => {
      toast.error(`Update failed: ${err.message}`);
      setUpdatingId(null);
    },
  });

  const stats = {
    total: conversations.length,
    readyNow: conversations.filter(c => {
      const next = c.conv.nextFollowUpAt ? new Date(c.conv.nextFollowUpAt) : null;
      return next && next <= new Date() && !TERMINAL.includes(c.conv.state ?? "");
    }).length,
    responded: conversations.filter(c =>
      ["responded","scheduling","booked","converted"].includes(c.conv.state ?? "")
    ).length,
    booked: conversations.filter(c => c.conv.state === "booked").length,
    converted: conversations.filter(c => c.conv.state === "converted").length,
  };

  const lastRun = runs[0];

  const filtered = filterStage === "all"
    ? conversations
    : filterStage === "ready"
    ? conversations.filter(c => {
        const next = c.conv.nextFollowUpAt ? new Date(c.conv.nextFollowUpAt) : null;
        return next && next <= new Date() && !TERMINAL.includes(c.conv.state ?? "");
      })
    : conversations.filter(c => c.conv.state === filterStage);

  const selectedConv = selectedProspectId
    ? conversations.find(c => c.prospect.id === selectedProspectId)
    : null;

  const pendingCount = (draftCount as { pending?: number } | undefined)?.pending ?? 0;

  return (
    <>
      <div className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden">

        {/* ── Top tab bar ── */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === "pipeline"
                ? "border-amber-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Bot className="w-4 h-4" /> Pipeline
          </button>
          <button
            onClick={() => setActiveTab("drafts")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === "drafts"
                ? "border-amber-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Inbox className="w-4 h-4" /> Pending Drafts
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Pipeline tab ── */}
        {activeTab === "pipeline" && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h1 className="text-lg font-semibold text-white">Frank — Sales Agent</h1>
                      <p className="text-xs text-zinc-500">
                        {lastRun
                          ? `Last run ${timeAgo(lastRun.startedAt)} · ${lastRun.emailsSent ?? 0} emails sent`
                          : "No runs yet"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-700 text-amber-400 hover:bg-amber-950 gap-1.5"
                      onClick={() => triggerDiscovery.mutate()}
                      disabled={triggerDiscovery.isPending}
                    >
                      {triggerDiscovery.isPending
                        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Finding…</>
                        : <><TrendingUp className="w-3.5 h-3.5" /> Find Prospects</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-700 text-blue-400 hover:bg-blue-950 gap-1.5"
                      onClick={() => verifyAllUnverified.mutate()}
                      disabled={verifyAllUnverified.isPending || verifyProgressOpen}
                      title="Run Apollo verification on all low-confidence emails"
                    >
                      {verifyAllUnverified.isPending
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</>
                        : verifyProgressOpen
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Running…</>
                          : <><ShieldCheck className="w-3.5 h-3.5" /> Verify All</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 gap-1.5"
                      onClick={() => { setCsvText(""); setCsvImportResult(null); setCsvModalOpen(true); }}
                      title="Import prospects from CSV"
                    >
                      <Upload className="w-3.5 h-3.5" /> Import CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
                      onClick={() => refetchConvs()}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Total",     value: stats.total,     icon: Users,         color: "text-zinc-300" },
                    { label: "Ready Now", value: stats.readyNow,  icon: Zap,           color: "text-amber-400" },
                    { label: "Responded", value: stats.responded, icon: MessageSquare, color: "text-emerald-400" },
                    { label: "Booked",    value: stats.booked,    icon: Calendar,      color: "text-teal-400" },
                    { label: "Converted", value: stats.converted, icon: Star,          color: "text-yellow-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-zinc-900 rounded-lg px-3 py-2.5 border border-zinc-800">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                        <span className="text-xs text-zinc-500">{label}</span>
                      </div>
                      <span className={`text-xl font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filter bar */}
              <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setFilterStage("all")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${filterStage === "all" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  All ({conversations.length})
                </button>
                <button
                  onClick={() => setFilterStage("ready")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${filterStage === "ready" ? "bg-amber-500/30 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  Ready ({stats.readyNow})
                </button>
                {STAGES.slice(0, 7).map(s => {
                  const cnt = conversations.filter(c => c.conv.state === s.id).length;
                  if (cnt === 0) return null;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setFilterStage(s.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${filterStage === s.id ? `${s.color} ring-1 ring-current` : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                      {s.label} ({cnt})
                    </button>
                  );
                })}
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto">
                {convsLoading ? (
                  <div className="flex items-center justify-center h-32 text-zinc-500">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
                    <Bot className="w-8 h-8 mb-2" />
                    <p className="text-sm">No conversations in this filter</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50">
                    {filtered.map((item) => {
                      const { conv, prospect } = item;
                      const eng = (item as { engagement?: { opens: number; clicks: number } }).engagement ?? { opens: 0, clicks: 0 };
                      const isSelected = selectedProspectId === prospect.id;
                      const readyLabel = nextActionLabel(conv.state ?? "", conv.nextFollowUpAt);
                      const isReady = readyLabel === "Ready now";
                      return (
                        <div
                          key={conv.id}
                          onClick={() => setSelectedProspectId(prospect.id)}
                          className={`px-6 py-3.5 cursor-pointer transition-colors hover:bg-zinc-900 ${isSelected ? "bg-zinc-900 border-l-2 border-amber-500" : "border-l-2 border-transparent"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-medium text-sm text-white truncate">{prospect.company}</span>
                                {isReady && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                                {prospect.robotCategory === "heavy_industrial" && (
                                  <Factory className="w-3 h-3 text-orange-400 flex-shrink-0" />
                                )}
                                {eng.clicks > 0 && (
                                  <span className="flex items-center gap-0.5 text-cyan-400" title={`${eng.clicks} link click${eng.clicks !== 1 ? 's' : ''}`}>
                                    <MousePointerClick className="w-3 h-3" />
                                    <span className="text-[10px] font-medium">{eng.clicks}</span>
                                  </span>
                                )}
                                {eng.opens > 0 && eng.clicks === 0 && (
                                  <span className="flex items-center gap-0.5 text-sky-400" title={`${eng.opens} open${eng.opens !== 1 ? 's' : ''}`}>
                                    <Eye className="w-3 h-3" />
                                    <span className="text-[10px] font-medium">{eng.opens}</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                {prospect.contactName && <span className="truncate">{prospect.contactName}</span>}
                                {prospect.robotType && <span className="truncate text-zinc-600">{prospect.robotType}</span>}
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                              {stageBadge(conv.state ?? "discovery")}
                              <span className={`text-xs ${isReady ? "text-amber-400 font-medium" : "text-zinc-600"}`}>
                                {readyLabel ?? timeAgo(conv.lastActivityAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel — detail */}
            <div className="w-96 border-l border-zinc-800 flex flex-col overflow-hidden">
              {selectedConv ? (
                <>
                  <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="font-semibold text-white">{selectedConv.prospect.company}</h2>
                        {selectedConv.prospect.contactName && (
                          <p className="text-sm text-zinc-400">{selectedConv.prospect.contactName}</p>
                        )}
                        {selectedConv.prospect.contactTitle && (
                          <p className="text-xs text-zinc-600">{selectedConv.prospect.contactTitle}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {stageBadge(selectedConv.conv.state ?? "discovery")}
                        <span className="text-xs text-zinc-600">{selectedConv.conv.followUpCount ?? 0} emails sent</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-zinc-500">
                      {selectedConv.prospect.contactEmail && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3" />
                          <span className="text-zinc-400">{selectedConv.prospect.contactEmail}</span>
                        </div>
                      )}
                      {selectedConv.prospect.robotType && (
                        <div className="flex items-center gap-2">
                          <Bot className="w-3 h-3" />
                          <span>{selectedConv.prospect.robotType}</span>
                          {selectedConv.prospect.robotName && (
                            <span className="text-zinc-600">— {selectedConv.prospect.robotName}</span>
                          )}
                          {robotCategoryBadge(selectedConv.prospect.robotCategory)}
                        </div>
                      )}
                      {Array.isArray(selectedConv.prospect.shows) &&
                        (selectedConv.prospect.shows as string[]).length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3" />
                          <span className="truncate">{(selectedConv.prospect.shows as string[]).join(", ")}</span>
                        </div>
                      )}
                      {selectedConv.conv.nextFollowUpAt && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            Next:{" "}
                            {new Date(selectedConv.conv.nextFollowUpAt) <= new Date()
                              ? <span className="text-amber-400 font-medium">Ready now</span>
                              : new Date(selectedConv.conv.nextFollowUpAt).toLocaleDateString()
                            }
                          </span>
                        </div>
                      )}
                    </div>
                    {/* v35: Engagement summary row */}
                    {(() => {
                      const eng = (selectedConv as { engagement?: { opens: number; clicks: number; lastOpenedAt?: string | null; lastClickedAt?: string | null } }).engagement;
                      if (!eng || (eng.opens === 0 && eng.clicks === 0)) return null;
                      return (
                        <div className="mt-2.5 flex items-center gap-3 px-2.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
                          {eng.opens > 0 && (
                            <div className="flex items-center gap-1.5 text-sky-400" title={eng.lastOpenedAt ? `Last opened: ${new Date(eng.lastOpenedAt).toLocaleString()}` : undefined}>
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">{eng.opens} open{eng.opens !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {eng.clicks > 0 && (
                            <div className="flex items-center gap-1.5 text-cyan-400" title={eng.lastClickedAt ? `Last clicked: ${new Date(eng.lastClickedAt).toLocaleString()}` : undefined}>
                              <MousePointerClick className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">{eng.clicks} click{eng.clicks !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {eng.lastOpenedAt && (
                            <span className="text-[10px] text-zinc-600 ml-auto">
                              Last: {new Date(eng.lastOpenedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="px-5 py-3 border-b border-zinc-800 space-y-2">
                    {!["booked","not_interested","converted"].includes(selectedConv.conv.state ?? "") && (
                      <Button
                        size="sm"
                        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium gap-1.5"
                        disabled={sendingId === selectedConv.prospect.id}
                        onClick={() => {
                          setSendingId(selectedConv.prospect.id);
                          manualSend.mutate({ prospectId: selectedConv.prospect.id });
                        }}
                      >
                        {sendingId === selectedConv.prospect.id
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                          : <><Send className="w-3.5 h-3.5" /> Send Frank's Next Email</>
                        }
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
                      onClick={() => setPreviewOpen(true)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview Frank's Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-zinc-700 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-700 gap-1.5"
                      disabled={verifyingId === selectedConv.prospect.id}
                      onClick={() => {
                        setVerifyingId(selectedConv.prospect.id);
                        verifyEmail.mutate({ prospectId: selectedConv.prospect.id });
                      }}
                    >
                      {verifyingId === selectedConv.prospect.id
                        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying via Apollo…</>
                        : <><CheckCircle className="w-3.5 h-3.5" /> Verify Email via Apollo</>
                      }
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 whitespace-nowrap">Move to:</span>
                      <Select
                        value={selectedConv.conv.state ?? "discovery"}
                        onValueChange={(val) => {
                          setUpdatingId(selectedConv.conv.id);
                          updateStage.mutate({
                            conversationId: selectedConv.conv.id,
                            state: val as Stage
                          });
                        }}
                        disabled={updatingId === selectedConv.conv.id}
                      >
                        <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-700 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          {STAGES.map(s => (
                            <SelectItem key={s.id} value={s.id} className="text-xs text-zinc-300">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Email Thread</h3>
                    {threadLoading ? (
                      <div className="text-xs text-zinc-600 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
                      </div>
                    ) : thread.length === 0 ? (
                      <div className="text-xs text-zinc-600 flex flex-col items-center py-6 gap-2">
                        <Mail className="w-6 h-6" />
                        <p>No emails yet</p>
                        <p className="text-zinc-700">Use "Send Frank's Next Email" to start</p>
                      </div>
                    ) : (
                      thread.map((email) => (
                        <div
                          key={email.id}
                          className={`rounded-lg p-3 text-xs space-y-1.5 ${
                            email.direction === "outbound"
                              ? "bg-zinc-900 border border-zinc-800"
                              : "bg-emerald-950/40 border border-emerald-900/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${email.direction === "outbound" ? "text-amber-400" : "text-emerald-400"}`}>
                              {email.direction === "outbound" ? "Frank →" : "← Reply"}
                            </span>
                            <span className="text-zinc-600">{timeAgo(email.receivedAt)}</span>
                          </div>
                          <p className="text-zinc-300 font-medium">{email.subject}</p>
                          <p className="text-zinc-500 leading-relaxed line-clamp-4 whitespace-pre-wrap">{email.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 gap-3 px-8 text-center">
                  <Eye className="w-10 h-10" />
                  <p className="text-sm font-medium text-zinc-500">Select a prospect</p>
                  <p className="text-xs">Click any row to see Frank's conversation thread and send controls</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pending Drafts tab ── */}
        {activeTab === "drafts" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <PendingDraftsTab />
          </div>
        )}
      </div>

      {/* Preview Email Modal */}
      {selectedConv && (
        <PreviewEmailModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          prospectId={selectedConv.prospect.id}
          companyName={selectedConv.prospect.company}
          currentStage={selectedConv.conv.state ?? "discovery"}
        />
      )}

      {/* Apollo Verify Result Modal */}
      <Dialog open={verifyModalOpen} onOpenChange={(v) => { if (!v) { setVerifyModalOpen(false); setVerifyResult(null); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Apollo Email Lookup
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {verifyResult?.orgFound ? "Company found in Apollo." : "Company not found in Apollo — using pattern suggestions."}
            </DialogDescription>
          </DialogHeader>
          {verifyResult && (
            <div className="space-y-4">
              {verifyResult.found ? (
                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-emerald-300 text-sm">{verifyResult.email}</span>
                    <Badge className={`text-xs border-0 ml-auto ${
                      verifyResult.confidence === "high" ? "bg-emerald-500/20 text-emerald-400" :
                      verifyResult.confidence === "medium" ? "bg-amber-500/20 text-amber-400" :
                      "bg-zinc-700 text-zinc-400"
                    }`}>{verifyResult.confidence}</Badge>
                  </div>
                  {verifyResult.name && (
                    <p className="text-sm text-zinc-300">{verifyResult.name}{verifyResult.title ? ` — ${verifyResult.title}` : ""}</p>
                  )}
                  {verifyResult.linkedIn && (
                    <a href={verifyResult.linkedIn} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                      <Users className="w-3 h-3" /> LinkedIn Profile
                    </a>
                  )}
                  <p className="text-xs text-zinc-500 mt-1">Prospect updated with this email and contact info.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400">No verified email found. Suggested patterns to try:</p>
                  <div className="space-y-1">
                    {verifyResult.suggestions.slice(0, 6).map((s, i) => (
                      <div key={i} className="flex items-center gap-2 font-mono text-xs text-zinc-300 bg-zinc-800 rounded px-3 py-1.5">
                        <Mail className="w-3 h-3 text-zinc-500" /> {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button
                size="sm"
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                onClick={() => { setVerifyModalOpen(false); setVerifyResult(null); }}
              >Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* v34: Real-Time Verify All Progress Modal */}
      <Dialog open={verifyProgressOpen} onOpenChange={(v) => { if (!v) handleCloseProgressModal(); }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              {verifyProgress?.status === "complete" ? (
                <><ShieldCheck className="w-4 h-4 text-emerald-400" /> Verification Complete</>
              ) : verifyProgress?.status === "error" ? (
                <><ShieldCheck className="w-4 h-4 text-red-400" /> Verification Error</>
              ) : (
                <><Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> Verifying Prospects…</>
              )}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Running Apollo verification on all low-confidence emails.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-1">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>
                  {verifyProgress?.status === "complete" ? "Done" : verifyProgress?.status === "error" ? "Stopped" : "Running"}
                </span>
                <span>{verifyProgress?.current ?? 0} / {verifyProgress?.total ?? 0}</span>
              </div>
              <Progress
                value={verifyProgress?.total ? Math.round(((verifyProgress.current) / verifyProgress.total) * 100) : 0}
                className="h-2 bg-zinc-800 [&>div]:bg-blue-500"
              />
            </div>

            {/* Current company being verified */}
            {verifyProgress?.status === "running" && verifyProgress.currentCompany && (
              <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Currently checking</p>
                <p className="text-sm text-zinc-200 font-medium truncate">{verifyProgress.currentCompany}</p>
              </div>
            )}

            {/* Live counters */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{verifyProgress?.current ?? 0}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Checked</p>
              </div>
              <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{verifyProgress?.verified ?? 0}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Verified</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-zinc-400">{verifyProgress?.notFound ?? 0}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Not Found</p>
              </div>
            </div>

            {/* Error summary */}
            {verifyProgress?.errors && verifyProgress.errors.length > 0 && (
              <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-2.5">
                <p className="text-xs text-red-400 font-medium mb-1">Errors ({verifyProgress.errors.length})</p>
                {verifyProgress.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-300/70 truncate">{e}</p>
                ))}
              </div>
            )}

            {/* Close button — only when done */}
            {(verifyProgress?.status === "complete" || verifyProgress?.status === "error") && (
              <Button
                size="sm"
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                onClick={handleCloseProgressModal}
              >
                {verifyProgress.status === "complete" ? "View Summary" : "Close"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Verify Result Modal */}
      <Dialog open={bulkVerifyModalOpen} onOpenChange={setBulkVerifyModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Bulk Email Verification Complete
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Apollo verification run against all low-confidence prospects.
            </DialogDescription>
          </DialogHeader>
          {bulkVerifyResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{bulkVerifyResult.total}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Checked</p>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{bulkVerifyResult.verified}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Verified</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-400">{bulkVerifyResult.notFound}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Not Found</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">{bulkVerifyResult.message}</p>
              <Button size="sm" className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                onClick={() => setBulkVerifyModalOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={csvModalOpen} onOpenChange={(v) => { if (!v) { setCsvModalOpen(false); setCsvImportResult(null); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileText className="w-4 h-4 text-amber-400" />
              Import Prospects from CSV
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Paste CSV rows below. Supported columns: <code className="text-zinc-300">company, contact_name, contact_email, contact_title, website, robot_type, robot_category, show_name</code>
            </DialogDescription>
          </DialogHeader>
          {csvImportResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{csvImportResult.imported}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Imported</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-400">{csvImportResult.skipped}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Skipped (dup)</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-400">{csvImportResult.total}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Total Rows</p>
                </div>
              </div>
              {csvImportResult.errors.length > 0 && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-400 mb-1">Errors ({csvImportResult.errors.length}):</p>
                  {csvImportResult.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-red-300">{e}</p>
                  ))}
                </div>
              )}
              <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-500 text-white"
                onClick={() => { setCsvModalOpen(false); setCsvImportResult(null); }}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-xs h-64 resize-none"
                placeholder={`company,contact_name,contact_email,contact_title,website,robot_type,robot_category,show_name\nAgility Robotics,Damion Shelton,ceo@agilityrobotics.com,CEO,https://agilityrobotics.com,Humanoid,light,CES 2026`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
                  onClick={() => importProspects.mutate({ csvText })}
                  disabled={importProspects.isPending || !csvText.trim()}
                >
                  {importProspects.isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importing…</>
                    : <><Upload className="w-3.5 h-3.5" /> Import</>}
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400"
                  onClick={() => setCsvModalOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
