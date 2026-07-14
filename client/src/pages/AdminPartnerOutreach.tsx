/**
 * AdminPartnerOutreach — compose partner/vendor drafts + always-visible review/send queue.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import OutreachDraftQueue from "@/components/OutreachDraftQueue";
import { BRAND, emeraldAlpha } from "@/lib/brand";
import { ADMIN, adminPageOuterStyle } from "@/lib/adminTheme";
import {
  ArrowLeft, Loader2, Mail, Sparkles, Building2, AlertCircle, User,
  CheckSquare, Square, Users, ClipboardList, Send,
} from "lucide-react";

const SOURCE_LABEL: Record<string, string> = {
  prospect: "Discovered",
  vendor: "Vendor",
  logistics_partner: "Partner",
};

function applyGreetingToBody(body: string, greetingName: string | null): string {
  const line = greetingName ? `Hi ${greetingName},` : "Hi team,";
  return body.replace(/^Hi .+?,/m, line);
}

function resolveName(r: {
  contactName: string | null;
  researchContactName: string | null;
  greetingName: string | null;
}): string {
  return r.contactName ?? r.researchContactName ?? r.greetingName ?? "";
}

export default function AdminPartnerOutreach() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [filterSource, setFilterSource] = useState<"all" | "prospect" | "vendor" | "logistics_partner">("all");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contactName, setContactName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(true);

  const utils = trpc.useUtils();
  const { data: draftCount } = trpc.admin.getDraftCount.useQuery(
    { audience: "partner" },
    { enabled: isAuthenticated && user?.role === "admin", refetchInterval: 15_000 },
  );

  const { data: recipients = [], isLoading } = trpc.partnerOutreach.listRecipients.useQuery(
    { source: filterSource, hasEmail: true },
    { enabled: isAuthenticated && user?.role === "admin" },
  );

  const active = useMemo(
    () => recipients.find((r) => r.key === activeKey) ?? null,
    [recipients, activeKey],
  );

  const previewCal = trpc.partnerOutreach.previewCalEmail.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const bulkDraftCal = trpc.partnerOutreach.bulkDraftCal.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const saveDraft = trpc.partnerOutreach.saveDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft queued — approve and send below");
      utils.admin.getDrafts.invalidate();
      utils.admin.getDraftCount.invalidate();
      setQueueExpanded(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const sendNow = trpc.partnerOutreach.sendEmail.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent to ${res.sentTo}`);
      if (res.warning) toast.warning(res.warning);
      utils.partnerOutreach.listRecipients.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateContact = trpc.partnerOutreach.updateContact.useMutation({
    onSuccess: () => utils.partnerOutreach.listRecipients.invalidate(),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    const source = params.get("source");
    if (source === "vendor" || source === "logistics_partner" || source === "prospect") {
      setFilterSource(source);
    }
    if (key) {
      setActiveKey(key);
      setSelected(new Set([key]));
    }
  }, [location]);

  useEffect(() => {
    if (!active) {
      setContactName("");
      setSubject("");
      setBody("");
      return;
    }
    const name = resolveName(active);
    setContactName(name);
    void loadCalDraft(active.key, name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key]);

  async function loadCalDraft(key: string, nameOverride?: string) {
    const result = await previewCal.mutateAsync({
      recipientKey: key,
      contactName: nameOverride || undefined,
    });
    if (key === activeKey) {
      setSubject(result.subject);
      setBody(result.body);
      if (result.greetingName && !nameOverride) {
        setContactName((prev) => prev || result.greetingName || "");
      }
    }
    return result;
  }

  function onContactNameChange(name: string) {
    setContactName(name);
    const first = name.trim().split(/\s+/)[0] || null;
    setBody((prev) => applyGreetingToBody(prev, first));
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === recipients.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recipients.map((r) => r.key)));
    }
  }

  async function handleBulkDraft() {
    if (selected.size === 0) {
      toast.error("Select partners first");
      return;
    }
    setBulkBusy(true);
    try {
      const keys = Array.from(selected).slice(0, 50);
      const res = await bulkDraftCal.mutateAsync({ recipientKeys: keys });
      toast.success(`Cal drafted ${res.drafted} email${res.drafted !== 1 ? "s" : ""} — review and send below`);
      utils.admin.getDrafts.invalidate();
      utils.admin.getDraftCount.invalidate();
      setQueueExpanded(true);
    } finally {
      setBulkBusy(false);
    }
  }

  const canSend =
    !!active?.contactEmail &&
    !!subject.trim() &&
    !!body.trim() &&
    !body.includes("{{") &&
    !subject.includes("{{");

  const needsName = active?.needsContactName && !contactName.trim();

  async function prepareBody() {
    if (!active) return null;
    if (needsName && !/^Hi team,/m.test(body)) {
      toast.error("Enter a first name or use Hi team, greeting");
      return null;
    }
    if (contactName.trim() && contactName !== active.contactName) {
      await updateContact.mutateAsync({ recipientKey: active.key, contactName: contactName.trim() });
    }
    const first = contactName.trim().split(/\s+/)[0] || active.greetingName;
    return applyGreetingToBody(body, first);
  }

  async function handleQueueIndividual() {
    const prepared = await prepareBody();
    if (!prepared || !active) return;
    await saveDraft.mutateAsync({
      recipientKey: active.key,
      subject,
      body: prepared,
      contactName: contactName.trim() || undefined,
    });
  }

  async function handleSendNow() {
    if (!active) return;
    const prepared = await prepareBody();
    if (!prepared) return;
    sendNow.mutate({
      recipientKey: active.key,
      subject,
      body: prepared,
      contactName: contactName.trim() || undefined,
      allowTeamGreeting: needsName || /^Hi team,/m.test(prepared),
    });
  }

  const pendingPartnerDrafts = (draftCount?.pending ?? 0) + (draftCount?.approved ?? 0);

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-0 flex items-center justify-center" style={{ ...adminPageOuterStyle, color: ADMIN.text2 }}>
        <p>Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex flex-col" style={{ ...adminPageOuterStyle, height: "calc(100vh - 0px)" }}>
      <header className="border-b px-5 py-3 flex flex-wrap items-center gap-3 shrink-0" style={{ borderColor: ADMIN.border }}>
        <Link href="/admin/partners">
          <Button variant="ghost" size="sm" className="gap-1.5 h-8" style={{ color: "#64748b" }}>
            <ArrowLeft size={14} /> Back
          </Button>
        </Link>
        <div className="flex-1 min-w-[160px]">
          <h1 className="text-base font-semibold" style={{ color: "#ececec" }}>Partner & Vendor Outreach</h1>
          <p className="text-xs" style={{ color: "#64748b" }}>Compose with Cal · review · approve · send or bulk send</p>
        </div>
        {selected.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            style={{ borderColor: ADMIN.borderHi, color: ADMIN.text, background: ADMIN.surface }}
            disabled={bulkBusy}
            onClick={handleBulkDraft}
          >
            {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Cal draft selected ({selected.size})
          </Button>
        )}
        {pendingPartnerDrafts > 0 && (
          <Button
            size="sm"
            className="h-8 text-xs gap-1"
            style={{ background: `${BRAND.emerald}`, color: "#1C1E22" }}
            onClick={() => setQueueExpanded(true)}
          >
            <Send size={12} /> {pendingPartnerDrafts} ready to send
          </Button>
        )}
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Recipient list */}
        <aside className="w-72 shrink-0 border-r flex flex-col" style={{ borderColor: ADMIN.border, background: ADMIN.surfaceGrad }}>
          <div className="p-3 border-b space-y-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
              className="w-full text-xs rounded-md px-2 py-1.5"
              style={{ background: ADMIN.s2, border: `1px solid ${ADMIN.borderHi}`, color: ADMIN.text }}
            >
              <option value="all">All partners & vendors</option>
              <option value="prospect">Discovered partners</option>
              <option value="vendor">Vendor directory</option>
              <option value="logistics_partner">Logistics partners</option>
            </select>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-[10px]"
              style={{ color: "#64748b" }}
            >
              <Users size={11} />
              {selected.size === recipients.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin" size={20} style={{ color: "#64748b" }} />
              </div>
            ) : recipients.length === 0 ? (
              <p className="text-xs p-4 text-center" style={{ color: "#64748b" }}>No contacts with email</p>
            ) : (
              recipients.map((r) => {
                const isActive = activeKey === r.key;
                const isSel = selected.has(r.key);
                return (
                  <div
                    key={r.key}
                    className="flex items-start gap-2 px-2 py-2 border-b"
                    style={{
                      borderColor: "rgba(255,255,255,0.06)",
                      background: isActive ? emeraldAlpha(0.08) : undefined,
                      borderLeft: isActive ? `2px solid ${BRAND.emerald}` : undefined,
                    }}
                  >
                    <button type="button" className="mt-1 shrink-0" style={{ color: "#64748b" }} onClick={() => toggleSelect(r.key)}>
                      {isSel ? <CheckSquare size={15} style={{ color: `${BRAND.emerald}` }} /> : <Square size={15} />}
                    </button>
                    <button type="button" className="flex-1 text-left min-w-0" onClick={() => setActiveKey(r.key)}>
                      <div className="font-medium text-sm truncate" style={{ color: "#ececec" }}>{r.company}</div>
                      <div className="text-[10px] truncate" style={{ color: "#64748b" }}>{r.contactEmail}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{SOURCE_LABEL[r.source]}</Badge>
                        {r.needsContactName && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-500 border-amber-500/40">
                            Team greeting
                          </Badge>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Compose + send queue */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {!active ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ color: "#64748b" }}>
                <Building2 size={36} style={{ opacity: 0.2 }} />
                <p className="text-sm">Select a partner to compose, or select many and bulk-draft with Cal</p>
                {selected.size > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDraft}
                    disabled={bulkBusy}
                    className="gap-1"
                    style={{ borderColor: ADMIN.borderHi, color: ADMIN.text, background: ADMIN.surface }}
                  >
                    <Sparkles size={12} /> Cal draft {selected.size} selected
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{active.company}</h2>
                    <Badge variant="secondary" className="text-xs">{active.partnerTypeLabel}</Badge>
                  </div>
                  <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: "#64748b" }}>
                    <Mail size={13} /> {active.contactEmail}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 max-w-2xl">
                  {needsName && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex gap-2 text-xs text-amber-200">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>Add a first name for a personal greeting, or keep blank for &quot;Hi team,&quot;</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1" style={{ color: "#94a3b8" }}>
                      <User size={12} /> Contact first name
                    </Label>
                    <Input
                      value={contactName}
                      onChange={(e) => onContactNameChange(e.target.value)}
                      placeholder={active.isGenericInbox ? "Leave blank for Hi team," : "First name"}
                      className="max-w-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs" style={{ color: "#94a3b8" }}>Subject</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs" style={{ color: "#94a3b8" }}>Message</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={previewCal.isPending}
                        onClick={() => loadCalDraft(active.key, contactName || undefined)}
                      >
                        {previewCal.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        Regenerate
                      </Button>
                    </div>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={12}
                      className="text-sm leading-relaxed font-sans resize-y min-h-[220px]"
                    />
                  </div>
                </div>

                <div
                  className="px-5 py-3 border-t flex items-center justify-end gap-2 shrink-0 flex-wrap"
                  style={{ borderColor: ADMIN.border, background: ADMIN.surfaceGrad }}
                >
                  <Button
                    variant="outline"
                    onClick={handleQueueIndividual}
                    disabled={!canSend || saveDraft.isPending || updateContact.isPending}
                    className="gap-2"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#cbd5e1", background: "#1C1E22" }}
                  >
                    {(saveDraft.isPending || updateContact.isPending) ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ClipboardList size={14} />
                    )}
                    Queue for review
                  </Button>
                  <Button
                    onClick={handleSendNow}
                    disabled={!canSend || sendNow.isPending || updateContact.isPending}
                    className="gap-2"
                    style={{ background: `${BRAND.emerald}`, color: "#1C1E22" }}
                  >
                    {(sendNow.isPending || updateContact.isPending) ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Send now
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Always-visible review / approve / bulk send queue */}
          <div
            className="shrink-0 border-t overflow-y-auto"
            style={{
              borderColor: emeraldAlpha(0.25),
              background: "#1C1E22",
              maxHeight: queueExpanded ? "48vh" : "2.75rem",
              minHeight: queueExpanded ? "16rem" : "2.75rem",
            }}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between px-5 py-3 text-left"
              style={{ borderBottom: queueExpanded ? "1px solid rgba(255,255,255,0.08)" : undefined }}
              onClick={() => setQueueExpanded((v) => !v)}
            >
              <span className="text-sm font-semibold flex items-center gap-2" style={{ color: "#ececec" }}>
                <ClipboardList size={14} style={{ color: `${BRAND.emerald}` }} />
                Review · Approve · Send
                {pendingPartnerDrafts > 0 && (
                  <Badge style={{ background: emeraldAlpha(0.15), color: `${BRAND.emerald}`, border: `1px solid ${emeraldAlpha(0.35)}` }}>
                    {pendingPartnerDrafts} draft{pendingPartnerDrafts !== 1 ? "s" : ""}
                  </Badge>
                )}
              </span>
              <span className="text-xs" style={{ color: "#64748b" }}>{queueExpanded ? "Collapse" : "Expand"}</span>
            </button>
            {queueExpanded && (
              <div className="px-5 pb-5">
                <OutreachDraftQueue
                  audience="partner"
                  compact
                  emptyPending={(
                    <p style={{ color: "#64748b" }}>
                      No drafts yet — compose above and click Queue for review, or Cal draft selected partners.
                    </p>
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
