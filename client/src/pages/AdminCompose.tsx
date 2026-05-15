/**
 * AdminCompose — Bulk Message Composer
 *
 * Allows the admin to:
 * 1. Select prospects as recipients (filter by show, status, or individual)
 * 2. Review AI context block per company (robot, show, why StageGate)
 * 3. Edit a shared message template with merge fields
 * 4. Preview the merged message per recipient
 * 5. Send all or send individually
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  Loader2, Send, Eye, X, Check, ChevronDown, ChevronUp,
  Users, Bot, MapPin, Mail, Sparkles, RefreshCw, Filter,
  CheckSquare, Square, AlertCircle, Building2, Zap,
} from "lucide-react";

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
  shows: string[] | null;
  status: string;
  emailConfidence: string | null;
};

type RecipientState = {
  selected: boolean;
  customMessage: string | null;
  previewing: boolean;
  briefLoaded: boolean;
  brief: { summary: string; whyStageGate: string; showIntel: string } | null;
};

// ─── Merge field helper ───────────────────────────────────────────────────────

const MERGE_FIELDS = [
  { label: "Company", token: "{{company}}" },
  { label: "Contact Name", token: "{{contact_name}}" },
  { label: "Robot Name", token: "{{robot_name}}" },
  { label: "Show Name", token: "{{show_name}}" },
  { label: "Robot Type", token: "{{robot_type}}" },
];

function applyMergeFields(template: string, prospect: Prospect): string {
  return template
    .replace(/\{\{company\}\}/g, prospect.company)
    .replace(/\{\{contact_name\}\}/g, prospect.contactName ?? prospect.company)
    .replace(/\{\{robot_name\}\}/g, prospect.robotName ?? "your robot")
    .replace(/\{\{show_name\}\}/g, prospect.shows?.[0] ?? "the upcoming show")
    .replace(/\{\{robot_type\}\}/g, prospect.robotType ?? "robot");
}

// ─── Recipient Row ────────────────────────────────────────────────────────────

function RecipientRow({
  prospect,
  state,
  template,
  onToggle,
  onCustomChange,
  onPreviewToggle,
}: {
  prospect: Prospect;
  state: RecipientState;
  template: string;
  onToggle: () => void;
  onCustomChange: (msg: string | null) => void;
  onPreviewToggle: () => void;
}) {
  const merged = applyMergeFields(state.customMessage ?? template, prospect);
  const confidenceColor: Record<string, string> = {
    verified: "text-emerald-400",
    high: "text-blue-400",
    medium: "text-amber-400",
    low: "text-red-400",
  };

  return (
    <div className={`border rounded-lg transition-all ${
      state.selected ? "border-zinc-600 bg-zinc-800/60" : "border-zinc-800 bg-zinc-900/40 opacity-60"
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={onToggle}
          className="text-zinc-400 hover:text-white shrink-0 transition-colors"
          aria-label={state.selected ? "Deselect" : "Select"}
        >
          {state.selected ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-white">{prospect.company}</span>
            {prospect.robotName && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                <Bot size={10} />
                {prospect.robotName}
                {prospect.robotType && <span className="text-zinc-600">· {prospect.robotType}</span>}
              </span>
            )}
            {prospect.shows?.slice(0, 2).map(s => (
              <span key={s} className="text-[10px] bg-zinc-700/60 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700/40">
                {s}
              </span>
            ))}
          </div>
          {prospect.contactEmail ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Mail size={10} className="text-zinc-600" />
              <span className="text-[11px] text-zinc-400">{prospect.contactEmail}</span>
              {prospect.emailConfidence && (
                <span className={`text-[10px] font-medium ${confidenceColor[prospect.emailConfidence] ?? "text-zinc-500"}`}>
                  · {prospect.emailConfidence}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertCircle size={10} className="text-amber-500" />
              <span className="text-[11px] text-amber-500">No email on file</span>
            </div>
          )}
        </div>

        {state.selected && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onPreviewToggle}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded px-2 py-1 transition-colors"
            >
              <Eye size={10} />
              {state.previewing ? "Hide" : "Preview"}
            </button>
            {state.customMessage !== null && (
              <button
                onClick={() => onCustomChange(null)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded px-1.5 py-1 transition-colors"
                title="Reset to template"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preview / custom edit */}
      {state.selected && state.previewing && (
        <div className="border-t border-zinc-700/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {state.customMessage !== null ? "Custom Message" : "Merged Preview"}
            </span>
            {state.customMessage === null && (
              <button
                onClick={() => onCustomChange(merged)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Edit for this recipient
              </button>
            )}
          </div>
          <textarea
            className="w-full h-32 text-[12px] text-zinc-200 leading-relaxed border border-zinc-700 rounded p-2.5 resize-none focus:outline-none focus:border-emerald-500 bg-zinc-900 placeholder:text-zinc-600"
            value={state.customMessage !== null ? state.customMessage : merged}
            readOnly={state.customMessage === null}
            onChange={e => state.customMessage !== null && onCustomChange(e.target.value)}
          />
          {/* AI context block */}
          {state.brief && (
            <div className="mt-2 bg-zinc-800/60 rounded p-2.5 border border-zinc-700/40">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={10} className="text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">AI Context</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{state.brief.summary}</p>
              {state.brief.whyStageGate && (
                <p className="text-[11px] text-emerald-400 mt-1">↳ {state.brief.whyStageGate}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = `Hi {{contact_name}},

I wanted to reach out about {{company}}'s upcoming appearance at {{show_name}}.

We're StageGate — the only end-to-end logistics and activation platform built specifically for robot companies exhibiting at trade shows in Las Vegas. We handle everything from crate receiving and customs clearance to on-floor staging and post-show storage, so your team can focus entirely on the demo.

For {{robot_name}}, we'd love to put together a custom activation plan. Our team has experience with {{robot_type}} systems and knows exactly what it takes to make a Las Vegas debut go smoothly.

Would you be open to a quick call this week?

Register for StageGate services: https://onstage.bot/get-started

Best,
The StageGate Team`;

export default function AdminCompose() {
  const { user, isAuthenticated, loading } = useAuth();
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [filterShow, setFilterShow] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [recipientStates, setRecipientStates] = useState<Record<number, RecipientState>>({});
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [showMergeFields, setShowMergeFields] = useState(false);

  const { data, isLoading } = trpc.prospects.list.useQuery(
    {},
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const generateDraft = trpc.admin.generateDrafts.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const rawProspects = (data?.prospects ?? []) as unknown as Prospect[];

  const allShows = useMemo(() => {
    const set = new Set<string>();
    for (const p of rawProspects) for (const s of p.shows ?? []) set.add(s);
    return Array.from(set).sort();
  }, [rawProspects]);

  const filtered = useMemo(() => {
    return rawProspects.filter(p => {
      if (filterShow !== "all" && !p.shows?.includes(filterShow)) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [rawProspects, filterShow, filterStatus]);

  // Initialize recipient states for new prospects
  const prospects = useMemo(() => {
    return filtered.map(p => {
      if (!recipientStates[p.id]) {
        setRecipientStates(prev => ({
          ...prev,
          [p.id]: { selected: !!p.contactEmail, customMessage: null, previewing: false, briefLoaded: false, brief: null },
        }));
      }
      return p;
    });
  }, [filtered]);

  const selectedProspects = prospects.filter(p => recipientStates[p.id]?.selected);
  const withEmail = selectedProspects.filter(p => p.contactEmail);

  function toggleAll() {
    const allSelected = prospects.every(p => recipientStates[p.id]?.selected);
    setRecipientStates(prev => {
      const next = { ...prev };
      for (const p of prospects) {
        next[p.id] = { ...(next[p.id] ?? { customMessage: null, previewing: false, briefLoaded: false, brief: null }), selected: !allSelected };
      }
      return next;
    });
  }

  function toggleRecipient(id: number) {
    setRecipientStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? { customMessage: null, previewing: false, briefLoaded: false, brief: null }), selected: !prev[id]?.selected },
    }));
  }

  function setCustomMessage(id: number, msg: string | null) {
    setRecipientStates(prev => ({
      ...prev,
      [id]: { ...prev[id], customMessage: msg },
    }));
  }

  function togglePreview(id: number) {
    setRecipientStates(prev => ({
      ...prev,
      [id]: { ...prev[id], previewing: !prev[id]?.previewing },
    }));
  }

  function insertMergeField(token: string) {
    setTemplate(prev => prev + token);
  }

  async function handleSendAll() {
    if (withEmail.length === 0) {
      toast.error("No recipients with email addresses selected");
      return;
    }
    setSending(true);
    try {
      await generateDraft.mutateAsync({ prospectIds: withEmail.map(p => p.id) });
      const newSent = new Set(sentIds);
      for (const p of withEmail) newSent.add(p.id);
      setSentIds(newSent);
      toast.success(`${withEmail.length} draft${withEmail.length > 1 ? "s" : ""} queued for Outreach review`, {
        description: "Review and send from the Outreach queue.",
        action: { label: "View Outreach", onClick: () => window.location.href = "/admin/outreach" },
        duration: 6000,
      });
    } catch {
      // error handled by mutation
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-0 bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-600" size={24} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-0 bg-zinc-950">
        <div className="pt-32 text-center">
          <a href={getLoginUrl()} className="text-blue-400 underline text-sm">Sign in to continue</a>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-0 bg-zinc-950">
        <div className="pt-32 text-center text-sm text-zinc-500">Admin access required.</div>
      </div>
    );
  }

  return (
    <main className="min-h-0 bg-zinc-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0 bg-zinc-900">
        <div>
          <h1 className="text-[15px] font-bold text-white">Compose</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">Bulk outreach message composer</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-zinc-400">
            {withEmail.length} of {selectedProspects.length} selected have email
          </span>
          <button
            onClick={handleSendAll}
            disabled={sending || withEmail.length === 0}
            className="flex items-center gap-2 bg-white text-zinc-900 text-[13px] font-bold px-4 py-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send {withEmail.length > 0 ? `(${withEmail.length})` : ""}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Template editor ── */}
        <div className="w-[480px] shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-900">
          <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Message Template</span>
              <button
                onClick={() => setShowMergeFields(!showMergeFields)}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showMergeFields ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                Merge Fields
              </button>
            </div>

            {showMergeFields && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {MERGE_FIELDS.map(f => (
                  <button
                    key={f.token}
                    onClick={() => insertMergeField(f.token)}
                    className="text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white rounded px-2 py-1 transition-colors font-mono"
                  >
                    {f.token}
                  </button>
                ))}
              </div>
            )}

            <div className="text-[10px] text-zinc-600 flex flex-wrap gap-2">
              {MERGE_FIELDS.map(f => (
                <span key={f.token} className="font-mono">{f.token}</span>
              ))}
            </div>
          </div>

          <textarea
            className="flex-1 text-[13px] text-zinc-200 leading-relaxed p-4 resize-none focus:outline-none bg-zinc-900 placeholder:text-zinc-600 font-mono"
            value={template}
            onChange={e => setTemplate(e.target.value)}
            placeholder="Write your message template here. Use merge fields like {{company}} for personalization."
          />

          <div className="px-4 py-3 border-t border-zinc-800">
            <button
              onClick={() => setTemplate(DEFAULT_TEMPLATE)}
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw size={10} />
              Reset to default template
            </button>
          </div>
        </div>

        {/* ── Right: Recipients ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900 shrink-0">
            <Filter size={12} className="text-zinc-600" />
            <select
              value={filterShow}
              onChange={e => setFilterShow(e.target.value)}
              className="text-[11px] border border-zinc-700 rounded px-2 py-1.5 bg-zinc-800 text-zinc-300 focus:outline-none"
            >
              <option value="all">All Events</option>
              {allShows.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-[11px] border border-zinc-700 rounded px-2 py-1.5 bg-zinc-800 text-zinc-300 focus:outline-none"
            >
              <option value="all">All Stages</option>
              <option value="new">Prospects</option>
              <option value="contacted">Contacted</option>
              <option value="responded">Replied</option>
              <option value="scheduled">Qualified</option>
              <option value="converted">Jobs</option>
            </select>
            <div className="flex-1" />
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded px-2.5 py-1.5 transition-colors"
            >
              <Users size={11} />
              {prospects.every(p => recipientStates[p.id]?.selected) ? "Deselect All" : "Select All"}
            </button>
          </div>

          {/* Recipients list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={18} className="animate-spin text-zinc-600" />
              </div>
            ) : prospects.length === 0 ? (
              <div className="text-center py-16">
                <Users size={28} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-[13px] text-zinc-400">No prospects match the current filters</p>
              </div>
            ) : (
              prospects.map(p => (
                <RecipientRow
                  key={p.id}
                  prospect={p}
                  state={recipientStates[p.id] ?? { selected: false, customMessage: null, previewing: false, briefLoaded: false, brief: null }}
                  template={template}
                  onToggle={() => toggleRecipient(p.id)}
                  onCustomChange={msg => setCustomMessage(p.id, msg)}
                  onPreviewToggle={() => togglePreview(p.id)}
                />
              ))
            )}
          </div>

          {/* Bottom summary */}
          <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-zinc-500">
              {prospects.filter(p => sentIds.has(p.id)).length > 0 && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check size={11} />
                  {prospects.filter(p => sentIds.has(p.id)).length} sent to Outreach queue
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500">
              {withEmail.length} recipient{withEmail.length !== 1 ? "s" : ""} ready · {selectedProspects.length - withEmail.length} missing email
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
