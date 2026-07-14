/**
 * client/src/pages/AdminSalesAgent.tsx
 *
 * Cal's Mission Control — Pipeline board + Pending Drafts review queue
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
import { AdminPage } from "@/lib/adminTheme";
import {
  Bot, Mail, Clock, MessageSquare,
  Zap, Send, RefreshCw, Eye, Users,
  TrendingUp, Calendar, Star, Cpu, Factory,
  CheckCircle, CheckCircle2, XCircle, Edit3, Inbox,
  ShieldCheck, Upload, FileText, Loader2,
  MousePointerClick
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const STAGES = [
  { id: "discovery",      label: "Discovered",     color: "text-zinc-400" },
  { id: "intro_sent",     label: "Intro Sent",      color: "text-blue-400" },
  { id: "followup_1",     label: "Ask / Learn",     color: "text-indigo-400" },
  { id: "followup_2",     label: "Recommend",       color: "text-violet-400" },
  { id: "robot_guild",    label: "Advisory",        color: "text-amber-400" },
  { id: "responded",      label: "Responded",       color: "text-emerald-400" },
  { id: "scheduling",     label: "Scheduling",      color: "text-teal-400" },
  { id: "booked",         label: "Booked",          color: "text-emerald-400" },
  { id: "not_interested", label: "Not Interested",  color: "text-zinc-500" },
  { id: "email_opened",   label: "Email Opened",   color: "text-sky-400" },
  { id: "link_clicked",   label: "Link Clicked",   color: "text-cyan-400" },
  { id: "awaiting_reply", label: "Replied",         color: "text-amber-400" },
  { id: "converted",      label: "Converted",       color: "text-yellow-400" },
] as const;

type Stage = typeof STAGES[number]["id"];
const STAGE_MAP = Object.fromEntries(
  STAGES.map(s => [s.id, s])
) as Record<Stage, typeof STAGES[number]>;

function stageBadge(state: string) {
  const s = STAGE_MAP[state as Stage];
  if (!s) return <span className="text-zinc-400 text-xs font-medium">{state}</span>;
  return <span className={`${s.color} text-xs font-medium`}>{s.label}</span>;
}

function robotCategoryBadge(category: string | null | undefined) {
  if (!category || category === "light") return null;
  if (category === "heavy_industrial") {
    return (
      <span className="text-orange-400 text-xs font-medium inline-flex items-center gap-1">
        <Factory className="w-2.5 h-2.5" /> Heavy Industrial
      </span>
    );
  }
  return (
    <span className="text-purple-400 text-xs font-medium inline-flex items-center gap-1">
      <Cpu className="w-2.5 h-2.5" /> Mixed
    </span>
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

// ─── Inline Draft Panel ───────────────────────────────────────────────────────
function InlineDraftPanel({ prospectId }: { prospectId: number }) {
  const [expanded, setExpanded] = useState(true);
  const utils = trpc.useUtils();

  const { data: draft, isLoading } = trpc.salesAgent.getDraftForProspect.useQuery(
    { prospectId },
    { enabled: !!prospectId }
  );

  const regenerate = trpc.salesAgent.previewEmail.useMutation({
    onSuccess: () => {
      utils.salesAgent.getDraftForProspect.invalidate({ prospectId });
      toast.success("Draft regenerated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-600 py-2">
        <RefreshCw className="w-3 h-3 animate-spin" /> Loading Cal's draft…
      </div>
    );
  }

  if (!draft?.body) {
    return (
      <div className="rounded-lg border border-white/10/60 bg-[#24272e]/40 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <FileText className="w-3 h-3" />
          <span>No draft yet</span>
        </div>
        <button
          onClick={() => regenerate.mutate({ prospectId, forceRegenerate: true })}
          disabled={regenerate.isPending}
          className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 disabled:opacity-50"
        >
          {regenerate.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
          Generate
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-950/20 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Bot className="w-3 h-3 text-amber-400" />
          <span className="text-xs font-medium text-amber-400">Cal's Draft</span>
          {draft.subject && (
            <span className="text-xs text-zinc-500 truncate max-w-[120px]">— {draft.subject}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              regenerate.mutate({ prospectId, forceRegenerate: true });
            }}
            disabled={regenerate.isPending}
            className="text-[10px] text-zinc-500 hover:text-amber-400 flex items-center gap-1 disabled:opacity-50"
          >
            {regenerate.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
            Regenerate
          </button>
          <span className="text-zinc-600 text-[10px]">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-amber-900/30">
          {draft.subject && (
            <p className="text-[11px] text-zinc-400 font-medium pt-2">{draft.subject}</p>
          )}
          <pre className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans max-h-56 overflow-y-auto">
            {draft.body}
          </pre>
        </div>
      )}
    </div>
  );
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
  const [preview, setPreview] = useState<{ subject: string; body: string; stage: string; nextStage: string; fromCache?: boolean } | null>(null);

  // Auto-load existing draft from DB (no LLM call)
  const { data: existingDraft, isLoading: draftLoading } = trpc.salesAgent.getDraftForProspect.useQuery(
    { prospectId: prospectId ?? 0 },
    { enabled: open && !!prospectId }
  );

  // When existing draft loads, show it immediately
  useEffect(() => {
    if (existingDraft && !preview) {
      const NEXT: Record<string, string> = { discovery: "intro_sent", intro_sent: "followup_1", followup_1: "followup_2", followup_2: "followup_2" };
      setPreview({ subject: existingDraft.subject ?? "", body: existingDraft.body ?? "", stage: selectedStage, nextStage: NEXT[selectedStage] ?? "intro_sent", fromCache: true });
    }
  }, [existingDraft]);

  const previewMutation = trpc.salesAgent.previewEmail.useMutation({
    onSuccess: (data) => setPreview(data),
    onError: (err) => toast.error(`Preview failed: ${err.message}`),
  });

  const PREVIEW_STAGES = ["discovery", "intro_sent", "followup_1", "followup_2"] as const;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setPreview(null); } }}>
      <DialogContent className="bg-[#24272e] border-white/10 text-white max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Eye className="w-4 h-4 text-amber-400" />
            Cal Email Preview — {companyName}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Review Cal's draft before approving. Use Regenerate to get a fresh LLM draft.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 py-3 border-b border-white/10">
          <span className="text-xs text-zinc-500 whitespace-nowrap">Stage:</span>
          <div className="flex gap-1.5 flex-wrap">
            {PREVIEW_STAGES.map(s => {
              const stageInfo = STAGE_MAP[s];
              return (
                <button
                  key={s}
                  onClick={() => { setSelectedStage(s); setPreview(null); }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    selectedStage === s
                      ? (stageInfo?.color ?? "bg-zinc-700 text-white") + " ring-1 ring-current"
                      : "text-zinc-500 hover:text-zinc-300 bg-[#2b2f38]"
                  }`}
                >
                  {stageInfo?.label ?? s}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-white/10 text-zinc-400 hover:text-white gap-1.5 flex-shrink-0 text-xs"
            disabled={previewMutation.isPending || !prospectId}
            onClick={() => {
              if (!prospectId) return;
              setPreview(null);
              previewMutation.mutate({
                prospectId,
                stage: selectedStage as "discovery" | "intro_sent" | "followup_1" | "followup_2" | "robot_guild",
                forceRegenerate: true,
              });
            }}
          >
            {previewMutation.isPending
              ? <><RefreshCw className="w-3 h-3 animate-spin" /> Regenerating…</>
              : <><RefreshCw className="w-3 h-3" /> Regenerate</>
            }
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {(draftLoading || previewMutation.isPending) && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <p className="text-sm">{previewMutation.isPending ? "Cal is regenerating…" : "Loading Cal's draft…"}</p>
            </div>
          )}
          {preview && !previewMutation.isPending && (
            <div className="space-y-4">
              {preview.fromCache && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-400">Cal's saved draft — ready to send. Use Regenerate for a fresh version.</span>
                </div>
              )}
              <div className="bg-[#2b2f38]/60 rounded-lg p-4 space-y-3">
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
              <div className="bg-[#2b2f38]/60 rounded-lg p-4 space-y-2">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">Body</span>
                <pre className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{preview.body}</pre>
              </div>
              <p className="text-xs text-zinc-600 text-center">
                Use "Send Cal's Next Email" in the detail panel to send this to the prospect.
              </p>
            </div>
          )}
          {!preview && !draftLoading && !previewMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-3">
              <Bot className="w-8 h-8" />
              <p className="text-sm">No draft found. Click Regenerate to have Cal write one.</p>
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
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [draftAllResult, setDraftAllResult] = useState<{ generated: number; skipped: number; errors: string[]; total: number } | null>(null);

  const { data: drafts = [], isLoading, refetch } = trpc.admin.getDrafts.useQuery(
    { statuses: ["pending"] }
  );

  const generateDrafts = trpc.admin.generateDrafts.useMutation({
    onSuccess: (data) => {
      const r = (data as { result: { generated: number; skipped: number; errors: string[]; total: number } }).result;
      setDraftAllResult(r);
      toast.success(`Cal drafted ${r.generated} new email${r.generated !== 1 ? "s" : ""} (${r.skipped} skipped)`);
      utils.admin.getDraftCount.invalidate();
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Draft generation failed: ${err.message}`);
    },
  });

  const sendDraft = trpc.admin.sendDraft.useMutation({
    onSuccess: (data) => {
      const d = data as { sentTo?: string; warning?: string };
      if (d.warning) {
        toast.warning(`Prospect marked contacted — but email not delivered. ${d.warning}`);
      } else {
        toast.success(`Sent to ${d.sentTo ?? "prospect"}`);
      }
      setSendingId(null);
      utils.admin.getDraftCount.invalidate();
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

  const bulkSend = trpc.admin.bulkSendDrafts.useMutation({
    onSuccess: (data) => {
      const result = data as { sent: number; failed: number; errors: string[] };
      setBulkResult(result);
      toast.success(`Cal sent ${result.sent} email${result.sent !== 1 ? "s" : ""}${result.failed > 0 ? ` (${result.failed} failed)` : ""}`);
      utils.admin.getDraftCount.invalidate();
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Bulk send failed: ${err.message}`);
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
          Cal's drafts will appear here. Review each one, edit if needed, then approve and send — or bulk approve all at once.
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-zinc-300 hover:bg-[#2b2f38] gap-1.5"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-700 text-amber-300 hover:bg-amber-950/40 gap-1.5"
            disabled={generateDrafts.isPending}
            onClick={() => { setDraftAllResult(null); generateDrafts.mutate({}); }}
          >
            {generateDrafts.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting all…</>
              : <><Bot className="w-3.5 h-3.5" /> Draft All Prospects</>
            }
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
            disabled={bulkSend.isPending || drafts.length === 0}
            onClick={() =>
              bulkSend.mutate({
                draftIds: (drafts as Array<{ draft: { id: number } }>).map((d) => d.draft.id),
              })
            }
          >
            {bulkSend.isPending
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending all…</>
              : <><Send className="w-3.5 h-3.5" /> Bulk Approve All ({drafts.length})</>
            }
          </Button>
        </div>
      </div>

      {draftAllResult && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
          <Bot className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-amber-300">
              Cal drafted <strong>{draftAllResult.generated}</strong> new email{draftAllResult.generated !== 1 ? "s" : ""}.{" "}
              <span className="text-zinc-400">{draftAllResult.skipped} prospects skipped (already have a draft or no email address).</span>
            </span>
            {draftAllResult.errors.length > 0 && (
              <p className="text-red-400 text-xs mt-1">{draftAllResult.errors.length} error{draftAllResult.errors.length !== 1 ? "s" : ""}: {draftAllResult.errors[0]}</p>
            )}
          </div>
          <button onClick={() => setDraftAllResult(null)} className="text-zinc-500 hover:text-zinc-300 text-xs flex-shrink-0">Dismiss</button>
        </div>
      )}

      {bulkResult && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-emerald-300">
            Sent {bulkResult.sent} email{bulkResult.sent !== 1 ? "s" : ""}.
            {bulkResult.failed > 0 && <span className="text-amber-400 ml-1">{bulkResult.failed} failed.</span>}
          </span>
          <button onClick={() => setBulkResult(null)} className="ml-auto text-zinc-500 hover:text-zinc-300 text-xs">Dismiss</button>
        </div>
      )}

      {(drafts as Array<{ draft: { id: number; subject: string; body: string; createdAt: Date | string; agentReasoning?: string | null }; prospect: { id: number; company: string; contactEmail?: string | null; robotType?: string | null } }>).map(({ draft, prospect }) => (
        <div
          key={draft.id}
          className="bg-[#24272e] border border-white/10 rounded-xl overflow-hidden"
        >
          {/* Draft header */}
          <div className="px-5 py-4 border-b border-white/10">
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
                <Badge className="text-amber-400 text-xs border-0">Pending Reply</Badge>
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
                    className="w-full bg-[#2b2f38] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1">Body</label>
                  <Textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={10}
                    className="w-full bg-[#2b2f38] border-white/10 text-sm text-zinc-200 resize-none focus:border-amber-500"
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
                  <div className="bg-[#2b2f38]/50 rounded-lg p-3">
                    <span className="text-xs text-zinc-600 uppercase tracking-wide block mb-1">Cal's Reasoning</span>
                    <p className="text-xs text-zinc-500 leading-relaxed">{draft.agentReasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-3 border-t border-white/10 flex items-center gap-2">
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
                  className="border-white/10 text-zinc-300 hover:bg-[#2b2f38]"
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
                  className="border-white/10 text-zinc-300 hover:bg-[#2b2f38] gap-1.5"
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
                  className="border-white/10 text-red-400 hover:bg-red-950/30 hover:border-red-800 gap-1.5 ml-auto"
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
  // v38: notes editing state
  const [notesValue, setNotesValue] = useState<string>("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesProspectId, setNotesProspectId] = useState<number | null>(null);
  // v39: per-activity expanded state for full reply body
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const toggleActivityExpand = (id: number) =>
    setExpandedActivities(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  // v66: calendar panel state
  const [calendarTab, setCalendarTab] = useState<"pipeline" | "calendar">("pipeline");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleType, setScheduleType] = useState<"meeting" | "call" | "demo">("call");
  // Prospect linked to a schedule action (set when "Schedule a Call" is clicked from detail panel)
  const [schedulingProspect, setSchedulingProspect] = useState<{ id: number; company: string; email?: string | null; name?: string | null } | null>(null);
  // v67: confirm + reschedule state
  const [confirmingCalId, setConfirmingCalId] = useState<number | null>(null);
  const [reschedulingCalEvt, setReschedulingCalEvt] = useState<typeof upcomingEvents[0] | null>(null);
  const [rescheduleStartAt, setRescheduleStartAt] = useState("");
  const [rescheduleEndAt, setRescheduleEndAt] = useState("");
  // v69: cancel state
  const [cancellingCalEvt, setCancellingCalEvt] = useState<typeof upcomingEvents[0] | null>(null);
  const [cancelCalReason, setCancelCalReason] = useState("");

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

  // v38: prospect activities timeline
  const { data: prospectActivities = [], isLoading: activitiesLoading } =
    trpc.salesAgent.getProspectActivities.useQuery(
      { prospectId: selectedProspectId! },
      { enabled: selectedProspectId !== null }
    );

  const manualSend = trpc.salesAgent.manualSend.useMutation({
    onSuccess: (data, vars) => {
      if ((data as { warning?: string }).warning) {
        toast.warning(`Workflow updated — but email not delivered. ${(data as { warning?: string }).warning}`);
      } else {
        toast.success(`Cal sent: ${data.subject}`);
      }
      setSendingId(null);
      refetchConvs();
      utils.admin.getDraftCount.invalidate();
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

  // Hunter.io — find real, verified decision-maker emails for prospects that
  // only have guessed or missing contacts.
  const enrichHunter = trpc.salesAgent.enrichContactsHunter.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchConvs();
    },
    onError: (err) => toast.error(`Hunter enrichment failed: ${err.message}`),
  });

  // v38: update prospect notes
  const updateProspectNotes = trpc.salesAgent.updateProspectNotes.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      setNotesSaving(false);
      refetchConvs();
    },
    onError: (err) => {
      toast.error(`Save failed: ${err.message}`);
      setNotesSaving(false);
    },
  });

  // v38: resume follow-ups
  const resumeFollowUps = trpc.salesAgent.resumeFollowUps.useMutation({
    onSuccess: () => {
      toast.success("Follow-ups resumed — moved back to Follow-up 1");
      refetchConvs();
    },
    onError: (err) => toast.error(`Resume failed: ${err.message}`),
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

  // v66: calendar data — stabilize `from` reference to avoid infinite re-fetches
  const [calendarFrom] = useState(() => new Date().toISOString());
  const { data: upcomingEventsData, refetch: refetchCalendar } = trpc.calendar.list.useQuery(
    { from: calendarFrom },
    { staleTime: 60_000, refetchInterval: 120_000 }
  );
  const upcomingEvents = (upcomingEventsData?.events ?? []).filter(
    e => e.status === "scheduled" || e.status === "confirmed"
  ).slice(0, 8);

  const agentCreateEvent = trpc.calendar.create.useMutation({
    onSuccess: () => {
      toast.success("Meeting scheduled and added to calendar");
      setScheduleModalOpen(false);
      setScheduleTitle("");
      setScheduleDate("");
      setScheduleTime("10:00");
      setScheduleDuration(30);
      setScheduleNotes("");
      setSchedulingProspect(null);
      refetchCalendar();
    },
    onError: (err) => toast.error(`Failed to schedule: ${err.message}`),
  });

  const calendarConfirm = trpc.calendar.confirm.useMutation({
    onSuccess: () => { toast.success("Event confirmed"); refetchCalendar(); setConfirmingCalId(null); },
    onError: (e) => { toast.error(e.message); setConfirmingCalId(null); },
  });

  const calendarReschedule = trpc.calendar.reschedule.useMutation({
    onSuccess: () => { toast.success("Rescheduled — emails sent"); refetchCalendar(); setReschedulingCalEvt(null); },
  });

  const calendarCancel = trpc.calendar.cancel.useMutation({
    onSuccess: () => { toast.success("Event cancelled — emails sent"); refetchCalendar(); setCancellingCalEvt(null); setCancelCalReason(""); },
    onError: (e) => { toast.error(e.message); setCancellingCalEvt(null); },
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

  // v38: sync notes textarea when selection changes
  const selectedProspectNotes = (selectedConv?.prospect as { notes?: string | null } | undefined)?.notes ?? "";
  if (notesProspectId !== selectedProspectId) {
    setNotesProspectId(selectedProspectId);
    setNotesValue(selectedProspectNotes);
  }

  const pendingCount = (draftCount as { pending?: number } | undefined)?.pending ?? 0;

  return (
    <>
      <AdminPage fullHeight noPadding maxWidth="none">
      <div className="flex flex-col h-full bg-transparent text-white overflow-hidden">

        {/* ── Top tab bar ── */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-white/10">
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
          <button
            onClick={() => setActiveTab("calendar" as "pipeline" | "drafts")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === ("calendar" as string)
                ? "border-emerald-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Calendar className="w-4 h-4" /> Meetings
            {upcomingEvents.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold text-emerald-400 border border-emerald-700">
                {upcomingEvents.length}
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
              <div className="px-6 pt-5 pb-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h1 className="text-lg font-semibold text-white">Cal</h1>
                      <p className="text-xs text-zinc-500">
                        Physical AI Deployment Advisor · teaches, asks, earns trust.
                        {lastRun ? ` Last outreach run ${timeAgo(lastRun.startedAt)}.` : ""}
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
                      className="border-emerald-700 text-emerald-400 hover:bg-emerald-950 gap-1.5"
                      onClick={() => enrichHunter.mutate({ limit: 25 })}
                      disabled={enrichHunter.isPending}
                      title="Find real decision-maker emails via Hunter.io for prospects with missing/guessed contacts"
                    >
                      {enrichHunter.isPending
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding…</>
                        : <><MousePointerClick className="w-3.5 h-3.5" /> Find Emails</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-600 text-zinc-300 hover:bg-[#2b2f38] gap-1.5"
                      onClick={() => { setCsvText(""); setCsvImportResult(null); setCsvModalOpen(true); }}
                      title="Import prospects from CSV"
                    >
                      <Upload className="w-3.5 h-3.5" /> Import CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-zinc-300 hover:bg-[#2b2f38] gap-1.5"
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
                    <div key={label} className="bg-[#24272e] rounded-lg px-3 py-2.5 border border-white/10">
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
              <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setFilterStage("all")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${filterStage === "all" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  All ({conversations.length})
                </button>
                <button
                  onClick={() => setFilterStage("ready")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${filterStage === "ready" ? "bg-amber-500/30 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
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
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${filterStage === s.id ? `${s.color} ring-1 ring-current` : "text-zinc-500 hover:text-zinc-300"}`}
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
                  <div className="divide-y divide-white/10">
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
                          className={`px-6 py-3.5 cursor-pointer transition-colors hover:bg-[#24272e] ${isSelected ? "bg-[#24272e] border-l-2 border-amber-500" : "border-l-2 border-transparent"}`}
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
            <div className="w-96 border-l border-white/10 flex flex-col overflow-hidden">
              {selectedConv ? (
                <>
                  <div className="px-5 pt-5 pb-4 border-b border-white/10">
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
                        <div className="mt-2.5 flex items-center gap-3 px-2.5 py-2 rounded-lg bg-[#24272e]/60 border border-white/10">
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

                  <div className="px-5 py-3 border-b border-white/10 space-y-2">
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
                          : <><Send className="w-3.5 h-3.5" /> Send Cal's Next Email</>
                        }
                      </Button>
                    )}
                    {/* v38: Resume follow-ups button — only shown for awaiting_reply */}
                    {selectedConv.conv.state === "awaiting_reply" && (
                      <Button
                        size="sm"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
                        disabled={resumeFollowUps.isPending}
                        onClick={() => resumeFollowUps.mutate({ conversationId: selectedConv.conv.id })}
                      >
                        {resumeFollowUps.isPending
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resuming…</>
                          : <><RefreshCw className="w-3.5 h-3.5" /> Resume Follow-ups</>
                        }
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-white/10 text-zinc-300 hover:bg-[#2b2f38] gap-1.5"
                      onClick={() => setPreviewOpen(true)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview Cal's Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-teal-700 text-teal-400 hover:bg-teal-950/30 hover:border-teal-600 gap-1.5"
                      onClick={() => {
                        const p = selectedConv.prospect;
                        setSchedulingProspect({
                          id: p.id,
                          company: p.company,
                          email: p.contactEmail ?? null,
                          name: p.contactName ?? null,
                        });
                        setScheduleTitle(`Intro Call — ${p.company}`);
                        setScheduleDate("");
                        setScheduleTime("10:00");
                        setScheduleDuration(30);
                        setScheduleNotes("");
                        setScheduleType("call");
                        setScheduleModalOpen(true);
                      }}
                    >
                      <Calendar className="w-3.5 h-3.5" /> Schedule a Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-white/10 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-700 gap-1.5"
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
                        <SelectTrigger className="h-7 text-xs bg-[#24272e] border-white/10 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#24272e] border-white/10">
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
                    {/* v38: Notes section */}
                    <div>
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Notes</h3>
                      <Textarea
                        className="w-full text-xs bg-[#24272e] border-white/10 text-zinc-300 placeholder:text-zinc-600 resize-none min-h-[72px]"
                        placeholder="Add notes about this prospect… (auto-saves on blur)"
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onBlur={() => {
                          if (selectedConv && notesValue !== selectedProspectNotes) {
                            setNotesSaving(true);
                            updateProspectNotes.mutate({ prospectId: selectedConv.prospect.id, notes: notesValue });
                          }
                        }}
                      />
                      {notesSaving && (
                        <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Saving…
                        </p>
                      )}
                    </div>

                    {/* Inline Cal draft — auto-loads, no click needed */}
                    <InlineDraftPanel prospectId={selectedConv.prospect.id} />

                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Email Thread</h3>
                    {threadLoading ? (
                      <div className="text-xs text-zinc-600 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
                      </div>
                    ) : thread.length === 0 ? (
                      <div className="text-xs text-zinc-600 flex flex-col items-center py-6 gap-2">
                        <Mail className="w-6 h-6" />
                        <p>No emails yet</p>
                        <p className="text-zinc-700">Use "Send Cal's Next Email" to start</p>
                      </div>
                    ) : (
                      thread.map((email) => (
                        <div
                          key={email.id}
                          className={`rounded-lg p-3 text-xs space-y-1.5 ${
                            email.direction === "outbound"
                              ? "bg-[#24272e] border border-white/10"
                              : "bg-emerald-950/40 border border-emerald-900/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${email.direction === "outbound" ? "text-amber-400" : "text-emerald-400"}`}>
                              {email.direction === "outbound" ? "Cal →" : "← Reply"}
                            </span>
                            <span className="text-zinc-600">{timeAgo(email.receivedAt)}</span>
                          </div>
                          <p className="text-zinc-300 font-medium">{email.subject}</p>
                          <p className="text-zinc-500 leading-relaxed line-clamp-4 whitespace-pre-wrap">{email.body}</p>
                        </div>
                      ))
                    )}

                    {/* v38: Activity timeline */}
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide pt-2">Activity</h3>
                    {activitiesLoading ? (
                      <div className="space-y-2">
                        {[1,2,3].map(i => <div key={i} className="h-10 bg-[#2b2f38]/60 rounded animate-pulse" />)}
                      </div>
                    ) : (prospectActivities as unknown[]).length === 0 ? (
                      <p className="text-xs text-zinc-600 py-2">No activity recorded yet.</p>
                    ) : (
                      <div className="space-y-0">
                        {(prospectActivities as Array<{ id: number; type: string; title: string; description?: string | null; metadata?: Record<string, unknown> | null; createdAt: string | Date }>).map(act => {
                          const actIconMap: Record<string, React.ReactNode> = {
                            email_sent:           <Send className="w-2.5 h-2.5 text-blue-400" />,
                            email_opened:         <Eye className="w-2.5 h-2.5 text-sky-400" />,
                            email_clicked:        <MousePointerClick className="w-2.5 h-2.5 text-cyan-400" />,
                            email_replied:        <MessageSquare className="w-2.5 h-2.5 text-emerald-400" />,
                            followup_accelerated: <Zap className="w-2.5 h-2.5 text-amber-400" />,
                            followup_resumed:     <RefreshCw className="w-2.5 h-2.5 text-emerald-400" />,
                          };
                          const dotColorMap: Record<string, string> = {
                            email_sent:           "bg-blue-500",
                            email_opened:         "bg-sky-500",
                            email_clicked:        "bg-cyan-500",
                            email_replied:        "bg-emerald-500",
                            followup_accelerated: "bg-amber-500",
                            followup_resumed:     "bg-emerald-500",
                          };
                          // v39: full reply body from metadata
                          const fullReplyBody = act.type === "email_replied"
                            ? (act.metadata?.replyBody as string | null | undefined) ?? null
                            : null;
                          const isExpanded = expandedActivities.has(act.id);
                          return (
                            <div key={act.id} className="flex gap-2.5 py-2.5 border-b border-white/10/60 last:border-0">
                              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColorMap[act.type] ?? "bg-zinc-600"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1">
                                    {actIconMap[act.type]}
                                    <span className="text-[11px] font-semibold text-zinc-300">{act.title}</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-600 shrink-0">
                                    {new Date(act.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                {act.description && (
                                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{act.description}</p>
                                )}
                                {/* v39: expandable full reply body */}
                                {fullReplyBody && (
                                  <div className="mt-1">
                                    <button
                                      onClick={() => toggleActivityExpand(act.id)}
                                      className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-0.5"
                                    >
                                      {isExpanded ? "Collapse ▴" : "View full reply ▾"}
                                    </button>
                                    {isExpanded && (
                                      <div className="mt-1.5 max-h-48 overflow-y-auto rounded border border-white/10/60 bg-[#24272e]/80 p-2">
                                        <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap break-words leading-relaxed font-sans">
                                          {fullReplyBody}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 gap-3 px-8 text-center">
                  <Eye className="w-10 h-10" />
                  <p className="text-sm font-medium text-zinc-500">Select a prospect</p>
                  <p className="text-xs">Click any row to see Cal's conversation thread and send controls</p>
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

        {/* ── Meetings / Calendar tab ── */}
        {activeTab === ("calendar" as string) && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    Upcoming Meetings
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {upcomingEvents.length} scheduled or confirmed
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => setScheduleModalOpen(true)}
                >
                  <Calendar className="w-3.5 h-3.5" /> Schedule Meeting
                </Button>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                  <Calendar className="w-10 h-10 mb-3" />
                  <p className="text-sm font-medium text-zinc-500">No upcoming meetings</p>
                  <p className="text-xs mt-1">Schedule a meeting to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(evt => {
                    const start = new Date(evt.startAt);
                    const end = new Date(evt.endAt);
                    const typeColors: Record<string, string> = {
                      meeting: "text-blue-400 border-blue-800",
                      call: "text-emerald-400 border-emerald-800",
                      demo: "text-amber-400 border-amber-800",
                      event: "bg-purple-500/20 text-purple-400 border-purple-800",
                      follow_up: "bg-zinc-500/20 text-zinc-400 border-white/10",
                    };
                    const typeColor = typeColors[evt.type] ?? typeColors.meeting;
                    const statusColors: Record<string, string> = {
                      scheduled: "text-zinc-400",
                      confirmed: "bg-emerald-600/30 text-emerald-300",
                      completed: "bg-[#2b2f38] text-zinc-500",
                      cancelled: "bg-red-900/30 text-red-400",
                    };
                    const statusColor = statusColors[evt.status] ?? statusColors.scheduled;
                    return (
                      <div key={evt.id} className="rounded-lg border border-white/10 bg-[#24272e]/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide ${typeColor}`}>
                                {evt.type.replace("_", " ")}
                              </span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColor}`}>
                                {evt.status}
                              </span>
                            </div>
                            <h3 className="font-medium text-white text-sm truncate">{evt.title}</h3>
                            {evt.companyName && (
                              <p className="text-xs text-zinc-400 mt-0.5">{evt.companyName}</p>
                            )}
                            {evt.prospectEmail && (
                              <p className="text-xs text-zinc-600 mt-0.5 flex items-center gap-1">
                                <Mail className="w-3 h-3" />{evt.prospectEmail}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium text-white">
                              {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                              {" – "}
                              {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                            </p>
                          </div>
                        </div>
                        {evt.notes && (
                          <p className="text-xs text-zinc-600 mt-2 border-t border-white/10 pt-2">{evt.notes}</p>
                        )}
                        {/* Confirm / Reschedule actions */}
                        {(evt.status === "scheduled" || evt.status === "confirmed") && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                            {evt.status === "scheduled" && (
                              <Button size="sm" variant="outline"
                                className="border-emerald-700 text-emerald-400 hover:bg-emerald-950 gap-1 text-xs h-7"
                                onClick={() => { setConfirmingCalId(evt.id); calendarConfirm.mutate({ id: evt.id }); }}
                                disabled={confirmingCalId === evt.id}>
                                {confirmingCalId === evt.id
                                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> Confirming…</>
                                  : <><CheckCircle className="w-3 h-3" /> Confirm</>
                                }
                              </Button>
                            )}
                            <Button size="sm" variant="outline"
                              className="border-zinc-600 text-zinc-300 hover:bg-[#2b2f38] gap-1 text-xs h-7"
                              onClick={() => {
                                const s = new Date(evt.startAt);
                                const e2 = new Date(evt.endAt);
                                const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                setRescheduleStartAt(toLocal(s));
                                setRescheduleEndAt(toLocal(e2));
                                setReschedulingCalEvt(evt);
                              }}>
                              <RefreshCw className="w-3 h-3" /> Reschedule
                            </Button>
                            <Button size="sm" variant="outline"
                              className="border-red-800 text-red-400 hover:bg-red-950 gap-1 text-xs h-7 ml-auto"
                              onClick={() => { setCancellingCalEvt(evt); setCancelCalReason(""); }}>
                              <XCircle className="w-3 h-3" /> Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Schedule Meeting Modal (v66) ── */}
      <Dialog open={scheduleModalOpen} onOpenChange={(v) => { setScheduleModalOpen(v); if (!v) setSchedulingProspect(null); }}>
        <DialogContent className="bg-[#24272e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Calendar className="w-4 h-4 text-teal-400" />
              {schedulingProspect ? `Schedule a Call — ${schedulingProspect.company}` : "Schedule a Meeting"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {schedulingProspect
                ? `This will be linked to ${schedulingProspect.company} and appear in the Meetings tab.`
                : "Create a calendar event and optionally link it to a prospect."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Title *</label>
              <input
                type="text"
                value={scheduleTitle}
                onChange={e => setScheduleTitle(e.target.value)}
                placeholder="e.g. Intro Call — Unitree Robotics"
                className="w-full bg-[#2b2f38] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Date *</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className="w-full bg-[#2b2f38] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Time (PT)</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full bg-[#2b2f38] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Type</label>
                <Select value={scheduleType} onValueChange={v => setScheduleType(v as "meeting" | "call" | "demo")}>
                  <SelectTrigger className="bg-[#2b2f38] border-white/10 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2b2f38] border-white/10">
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Duration</label>
                <Select value={String(scheduleDuration)} onValueChange={v => setScheduleDuration(Number(v))}>
                  <SelectTrigger className="bg-[#2b2f38] border-white/10 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2b2f38] border-white/10">
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Notes</label>
              <Textarea
                value={scheduleNotes}
                onChange={e => setScheduleNotes(e.target.value)}
                placeholder="Optional context for the meeting"
                className="bg-[#2b2f38] border-white/10 text-white text-sm resize-none h-20"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="border-white/10 text-zinc-400" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!scheduleTitle.trim() || !scheduleDate || agentCreateEvent.isPending}
              onClick={() => {
                if (!scheduleTitle.trim() || !scheduleDate) return;
                const startAt = new Date(`${scheduleDate}T${scheduleTime}:00`);
                const endAt = new Date(startAt.getTime() + scheduleDuration * 60_000);
                agentCreateEvent.mutate({
                  title: scheduleTitle.trim(),
                  startAt: startAt.toISOString(),
                  endAt: endAt.toISOString(),
                  type: scheduleType,
                  status: "scheduled",
                  notes: scheduleNotes.trim() || undefined,
                  ...(schedulingProspect ? {
                    prospectId: schedulingProspect.id,
                    prospectEmail: schedulingProspect.email ?? undefined,
                    prospectName: schedulingProspect.name ?? undefined,
                    companyName: schedulingProspect.company,
                  } : {}),
                });
              }}
            >
              {agentCreateEvent.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scheduling…</> : "Schedule Meeting"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="bg-[#24272e] border-white/10 text-white max-w-lg">
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
                      verifyResult.confidence === "high" ? "text-emerald-400" :
                      verifyResult.confidence === "medium" ? "text-amber-400" :
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
                      <div key={i} className="flex items-center gap-2 font-mono text-xs text-zinc-300 bg-[#2b2f38] rounded px-3 py-1.5">
                        <Mail className="w-3 h-3 text-zinc-500" /> {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button
                size="sm"
                className="w-full bg-[#2b2f38] hover:text-zinc-400"
                onClick={() => { setVerifyModalOpen(false); setVerifyResult(null); }}
              >Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* v34: Real-Time Verify All Progress Modal */}
      <Dialog open={verifyProgressOpen} onOpenChange={(v) => { if (!v) handleCloseProgressModal(); }}>
        <DialogContent className="bg-[#24272e] border-white/10 text-white max-w-md" onInteractOutside={(e) => e.preventDefault()}>
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
                className="h-2 bg-[#2b2f38] [&>div]:bg-blue-500"
              />
            </div>

            {/* Current company being verified */}
            {verifyProgress?.status === "running" && verifyProgress.currentCompany && (
              <div className="bg-[#2b2f38]/60 rounded-lg px-3 py-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Currently checking</p>
                <p className="text-sm text-zinc-200 font-medium truncate">{verifyProgress.currentCompany}</p>
              </div>
            )}

            {/* Live counters */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#2b2f38] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{verifyProgress?.current ?? 0}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Checked</p>
              </div>
              <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{verifyProgress?.verified ?? 0}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Verified</p>
              </div>
              <div className="bg-[#2b2f38] rounded-lg p-3 text-center">
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
                className="w-full bg-[#2b2f38] hover:text-zinc-400"
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
        <DialogContent className="bg-[#24272e] border-white/10 text-white max-w-md">
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
                <div className="bg-[#2b2f38] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{bulkVerifyResult.total}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Checked</p>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{bulkVerifyResult.verified}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Verified</p>
                </div>
                <div className="bg-[#2b2f38] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-400">{bulkVerifyResult.notFound}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Not Found</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">{bulkVerifyResult.message}</p>
              <Button size="sm" className="w-full bg-[#2b2f38] hover:text-zinc-400"
                onClick={() => setBulkVerifyModalOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={csvModalOpen} onOpenChange={(v) => { if (!v) { setCsvModalOpen(false); setCsvImportResult(null); } }}>
        <DialogContent className="bg-[#24272e] border-white/10 text-white max-w-2xl">
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
                <div className="bg-[#2b2f38] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-400">{csvImportResult.skipped}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Skipped (dup)</p>
                </div>
                <div className="bg-[#2b2f38] rounded-lg p-3 text-center">
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
                className="bg-[#2b2f38] border-white/10 text-zinc-200 font-mono text-xs h-64 resize-none"
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
                <Button size="sm" variant="outline" className="border-white/10 text-zinc-400"
                  onClick={() => setCsvModalOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* v67: Reschedule modal */}
      <Dialog open={!!reschedulingCalEvt} onOpenChange={(open) => { if (!open) setReschedulingCalEvt(null); }}>
        <DialogContent className="bg-[#24272e] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <RefreshCw className="w-4 h-4 text-zinc-400" /> Reschedule Meeting
            </DialogTitle>
          </DialogHeader>
          {reschedulingCalEvt && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">{reschedulingCalEvt.title}</p>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">New Start Time</label>
                <input type="datetime-local" value={rescheduleStartAt}
                  onChange={e => setRescheduleStartAt(e.target.value)}
                  className="w-full bg-[#2b2f38] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">New End Time</label>
                <input type="datetime-local" value={rescheduleEndAt}
                  onChange={e => setRescheduleEndAt(e.target.value)}
                  className="w-full bg-[#2b2f38] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none" />
              </div>
              <p className="text-xs text-zinc-600">Emails will be sent to the prospect, Tommy, and the owner.</p>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    if (!rescheduleStartAt || !rescheduleEndAt) { toast.error("Set both times"); return; }
                    calendarReschedule.mutate({
                      id: reschedulingCalEvt.id,
                      startAt: new Date(rescheduleStartAt).toISOString(),
                      endAt: new Date(rescheduleEndAt).toISOString(),
                    });
                  }}
                  disabled={calendarReschedule.isPending}>
                  {calendarReschedule.isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                    : "Reschedule & Notify"}
                </Button>
                <Button variant="outline" className="border-white/10 text-zinc-400"
                  onClick={() => setReschedulingCalEvt(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* v69: Cancel Event confirm dialog */}
      <Dialog open={!!cancellingCalEvt} onOpenChange={(open) => { if (!open) { setCancellingCalEvt(null); setCancelCalReason(""); } }}>
        <DialogContent className="bg-[#24272e] border-red-800/40 text-white max-w-sm">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold tracking-widest uppercase text-red-400">Cancel Event</h2>
          </div>
          {cancellingCalEvt && (
            <>
              <p className="text-sm text-zinc-400 mb-4">
                Cancel <span className="font-semibold text-white">{cancellingCalEvt.title}</span>?
                {cancellingCalEvt.prospectEmail && (
                  <> Cancellation emails will be sent to {cancellingCalEvt.prospectName ?? cancellingCalEvt.prospectEmail}, Tommy, and the owner.</>
                )}
              </p>
              <div className="mb-4">
                <label className="block text-xs font-bold tracking-widest uppercase text-zinc-500 mb-1.5">Reason (optional)</label>
                <input
                  value={cancelCalReason}
                  onChange={e => setCancelCalReason(e.target.value)}
                  placeholder="e.g. Scheduling conflict, prospect unavailable…"
                  className="w-full bg-[#2b2f38] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-700"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="border-white/10 text-zinc-400"
                  onClick={() => { setCancellingCalEvt(null); setCancelCalReason(""); }}>
                  Keep Event
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white gap-1"
                  onClick={() => calendarCancel.mutate({ id: cancellingCalEvt.id, reason: cancelCalReason || undefined })}
                  disabled={calendarCancel.isPending}>
                  {calendarCancel.isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cancelling…</>
                    : <><XCircle className="w-3.5 h-3.5" /> Cancel Event & Notify</>}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </AdminPage>
    </>
  );
}
