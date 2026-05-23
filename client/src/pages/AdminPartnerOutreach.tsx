/**
 * AdminPartnerOutreach — review Cal drafts and send to partners/vendors.
 * No raw merge tokens in the send path.
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
import {
  ArrowLeft, Loader2, Mail, Send, Sparkles, Building2, AlertCircle, User,
} from "lucide-react";

type Recipient = {
  key: string;
  source: string;
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  partnerTypeLabel: string;
  greetingName: string | null;
  needsContactName: boolean;
  isGenericInbox: boolean;
  researchContactName: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  prospect: "Discovered",
  vendor: "Vendor",
  logistics_partner: "Partner",
};

function applyGreetingToBody(body: string, greetingName: string | null): string {
  const line = greetingName ? `Hi ${greetingName},` : "Hi team,";
  return body.replace(/^Hi .+?,/m, line);
}

export default function AdminPartnerOutreach() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [filterSource, setFilterSource] = useState<"all" | "prospect" | "vendor" | "logistics_partner">("all");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);

  const utils = trpc.useUtils();
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

  const updateContact = trpc.partnerOutreach.updateContact.useMutation({
    onSuccess: () => utils.partnerOutreach.listRecipients.invalidate(),
  });

  const sendOne = trpc.partnerOutreach.sendEmail.useMutation({
    onSuccess: (res) => {
      toast.success(`Sent to ${res.sentTo}`);
      if (res.warning) toast.warning(res.warning);
      utils.partnerOutreach.listRecipients.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    const source = params.get("source");
    if (source === "vendor" || source === "logistics_partner" || source === "prospect") {
      setFilterSource(source);
    }
    if (key) setActiveKey(key);
  }, [location]);

  useEffect(() => {
    if (!active) {
      setContactName("");
      setSubject("");
      setBody("");
      setDraftLoaded(false);
      return;
    }
    const name =
      active.contactName ??
      active.researchContactName ??
      active.greetingName ??
      "";
    setContactName(name);
    setDraftLoaded(false);
    void loadCalDraft(active.key, name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key]);

  async function loadCalDraft(key: string, nameOverride?: string) {
    const result = await previewCal.mutateAsync({
      recipientKey: key,
      contactName: nameOverride || undefined,
    });
    setSubject(result.subject);
    setBody(result.body);
    setDraftLoaded(true);
    if (result.greetingName && !nameOverride) {
      setContactName((prev) => prev || result.greetingName || "");
    }
  }

  function onContactNameChange(name: string) {
    setContactName(name);
    if (draftLoaded && body) {
      const first = name.trim().split(/\s+/)[0] || null;
      setBody(applyGreetingToBody(body, first));
    }
  }

  const canSend =
    !!active?.contactEmail &&
    !!subject.trim() &&
    !!body.trim() &&
    !body.includes("{{") &&
    !subject.includes("{{") &&
    (contactName.trim().length > 0 || !active.needsContactName);

  const needsName = active?.needsContactName && !contactName.trim();

  async function handleSend() {
    if (!active) return;
    if (needsName) {
      toast.error("Enter a contact first name before sending");
      return;
    }
    if (contactName.trim() && contactName !== active.contactName) {
      await updateContact.mutateAsync({ recipientKey: active.key, contactName: contactName.trim() });
    }
    const first = contactName.trim().split(/\s+/)[0] || active.greetingName;
    sendOne.mutate({
      recipientKey: active.key,
      subject,
      body: applyGreetingToBody(body, first),
      contactName: contactName.trim() || undefined,
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
    <div className="min-h-0 bg-background text-foreground flex flex-col h-[calc(100vh-0px)]">
      <header className="border-b border-border px-5 py-3 flex items-center gap-3 shrink-0">
        <Link href="/admin/partners">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8">
            <ArrowLeft size={14} /> Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold">Partner Outreach</h1>
          <p className="text-xs text-muted-foreground">Cal drafts · review · send one at a time</p>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Recipient list */}
        <aside className="w-72 shrink-0 border-r border-border flex flex-col bg-card/20">
          <div className="p-3 border-b border-border space-y-2">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
              className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-input"
            >
              <option value="all">All partners & vendors</option>
              <option value="prospect">Discovered partners</option>
              <option value="vendor">Vendor directory</option>
              <option value="logistics_partner">Logistics partners</option>
            </select>
            <p className="text-[10px] text-muted-foreground">{recipients.length} with email</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : recipients.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No contacts with email</p>
            ) : (
              recipients.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setActiveKey(r.key)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-accent/40 transition-colors ${
                    activeKey === r.key ? "bg-accent/60 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="font-medium text-sm truncate">{r.company}</div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{r.contactEmail}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{SOURCE_LABEL[r.source]}</Badge>
                    {r.needsContactName && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-500 border-amber-500/40">
                        Needs name
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Compose */}
        <main className="flex-1 flex flex-col min-w-0">
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Building2 size={36} className="opacity-20" />
              <p className="text-sm">Select a partner to review Cal&apos;s draft</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-border space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{active.company}</h2>
                  <Badge variant="secondary" className="text-xs">{active.partnerTypeLabel}</Badge>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Mail size={13} /> {active.contactEmail}
                  {active.isGenericInbox && (
                    <span className="text-amber-500 text-xs">· generic inbox</span>
                  )}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 max-w-2xl">
                {needsName && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex gap-2 text-xs text-amber-200">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Add a contact first name — we won&apos;t send with a blank greeting.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <User size={12} /> Contact first name
                  </Label>
                  <Input
                    value={contactName}
                    onChange={(e) => onContactNameChange(e.target.value)}
                    placeholder={active.isGenericInbox ? "e.g. Sarah" : "First name"}
                    className="max-w-xs"
                  />
                  {active.researchContactName && !active.contactName && (
                    <p className="text-[10px] text-muted-foreground">
                      Suggested from research: {active.researchContactName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Message</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={previewCal.isPending}
                      onClick={() => loadCalDraft(active.key, contactName || undefined)}
                    >
                      {previewCal.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      Regenerate Cal draft
                    </Button>
                  </div>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={16}
                    className="text-sm leading-relaxed font-sans resize-y min-h-[280px]"
                  />
                </div>
              </div>

              <div className="px-5 py-3 border-t border-border flex items-center justify-between shrink-0 bg-card/30">
                <p className="text-xs text-muted-foreground">
                  From outreach@onstage.bot · includes {`https://onstage.bot/get-started`}
                </p>
                <Button
                  onClick={handleSend}
                  disabled={!canSend || sendOne.isPending || updateContact.isPending}
                  className="gap-2"
                >
                  {(sendOne.isPending || updateContact.isPending) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Send email
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
