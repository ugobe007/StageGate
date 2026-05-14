import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import DbStatusBanner from "@/components/DbStatusBanner";

type DraftStatus = "pending" | "approved" | "sent" | "discarded";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DraftEntry = any;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  discarded: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function AdminOutreach() {
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "sent">("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [confirmBulkSend, setConfirmBulkSend] = useState(false);

  const utils = trpc.useUtils();

  const statusFilter =
    activeTab === "pending" ? ["pending"] :
    activeTab === "approved" ? ["approved"] :
    ["sent"];

  const { data: drafts = [], isLoading } = trpc.admin.getDrafts.useQuery(
    { statuses: statusFilter },
    { refetchInterval: 15_000 }
  );

  const generateMutation = trpc.admin.generateDrafts.useMutation({
    onSuccess: (res) => {
      const generated = res.result?.generated ?? 0;
      toast.success(`Generated ${generated} draft${generated !== 1 ? "s" : ""}`);
      utils.admin.getDrafts.invalidate();
      setGenerating(false);
    },
    onError: (e) => { toast.error(e.message); setGenerating(false); },
  });

  const approveMutation = trpc.admin.approveDraft.useMutation({
    onSuccess: () => { toast.success("Draft approved"); utils.admin.getDrafts.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const discardMutation = trpc.admin.discardDraft.useMutation({
    onSuccess: () => { toast.success("Draft discarded"); utils.admin.getDrafts.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const editMutation = trpc.admin.editDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft saved");
      setEditingId(null);
      utils.admin.getDrafts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendMutation = trpc.admin.sendDraft.useMutation({
    onSuccess: (res) => {
      toast.success(`Email sent to ${res.sentTo}`);
      utils.admin.getDrafts.invalidate();
      setExpandedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkSendMutation = trpc.admin.bulkSendDrafts.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} email${res.sent !== 1 ? "s" : ""}${res.failed > 0 ? `, ${res.failed} failed` : ""}`);
      if (res.errors.length > 0) toast.error(res.errors.slice(0, 3).join("; "));
      setSelectedIds(new Set());
      setConfirmBulkSend(false);
      utils.admin.getDrafts.invalidate();
    },
    onError: (e) => { toast.error(e.message); setConfirmBulkSend(false); },
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateMutation.mutate({});
  };

  const handleEdit = (entry: DraftEntry) => {
    setEditingId(entry.draft.id);
    setEditSubject(entry.draft.subject);
    setEditBody(entry.draft.body);
    setExpandedId(entry.draft.id);
  };

  const handleSaveEdit = (draftId: number) => {
    editMutation.mutate({ draftId, subject: editSubject, body: editBody });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((drafts as DraftEntry[]).map((d) => d.draft.id)));
    }
  };

  const tabCounts = {
    pending: activeTab === "pending" ? drafts.length : "?",
    approved: activeTab === "approved" ? drafts.length : "?",
    sent: activeTab === "sent" ? drafts.length : "?",
  };

  return (
    <>
      <DbStatusBanner />
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">XBOT / OUTREACH</p>
              <h1 className="text-3xl font-bold tracking-tight">Email Drafts</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Review AI-generated outreach emails before sending via Resend from outreach@onstage.bot
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || generateMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {generating || generateMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border border-black border-t-transparent rounded-full" />
                  Generating…
                </span>
              ) : (
                "⚡ Generate Drafts"
              )}
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {(["pending", "approved", "sent"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); setExpandedId(null); setEditingId(null); }}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">{drafts.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Bulk toolbar */}
          {activeTab !== "sent" && drafts.length > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg border border-border">
              <input
                type="checkbox"
                checked={selectedIds.size === drafts.length && drafts.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 accent-amber-500"
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
              </span>
              {selectedIds.size > 0 && (
                <>
                  {activeTab === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        selectedIds.forEach((id) => approveMutation.mutate({ draftId: id }));
                        setSelectedIds(new Set());
                      }}
                      className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                    >
                      ✓ Approve {selectedIds.size}
                    </Button>
                  )}
                  {confirmBulkSend ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm text-red-400">Send {selectedIds.size} emails?</span>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => bulkSendMutation.mutate({ draftIds: Array.from(selectedIds) })}
                        disabled={bulkSendMutation.isPending}
                      >
                        {bulkSendMutation.isPending ? "Sending…" : "Confirm Send"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmBulkSend(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="ml-auto bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                      onClick={() => setConfirmBulkSend(true)}
                    >
                      ✉ Send {selectedIds.size} Now
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Draft list */}
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading drafts…</div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {activeTab === "pending" ? (
                <div>
                  <p className="text-lg mb-2">No pending drafts</p>
                  <p className="text-sm">Click "⚡ Generate Drafts" to have XBOT write personalized emails for all 78 prospects.</p>
                </div>
              ) : activeTab === "approved" ? (
                <p>No approved drafts. Approve drafts from the Pending tab first.</p>
              ) : (
                <p>No emails sent yet.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {(drafts as DraftEntry[]).map((entry) => {
                const isExpanded = expandedId === entry.draft.id;
                const isEditing = editingId === entry.draft.id;

                return (
                  <div
                    key={entry.draft.id}
                    className={`border rounded-lg transition-all ${
                      isExpanded ? "border-amber-500/40 bg-muted/20" : "border-border hover:border-border/80"
                    }`}
                  >
                    {/* Row header */}
                    <div className="flex items-center gap-3 p-4">
                      {activeTab !== "sent" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.draft.id)}
                          onChange={() => toggleSelect(entry.draft.id)}
                          className="h-4 w-4 accent-amber-500 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : entry.draft.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{entry.prospect.company}</span>
                          {entry.prospect.contactName && (
                            <span className="text-xs text-muted-foreground">→ {entry.prospect.contactName}</span>
                          )}
                          {entry.prospect.contactEmail && (
                            <span className="text-xs text-muted-foreground font-mono">{entry.prospect.contactEmail}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[entry.draft.status] ?? ""}`}>
                            {entry.draft.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          <span className="text-foreground/70">Subject:</span> {entry.draft.subject}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {activeTab === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-400 border-green-500/30 hover:bg-green-500/10 h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); approveMutation.mutate({ draftId: entry.draft.id }); }}
                            >
                              ✓ Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); discardMutation.mutate({ draftId: entry.draft.id }); }}
                            >
                              Discard
                            </Button>
                          </>
                        )}
                        {(activeTab === "pending" || activeTab === "approved") && (
                          <Button
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendMutation.mutate({ draftId: entry.draft.id });
                            }}
                            disabled={sendMutation.isPending}
                          >
                            ✉ Send
                          </Button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.draft.id)}
                          className="text-muted-foreground hover:text-foreground ml-1"
                        >
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        {/* Agent reasoning */}
                        {entry.draft.agentReasoning && (
                          <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2 border border-border">
                            <span className="text-amber-400 font-medium">Agent reasoning: </span>
                            {entry.draft.agentReasoning}
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                              <Input
                                value={editSubject}
                                onChange={(e) => setEditSubject(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Body</label>
                              <Textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                rows={10}
                                className="text-sm font-mono"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-black"
                                onClick={() => handleSaveEdit(entry.draft.id)}
                                disabled={editMutation.isPending}
                              >
                                {editMutation.isPending ? "Saving…" : "Save Changes"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/70">Subject: </span>
                              {entry.draft.subject}
                            </div>
                            <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/20 rounded p-3 border border-border leading-relaxed">
                              {entry.draft.body}
                            </pre>
                            {activeTab !== "sent" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => handleEdit(entry)}
                              >
                                ✏ Edit Draft
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
