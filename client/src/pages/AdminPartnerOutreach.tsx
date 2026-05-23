/**
 * AdminPartnerOutreach — compose and send emails to partners & vendors.
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
import {
  ArrowLeft, Loader2, Mail, Send, Sparkles, Users, Building2,
  CheckSquare, Square, AlertCircle, RefreshCw,
} from "lucide-react";

const MERGE_FIELDS = [
  { label: "Company", token: "{{company}}" },
  { label: "Contact", token: "{{contact_name}}" },
  { label: "Partner type", token: "{{partner_type}}" },
  { label: "Partner hook", token: "{{partner_hook}}" },
  { label: "City", token: "{{city}}" },
];

const DEFAULT_TEMPLATE = `Hi {{contact_name}},

This is Cal from StageGate. We're the robotics logistics and technical operations team here in Las Vegas.

{{partner_hook}}

Curious whether that's come up for {{company}} — especially around CES and other Las Vegas shows.

We're not competing with your core services — we care for the robots so your team and your clients don't have to debug freight damage at midnight. Happy to talk about how a referral works.

Reply if useful, or check out onstage.bot for context.

Thanks,
Cal
StageGate
hello@onstage.bot`;

const SOURCE_LABELS: Record<string, string> = {
  prospect: "Discovered partner",
  vendor: "Vendor directory",
  logistics_partner: "Logistics partner",
};

type Recipient = {
  key: string;
  source: string;
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  partnerType: string;
  partnerTypeLabel: string;
  city: string | null;
};

function applyMerge(template: string, r: Recipient): string {
  const hook =
    r.partnerType === "exhibit_house"
      ? "I work with exhibit teams when their clients bring robots to Vegas — receiving, staging, power-up, and hands-on tech before the hall opens."
      : r.partnerType === "av" || r.partnerType === "av_electrical"
      ? "When booths include live robots, someone has to power them up and debug hardware before your AV and demo schedule starts. That's the gap we fill."
      : r.partnerType === "freight" || r.partnerType === "transport" || r.partnerType === "customs_broker"
      ? "Robot freight often needs more than drayage — bonded storage, battery-safe handling, and activation before the booth. We handle that last mile in Vegas."
      : "When your clients or partners bring robots to Las Vegas shows, we're the local team for warehouse, staging, and robot tech support.";

  return template
    .replace(/\{\{company\}\}/g, r.company)
    .replace(/\{\{contact_name\}\}/g, r.contactName ?? "there")
    .replace(/\{\{partner_type\}\}/g, r.partnerTypeLabel)
    .replace(/\{\{partner_hook\}\}/g, hook)
    .replace(/\{\{city\}\}/g, r.city ?? "Las Vegas");
}

export default function AdminPartnerOutreach() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [subjectTemplate, setSubjectTemplate] = useState("Quick note — robotics support in Vegas ({{company}})");
  const [filterSource, setFilterSource] = useState<"all" | "prospect" | "vendor" | "logistics_partner">("all");
  const [emailOnly, setEmailOnly] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customBodies, setCustomBodies] = useState<Record<string, string>>({});
  const [customSubjects, setCustomSubjects] = useState<Record<string, string>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { data: recipients = [], isLoading, refetch } = trpc.partnerOutreach.listRecipients.useQuery(
    { source: filterSource, hasEmail: emailOnly || undefined },
    { enabled: isAuthenticated && user?.role === "admin" },
  );

  const previewCal = trpc.partnerOutreach.previewCalEmail.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const bulkSend = trpc.partnerOutreach.bulkSend.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} email${res.sent !== 1 ? "s" : ""}${res.failed ? ` · ${res.failed} failed` : ""}`);
      if (res.errors.length) toast.error(res.errors.slice(0, 2).join("; "));
      setSending(false);
      refetch();
    },
    onError: (e) => { toast.error(e.message); setSending(false); },
  });

  const sendOne = trpc.partnerOutreach.sendEmail.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent to ${res.sentTo}`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Pre-select from ?key=vendor:12 query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    const source = params.get("source");
    if (source === "vendor" || source === "logistics_partner" || source === "prospect") {
      setFilterSource(source);
    }
    if (key) {
      setSelected(new Set([key]));
      setExpandedKey(key);
    }
  }, [location]);

  const selectedList = useMemo(
    () => recipients.filter((r) => selected.has(r.key) && r.contactEmail),
    [recipients, selected],
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    const withEmail = recipients.filter((r) => r.contactEmail);
    if (withEmail.every((r) => selected.has(r.key))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withEmail.map((r) => r.key)));
    }
  }

  async function loadCalDraft(key: string) {
    const result = await previewCal.mutateAsync({ recipientKey: key });
    setCustomSubjects((p) => ({ ...p, [key]: result.subject }));
    setCustomBodies((p) => ({ ...p, [key]: result.body }));
    setExpandedKey(key);
  }

  async function handleSendSelected() {
    if (selectedList.length === 0) {
      toast.error("Select at least one recipient with an email");
      return;
    }
    setSending(true);
    bulkSend.mutate({
      sends: selectedList.map((r) => ({
        recipientKey: r.key,
        subject: customSubjects[r.key] ?? applyMerge(subjectTemplate, r),
        body: customBodies[r.key] ?? applyMerge(template, r),
      })),
    });
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-0 bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex flex-wrap items-center gap-4 shrink-0">
        <Link href="/admin/partners">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft size={14} /> Partners
          </Button>
        </Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg font-display font-bold flex items-center gap-2">
            <Mail size={18} className="text-primary" /> Partner Outreach
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Email exhibit houses, AV, freight, vendors, and discovered partners
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedList.length} ready to send
          </span>
          <Button
            onClick={handleSendSelected}
            disabled={sending || selectedList.length === 0}
            className="gap-2"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send {selectedList.length > 0 ? `(${selectedList.length})` : ""}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Template panel */}
        <div className="w-[420px] shrink-0 border-r border-border flex flex-col bg-card/30">
          <div className="p-4 border-b border-border space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Subject template
              </label>
              <Input
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
                className="text-sm bg-input border-border"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {MERGE_FIELDS.map((f) => (
                <button
                  key={f.token}
                  type="button"
                  onClick={() => setTemplate((t) => t + f.token)}
                  className="text-[10px] font-mono bg-secondary border border-border rounded px-1.5 py-0.5 hover:border-primary/50"
                >
                  {f.token}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            className="flex-1 resize-none border-0 rounded-none text-sm font-mono bg-transparent focus-visible:ring-0 min-h-[200px]"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
          <div className="p-3 border-t border-border">
            <button
              type="button"
              onClick={() => setTemplate(DEFAULT_TEMPLATE)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={11} /> Reset template
            </button>
          </div>
        </div>

        {/* Recipients */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
              className="text-xs border border-border rounded px-2 py-1.5 bg-input"
            >
              <option value="all">All sources</option>
              <option value="prospect">Discovered partners</option>
              <option value="vendor">Vendors</option>
              <option value="logistics_partner">Logistics partners</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={emailOnly} onChange={(e) => setEmailOnly(e.target.checked)} />
              Has email only
            </label>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={toggleAll}>
              <Users size={12} />
              {recipients.filter((r) => r.contactEmail).every((r) => selected.has(r.key)) ? "Deselect all" : "Select all"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : recipients.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Building2 size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No partners match your filters</p>
                <p className="text-xs mt-1">Add vendors in Vendors, partners in Partners, or run Cal discovery.</p>
              </div>
            ) : (
              recipients.map((r) => {
                const isSel = selected.has(r.key);
                const isExp = expandedKey === r.key;
                const mergedSubject = customSubjects[r.key] ?? applyMerge(subjectTemplate, r);
                const mergedBody = customBodies[r.key] ?? applyMerge(template, r);

                return (
                  <div
                    key={r.key}
                    className={`rounded-lg border transition-colors ${
                      isSel ? "border-primary/40 bg-card" : "border-border bg-card/40 opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3">
                      <button type="button" onClick={() => toggle(r.key)} className="mt-0.5 shrink-0">
                        {isSel ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">{r.company}</span>
                          <Badge variant="outline" className="text-[10px]">{r.partnerTypeLabel}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{SOURCE_LABELS[r.source] ?? r.source}</Badge>
                        </div>
                        {r.contactEmail ? (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Mail size={10} /> {r.contactEmail}
                            {r.contactName && <span> · {r.contactName}</span>}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
                            <AlertCircle size={10} /> No email — add contact in directory
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 gap-1"
                          disabled={previewCal.isPending}
                          onClick={() => loadCalDraft(r.key)}
                        >
                          <Sparkles size={10} /> Cal draft
                        </Button>
                        {r.contactEmail && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] h-7"
                            onClick={() => setExpandedKey(isExp ? null : r.key)}
                          >
                            {isExp ? "Hide" : "Preview"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExp && r.contactEmail && (
                      <div className="border-t border-border p-3 space-y-2 bg-background/50">
                        <Input
                          value={mergedSubject}
                          onChange={(e) => setCustomSubjects((p) => ({ ...p, [r.key]: e.target.value }))}
                          className="text-xs"
                        />
                        <Textarea
                          value={mergedBody}
                          onChange={(e) => setCustomBodies((p) => ({ ...p, [r.key]: e.target.value }))}
                          rows={8}
                          className="text-xs font-mono"
                        />
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={sendOne.isPending}
                          onClick={() =>
                            sendOne.mutate({
                              recipientKey: r.key,
                              subject: mergedSubject,
                              body: mergedBody,
                            })
                          }
                        >
                          {sendOne.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Send to {r.contactEmail}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
