import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import DbStatusBanner from "@/components/DbStatusBanner";
import { ChevronDown, ChevronUp, RefreshCw, Send, Users, ArrowLeft } from "lucide-react";

type DraftStatus = "pending" | "approved" | "sent" | "discarded";
type WorkflowTab = "pending" | "approved" | "sent";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DraftEntry = any;

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#00ff87",
  sent: "#3b82f6",
  discarded: "rgba(255,255,255,0.30)",
};

const TAB_LABELS: Record<WorkflowTab, string> = {
  pending: "Review",
  approved: "Ready to Send",
  sent: "Sent",
};

export default function AdminOutreach() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<WorkflowTab>("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [confirmBulkSend, setConfirmBulkSend] = useState<{ count: number; ids: number[] } | null>(null);

  const utils = trpc.useUtils();

  const statusFilter =
    activeTab === "pending" ? ["pending"] :
    activeTab === "approved" ? ["approved"] :
    ["sent"];

  const { data: drafts = [], isLoading } = trpc.admin.getDrafts.useQuery(
    { statuses: statusFilter },
    { refetchInterval: 15_000 }
  );

  const { data: draftCount } = trpc.admin.getDraftCount.useQuery(undefined, { refetchInterval: 15_000 });

  const pendingCount = draftCount?.pending ?? 0;
  const approvedCount = draftCount?.approved ?? 0;
  const sentCount = draftCount?.sent ?? 0;
  const sendableCount = pendingCount + approvedCount;

  const { data: allSendableDrafts = [] } = trpc.admin.getDrafts.useQuery(
    { statuses: ["pending", "approved"] },
    { refetchInterval: 15_000, enabled: sendableCount > 0 }
  );

  const generateMutation = trpc.admin.generateDrafts.useMutation({
    onSuccess: (res) => {
      const r = res.result as { generated?: number; skipped?: number; conversationsSeeded?: number; errors?: string[] } | undefined;
      const generated = r?.generated ?? 0;
      const seeded = r?.conversationsSeeded ?? 0;
      const errs = r?.errors?.length ?? 0;
      let msg = `Cal drafted ${generated} email${generated !== 1 ? "s" : ""}`;
      if (seeded > 0) msg += ` · queued ${seeded} new prospect${seeded !== 1 ? "s" : ""} for follow-ups`;
      if (errs > 0) msg += ` · ${errs} error${errs !== 1 ? "s" : ""}`;
      toast.success(msg);
      utils.admin.getDrafts.invalidate();
      utils.admin.getDraftCount.invalidate();
      setGenerating(false);
    },
    onError: (e) => { toast.error(e.message); setGenerating(false); },
  });

  const approveMutation = trpc.admin.approveDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft approved");
      utils.admin.getDrafts.invalidate();
      utils.admin.getDraftCount.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const discardMutation = trpc.admin.discardDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft discarded");
      utils.admin.getDrafts.invalidate();
      utils.admin.getDraftCount.invalidate();
    },
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
      utils.admin.getDraftCount.invalidate();
      utils.prospects.listWithEngagement.invalidate();
      setExpandedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkSendMutation = trpc.admin.bulkSendDrafts.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} email${res.sent !== 1 ? "s" : ""}${res.failed > 0 ? `, ${res.failed} failed` : ""}`);
      if (res.errors.length > 0) toast.error(res.errors.slice(0, 3).join("; "));
      setSelectedIds(new Set());
      setConfirmBulkSend(null);
      utils.admin.getDrafts.invalidate();
      utils.admin.getDraftCount.invalidate();
      utils.prospects.listWithEngagement.invalidate();
    },
    onError: (e) => { toast.error(e.message); setConfirmBulkSend(null); },
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

  const draftIdsOnTab = (drafts as DraftEntry[]).map((d) => d.draft.id as number);
  const allSendableIds = (allSendableDrafts as DraftEntry[]).map((d) => d.draft.id as number);

  const handleApproveAll = () => {
    if (activeTab !== "pending" || drafts.length === 0) return;
    draftIdsOnTab.forEach((id) => approveMutation.mutate({ draftId: id }));
    toast.success(`Approved ${draftIdsOnTab.length} draft${draftIdsOnTab.length !== 1 ? "s" : ""}`);
    setSelectedIds(new Set());
  };

  const requestBulkSend = (ids: number[]) => {
    if (ids.length === 0) return;
    setConfirmBulkSend({ count: ids.length, ids });
  };

  const executeBulkSend = () => {
    if (!confirmBulkSend) return;
    bulkSendMutation.mutate({ draftIds: confirmBulkSend.ids });
  };

  const tabCounts: Record<WorkflowTab, number> = {
    pending: pendingCount,
    approved: approvedCount,
    sent: sentCount,
  };

  return (
    <>
      <DbStatusBanner />
      <div style={{ padding: "2rem", maxWidth: "52rem", margin: "0 auto", color: "#ececec" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.30)", margin: "0 0 0.25rem" }}>OUTREACH</p>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0 }}>Review Cal&apos;s drafts</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0.25rem 0 0" }}>
            Up to 3 emails per lead, one week apart — read, edit, send when ready
          </p>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem",
        }}>
          <button
            onClick={() => setLocation("/admin/prospects")}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.75rem",
              border: "1px solid rgba(255,255,255,0.10)", background: "#111111",
              color: "rgba(255,255,255,0.55)", borderRadius: "0.375rem", cursor: "pointer",
            }}
          >
            <ArrowLeft size={13} /> Prospects
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || generateMutation.isPending}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              fontSize: "0.8125rem", fontWeight: 600, padding: "0.375rem 0.875rem",
              border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24",
              background: "rgba(251,191,36,0.06)", borderRadius: "0.375rem",
              cursor: generating ? "wait" : "pointer", opacity: generating ? 0.7 : 1,
            }}
          >
            <RefreshCw size={13} style={generating ? { animation: "spin 1s linear infinite" } : undefined} />
            {generating ? "Drafting…" : "Draft new with Cal"}
          </button>
        </div>

        {/* Send bar when drafts are ready */}
        {sendableCount > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1.25rem",
            padding: "0.875rem 1rem",
            border: "1px solid rgba(0,255,135,0.30)",
            borderRadius: "0.5rem",
            background: "rgba(0,255,135,0.04)",
          }}>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ececec", margin: 0 }}>
                Ready to send
                {selectedIds.size > 0 && <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 400 }}> · {selectedIds.size} selected</span>}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {confirmBulkSend ? (
                <>
                  <span style={{ fontSize: "0.8125rem", color: "#fbbf24" }}>Send {confirmBulkSend.count} emails?</span>
                  <button
                    onClick={executeBulkSend}
                    disabled={bulkSendMutation.isPending}
                    style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 700, padding: "0.5rem 1rem", border: "none", background: "#00ff87", color: "#080808", borderRadius: "0.375rem", cursor: "pointer" }}
                  >
                    <Send size={13} />
                    {bulkSendMutation.isPending ? "Sending…" : "Confirm Bulk Send"}
                  </button>
                  <button onClick={() => setConfirmBulkSend(null)} style={{ fontSize: "0.8125rem", padding: "0.5rem 0.75rem", border: "1px solid rgba(255,255,255,0.12)", background: "#111111", color: "#cbd5e1", borderRadius: "0.375rem", cursor: "pointer" }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => requestBulkSend(Array.from(selectedIds))}
                      style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 600, padding: "0.5rem 1rem", border: "1px solid rgba(0,255,135,0.40)", color: "#00ff87", background: "transparent", borderRadius: "0.375rem", cursor: "pointer" }}
                    >
                      <Send size={13} /> Send Selected ({selectedIds.size})
                    </button>
                  )}
                  <button
                    onClick={() => requestBulkSend(allSendableIds.length > 0 ? allSendableIds : draftIdsOnTab)}
                    style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 700, padding: "0.5rem 1.25rem", border: "none", background: "#00ff87", color: "#080808", borderRadius: "0.375rem", cursor: "pointer", boxShadow: "0 0 20px rgba(0,255,135,0.20)" }}
                  >
                    <Users size={13} />
                    Bulk Send All ({allSendableIds.length || sendableCount})
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1rem" }}>
          {(["pending", "approved", "sent"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); setExpandedId(null); setEditingId(null); setConfirmBulkSend(null); }}
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.875rem", fontWeight: 500,
                background: "none", border: "none",
                borderBottom: `2px solid ${activeTab === tab ? (tab === "sent" ? "#60a5fa" : tab === "approved" ? "#00ff87" : "#f59e0b") : "transparent"}`,
                color: activeTab === tab ? "#ececec" : "#64748b",
                cursor: "pointer",
                marginBottom: "-1px",
                display: "flex", alignItems: "center", gap: "0.4rem",
              }}
            >
              {TAB_LABELS[tab]}
              <span style={{ fontSize: "0.75rem", background: activeTab === tab ? "#1a1a1a" : "transparent", color: activeTab === tab ? "#64748b" : "rgba(255,255,255,0.25)", padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>
                {tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Row selection toolbar */}
        {activeTab !== "sent" && drafts.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", padding: "0.625rem 0.875rem", background: "#080808", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem" }}>
            <input
              type="checkbox"
              checked={selectedIds.size === drafts.length && drafts.length > 0}
              onChange={toggleSelectAll}
              style={{ width: "1rem", height: "1rem", accentColor: "#f59e0b" }}
            />
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all on this tab"}
            </span>
            {activeTab === "pending" && drafts.length > 0 && (
              <button
                onClick={handleApproveAll}
                style={{ marginLeft: "auto", fontSize: "0.8125rem", fontWeight: 500, padding: "0.25rem 0.75rem", border: "1px solid rgba(62,207,142,0.4)", color: "#00ff87", background: "#111111", borderRadius: "0.25rem", cursor: "pointer" }}
              >
                ✓ Approve All ({drafts.length})
              </button>
            )}
          </div>
        )}

        {/* Draft list */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "rgba(255,255,255,0.30)", fontSize: "0.875rem" }}>Loading drafts…</div>
        ) : drafts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "rgba(255,255,255,0.30)", fontSize: "0.875rem" }}>
            {activeTab === "pending" ? (
              sentCount > 0 && sendableCount === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.45)" }}>Nothing pending review. Browse sent mail on the Sent tab.</p>
              ) : (
                <div>
                  <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", marginBottom: "0.5rem" }}>No drafts yet</p>
                  <p style={{ marginBottom: "1rem" }}>Pick prospects and ask Cal to draft — or use Draft new with Cal above.</p>
                  <button onClick={() => setLocation("/admin/prospects")} style={{ fontSize: "0.8125rem", fontWeight: 600, padding: "0.5rem 1rem", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", background: "transparent", borderRadius: "0.375rem", cursor: "pointer" }}>
                    ← Go to Prospects
                  </button>
                </div>
              )
            ) : activeTab === "approved" ? (
              <p>No approved drafts. Review pending drafts first, or send directly from Review tab.</p>
            ) : (
              <p>No emails sent yet.</p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {(drafts as DraftEntry[]).map((entry) => {
              const isExpanded = expandedId === entry.draft.id;
              const isEditing = editingId === entry.draft.id;
              const statusColor = STATUS_COLORS[entry.draft.status as DraftStatus] ?? "rgba(255,255,255,0.30)";

              return (
                <div
                  key={entry.draft.id}
                  style={{
                    border: `1px solid ${isExpanded ? "#f59e0b" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: "0.5rem",
                    background: "#111111",
                    overflow: "hidden",
                    transition: "border-color 0.1s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem" }}>
                    {activeTab !== "sent" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.draft.id)}
                        onChange={() => toggleSelect(entry.draft.id)}
                        style={{ width: "1rem", height: "1rem", accentColor: "#f59e0b", flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                      onClick={() => setExpandedId(isExpanded ? null : entry.draft.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec" }}>{entry.prospect.company}</span>
                        {entry.prospect.contactName && (
                          <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>→ {entry.prospect.contactName}</span>
                        )}
                        {entry.prospect.contactEmail && (
                          <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)" }}>{entry.prospect.contactEmail}</span>
                        )}
                        <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: statusColor }}>
                          {entry.draft.status}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.125rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>Subject:</span> {entry.draft.subject}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      {activeTab === "pending" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); approveMutation.mutate({ draftId: entry.draft.id }); }}
                            style={{ fontSize: "0.8125rem", fontWeight: 500, padding: "0.25rem 0.625rem", border: "1px solid rgba(62,207,142,0.45)", color: "#00ff87", background: "#0b0b0b", borderRadius: "0.25rem", cursor: "pointer" }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); discardMutation.mutate({ draftId: entry.draft.id }); }}
                            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.625rem", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", background: "#0b0b0b", borderRadius: "0.25rem", cursor: "pointer" }}
                          >
                            Discard
                          </button>
                        </>
                      )}
                      {activeTab !== "sent" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sendMutation.mutate({ draftId: entry.draft.id });
                          }}
                          disabled={sendMutation.isPending}
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8125rem", fontWeight: 700, padding: "0.375rem 0.875rem", border: "none", background: "#00ff87", color: "#080808", borderRadius: "0.25rem", cursor: "pointer" }}
                        >
                          <Send size={12} /> Send
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.draft.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: "0.25rem", display: "flex", alignItems: "center" }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {entry.draft.agentReasoning && (
                        <div style={{ fontSize: "0.8125rem", color: "#64748b", background: "#080808", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <span style={{ color: "#f59e0b", fontWeight: 600 }}>Draft note: </span>
                          {entry.draft.agentReasoning}
                        </div>
                      )}

                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div>
                            <label style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>Subject</label>
                            <Input
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              style={{ fontSize: "0.875rem" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>Body</label>
                            <Textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              rows={10}
                              style={{ fontSize: "0.875rem", fontFamily: "monospace" }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => handleSaveEdit(entry.draft.id)}
                              disabled={editMutation.isPending}
                              style={{ fontSize: "0.875rem", fontWeight: 600, padding: "0.375rem 0.875rem", border: "none", background: "#f59e0b", color: "#000", borderRadius: "0.25rem", cursor: "pointer" }}
                            >
                              {editMutation.isPending ? "Saving…" : "Save Changes"}
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ fontSize: "0.875rem", padding: "0.375rem 0.875rem", border: "1px solid rgba(255,255,255,0.12)", background: "#111111", color: "#cbd5e1", borderRadius: "0.25rem", cursor: "pointer" }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                            <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>Subject: </span>
                            {entry.draft.subject}
                          </div>
                          <pre style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#080808", borderRadius: "0.375rem", padding: "0.875rem", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.6, color: "#ececec", margin: 0 }}>
                            {entry.draft.body}
                          </pre>
                          {activeTab !== "sent" && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                onClick={() => handleEdit(entry)}
                                style={{ fontSize: "0.8125rem", fontWeight: 500, padding: "0.25rem 0.75rem", border: "1px solid rgba(255,255,255,0.12)", background: "#111111", color: "#cbd5e1", borderRadius: "0.25rem", cursor: "pointer" }}
                              >
                                ✏ Edit Draft
                              </button>
                              <button
                                onClick={() => sendMutation.mutate({ draftId: entry.draft.id })}
                                disabled={sendMutation.isPending}
                                style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8125rem", fontWeight: 700, padding: "0.25rem 0.875rem", border: "none", background: "#00ff87", color: "#080808", borderRadius: "0.25rem", cursor: "pointer" }}
                              >
                                <Send size={12} /> Send Now
                              </button>
                            </div>
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
    </>
  );
}
