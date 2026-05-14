import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Loader2, RefreshCw, Send, X, Check,
  Building2, Bot, MapPin, Mail, Globe, ArrowRight,
  Sparkles, ChevronRight, ExternalLink, Users, Activity,
  FileText, Zap, Clock, TrendingUp, Star,
  Phone, Calendar, AlertCircle, CheckCircle2, Linkedin,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProspectForCRM = {
  id: number;
  company: string;
  robotName?: string | null;
  robotType?: string | null;
  hqCountry?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactTitle?: string | null;
  contactLinkedIn?: string | null;
  website?: string | null;
  shows?: string[] | null;
  notes?: string | null;
  status: string;
  emailConfidence?: string | null;
  followUpDate?: string | Date | null;
};

type ResearchData = {
  companyOverview: string;
  robotSpecs: {
    name?: string;
    type?: string;
    height?: string;
    weight?: string;
    payload?: string;
    battery?: string;
    speed?: string;
    sensors?: string[];
    useCases?: string[];
    price?: string;
    availability?: string;
  };
  competitiveContext: string;
  useCases: string[];
  whyStageGate: string;
  showIntel: string;
  decisionMakers: Array<{
    name: string;
    title: string;
    email?: string;
    emailConfidence?: string;
    linkedIn?: string;
    department?: string;
  }>;
};

type PanelTab = "overview" | "research" | "email" | "activity";

const PIPELINE_STAGES = [
  { key: "new",            label: "Prospects",    color: "bg-zinc-800 text-zinc-300"              },
  { key: "contacted",      label: "Contacted",    color: "bg-blue-900/60 text-blue-300"           },
  { key: "responded",      label: "Replied",      color: "bg-amber-900/60 text-amber-300"         },
  { key: "scheduled",      label: "Qualified",    color: "bg-emerald-900/60 text-emerald-300"     },
  { key: "converted",      label: "Jobs",         color: "bg-violet-900/60 text-violet-300"       },
  { key: "not_interested", label: "Not Interested", color: "bg-zinc-900/60 text-zinc-500"         },
] as const;

const confidenceColor: Record<string, string> = {
  verified: "text-emerald-400 bg-emerald-900/40 border border-emerald-700/40",
  high:     "text-blue-400 bg-blue-900/40 border border-blue-700/40",
  medium:   "text-amber-400 bg-amber-900/40 border border-amber-700/40",
  low:      "text-red-400 bg-red-900/40 border border-red-700/40",
};

// ─── ProspectCRMCard ──────────────────────────────────────────────────────────
export default function ProspectCRMCard({
  prospect,
  onStatusChange,
}: {
  prospect: ProspectForCRM;
  onStatusChange?: (id: number, status: string) => void;
}) {
  const ctx = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<PanelTab>("overview");
  const stage = PIPELINE_STAGES.find(s => s.key === prospect.status);
  const nextStageIdx = PIPELINE_STAGES.findIndex(s => s.key === prospect.status) + 1;
  const nextStage = nextStageIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[nextStageIdx] : undefined;

  // AI brief — auto-fetches on open
  const { data: briefData, isLoading: briefLoading } = trpc.prospects.getBrief.useQuery(
    { id: prospect.id },
    { staleTime: 5 * 60 * 1000 }
  );

  // Research data (nightly job results)
  const { data: researchData, isLoading: researchLoading, refetch: refetchResearch } = trpc.prospects.getResearch.useQuery(
    { prospectId: prospect.id },
    { staleTime: 10 * 60 * 1000 }
  );

  // Activity log
  const { data: activitiesData, isLoading: activitiesLoading } = trpc.prospects.getActivities.useQuery(
    { prospectId: prospect.id },
    { staleTime: 2 * 60 * 1000 }
  );

  const [draftMessage, setDraftMessage] = useState<string>("");
  const [draftSubject, setDraftSubject] = useState<string>("");
  const [draftEdited, setDraftEdited] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [tone, setTone] = useState<"professional" | "friendly" | "concise" | "bold">("professional");
  const [regenerating, setRegenerating] = useState(false);

  // Populate draft from AI brief once loaded
  useEffect(() => {
    if (briefData?.brief?.draftMessage && !draftEdited) {
      setDraftMessage(briefData.brief.draftMessage);
      setDraftSubject(`StageGate Logistics for ${prospect.company} at ${(prospect.shows ?? []).join(", ") || "your next show"}`);
    }
  }, [briefData, draftEdited, prospect.company, prospect.shows]);

  // Reset when prospect changes
  useEffect(() => {
    setDraftMessage("");
    setDraftEdited(false);
    setActiveTab("overview");
    setSendSuccess(false);
  }, [prospect.id]);

  const updateStatus = trpc.prospects.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      ctx.prospects.list.invalidate();
      toast.success("Stage updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const regenerateDraftMutation = trpc.prospects.regenerateDraft.useMutation({
    onMutate: () => setRegenerating(true),
    onSuccess: (data) => {
      setDraftMessage(data.draft);
      setDraftEdited(true);
      setRegenerating(false);
      toast.success("Draft rewritten");
    },
    onError: (e) => { setRegenerating(false); toast.error(e.message); },
  });

  const triggerResearch = trpc.prospects.triggerResearch.useMutation({
    onSuccess: () => { refetchResearch(); toast.success("Research queued — refreshing in a moment"); },
    onError: (e) => toast.error(e.message),
  });

  const sendDraftWithWorkflow = trpc.prospects.sendDraftWithWorkflow.useMutation({
    onSuccess: () => {
      setSendSuccess(true);
      ctx.prospects.getActivities.invalidate({ prospectId: prospect.id });
      ctx.prospects.list.invalidate();
      toast.success(`Email sent to ${prospect.company}`, {
        description: "Stage advanced to Contacted. Follow-up scheduled in 3 days.",
        action: { label: "View Outreach", onClick: () => window.location.href = "/admin/outreach" },
        duration: 5000,
      });
      setTimeout(() => setSendSuccess(false), 2000);
      onStatusChange?.(prospect.id, "contacted");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleAdvanceStage() {
    if (!nextStage) return;
    updateStatus.mutate({ ids: [prospect.id], status: nextStage.key });
    onStatusChange?.(prospect.id, nextStage.key);
  }

  function handleSendDraft() {
    if (!prospect.contactEmail) {
      toast.error("No email on file — add a contact email first");
      return;
    }
    if (!draftMessage.trim()) {
      toast.error("Draft message is empty — generate or write a message first");
      return;
    }
    sendDraftWithWorkflow.mutate({
      prospectId: prospect.id,
      subject: draftSubject || `StageGate Logistics for ${prospect.company}`,
      body: draftMessage,
      advanceStage: true,
      scheduleFollowUp: true,
      followUpDays: 3,
    });
  }

  const research: ResearchData | null = researchData ? {
    companyOverview: researchData.companyOverview ?? "",
    robotSpecs: (researchData.robotSpecs as ResearchData["robotSpecs"]) ?? {},
    competitiveContext: researchData.competitiveContext ?? "",
    useCases: (researchData.useCases as string[]) ?? [],
    whyStageGate: researchData.whyStageGate ?? "",
    showIntel: researchData.showIntel ?? "",
    decisionMakers: (researchData.decisionMakers as ResearchData["decisionMakers"]) ?? [],
  } : null;

  const TABS: { key: PanelTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview",  label: "Overview",  icon: <Building2 size={11} /> },
    { key: "research",  label: "Research",  icon: <Sparkles size={11} /> },
    { key: "email",     label: "Email",     icon: <Send size={11} /> },
    { key: "activity",  label: "Activity",  icon: <Activity size={11} /> },
  ];

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 animate-in slide-in-from-top-2 duration-200">
      {/* ── Business Card Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-zinc-800/80 bg-zinc-900/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Stage pill + advance */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${stage?.color ?? "bg-zinc-800 text-zinc-400"}`}>
                {stage?.label ?? prospect.status}
              </span>
              {nextStage && (
                <button
                  onClick={handleAdvanceStage}
                  disabled={updateStatus.isPending}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  {updateStatus.isPending ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
                  Move to {nextStage.label}
                </button>
              )}
            </div>
            {/* Company + robot */}
            <div className="flex items-start gap-4 flex-wrap">
              <div>
                <h3 className="text-[18px] font-bold text-white leading-tight">{prospect.company}</h3>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {prospect.robotName && (
                    <span className="flex items-center gap-1.5 text-[12px] text-zinc-300">
                      <Bot size={11} className="text-zinc-500" />
                      <span className="font-medium">{prospect.robotName}</span>
                      {prospect.robotType && <span className="text-zinc-500">· {prospect.robotType}</span>}
                    </span>
                  )}
                  {prospect.hqCountry && (
                    <span className="flex items-center gap-1 text-[12px] text-zinc-500">
                      <MapPin size={10} />
                      {prospect.hqCountry}
                    </span>
                  )}
                </div>
              </div>
              {/* Shows */}
              {(prospect.shows ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {(prospect.shows ?? []).map(s => (
                    <span key={s} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700/60 font-medium">
                      📍 {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* Contact row */}
            {(prospect.contactName || prospect.contactEmail) && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {prospect.contactName && (
                  <span className="text-[12px] font-semibold text-zinc-200">
                    {prospect.contactName}
                    {prospect.contactTitle && <span className="font-normal text-zinc-500"> · {prospect.contactTitle}</span>}
                  </span>
                )}
                {prospect.contactEmail && (
                  <a href={`mailto:${prospect.contactEmail}`} className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 hover:underline">
                    <Mail size={10} />
                    {prospect.contactEmail}
                  </a>
                )}
                {prospect.emailConfidence && prospect.emailConfidence !== "low" && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${confidenceColor[prospect.emailConfidence] ?? ""}`}>
                    {prospect.emailConfidence}
                  </span>
                )}
                {prospect.contactLinkedIn && (
                  <a href={prospect.contactLinkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                    <Linkedin size={10} />
                    LinkedIn
                  </a>
                )}
                {prospect.website && (
                  <a href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                    <Globe size={10} />
                    Website
                  </a>
                )}
              </div>
            )}
          </div>
          {/* Quick action: Send Email */}
          <button
            onClick={() => { setActiveTab("email"); handleSendDraft(); }}
            disabled={sendDraftWithWorkflow.isPending || briefLoading || sendSuccess}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold transition-all duration-300 disabled:cursor-not-allowed ${
              sendSuccess
                ? "bg-emerald-600 text-white"
                : "bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-40"
            }`}
          >
            {sendDraftWithWorkflow.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : sendSuccess ? (
              <Check size={12} />
            ) : (
              <Send size={12} />
            )}
            {sendSuccess ? "Sent!" : "Send Email"}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-zinc-800">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-5 py-3 text-[11px] font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="px-6 py-5 max-h-[520px] overflow-y-auto">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* AI Brief */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={12} className="text-amber-400" />
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Company Brief</span>
              </div>
              {briefLoading ? (
                <div className="space-y-2">
                  <div className="h-3 bg-zinc-800 rounded animate-pulse w-full" />
                  <div className="h-3 bg-zinc-800 rounded animate-pulse w-4/5" />
                  <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/5" />
                </div>
              ) : briefData?.brief?.summary ? (
                <p className="text-[13px] text-zinc-200 leading-relaxed">{briefData.brief.summary}</p>
              ) : (
                <p className="text-[12px] text-zinc-500 italic">No brief available — trigger research to generate one.</p>
              )}
            </div>

            {/* Why StageGate */}
            {briefData?.brief?.whyStageGate && (
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap size={11} className="text-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest">Why StageGate</span>
                </div>
                <p className="text-[12px] text-emerald-200 leading-relaxed">{briefData.brief.whyStageGate}</p>
              </div>
            )}

            {/* Research status + trigger */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">Research status:</span>
                {researchData ? (
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    {researchData.researchStatus === "running" ? "Running…" : "Complete"}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-zinc-600 flex items-center gap-1">
                    <AlertCircle size={10} />
                    Not researched
                  </span>
                )}
              </div>
              <button
                onClick={() => triggerResearch.mutate({ prospectId: prospect.id })}
                disabled={triggerResearch.isPending || researchData?.researchStatus === "running"}
                className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded px-2.5 py-1.5 transition-colors disabled:opacity-40"
              >
                {triggerResearch.isPending ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Run Research Now
              </button>
            </div>

            {/* Show intel */}
            {research?.showIntel && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={11} className="text-blue-400" />
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Show Intel</span>
                </div>
                <p className="text-[12px] text-zinc-300 leading-relaxed">{research.showIntel}</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block mb-2">Notes</span>
              <p className="text-[12px] text-zinc-400 leading-relaxed">{prospect.notes || <span className="italic text-zinc-600">No notes yet</span>}</p>
            </div>
          </div>
        )}

        {/* ── RESEARCH TAB ── */}
        {activeTab === "research" && (
          <div className="space-y-5">
            {researchLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-800/60 rounded animate-pulse" />)}
              </div>
            ) : research ? (
              <>
                {/* Company Overview */}
                {research.companyOverview && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={11} className="text-zinc-400" />
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Company Overview</span>
                    </div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed">{research.companyOverview}</p>
                  </div>
                )}

                {/* Robot Specs */}
                {research.robotSpecs && Object.keys(research.robotSpecs).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Bot size={11} className="text-zinc-400" />
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Robot Specs — {research.robotSpecs.name ?? prospect.robotName}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Type",         research.robotSpecs.type],
                        ["Height",       research.robotSpecs.height],
                        ["Weight",       research.robotSpecs.weight],
                        ["Payload",      research.robotSpecs.payload],
                        ["Battery",      research.robotSpecs.battery],
                        ["Speed",        research.robotSpecs.speed],
                        ["Price",        research.robotSpecs.price],
                        ["Availability", research.robotSpecs.availability],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label as string} className="bg-zinc-800/60 rounded p-2.5">
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</div>
                          <div className="text-[12px] text-zinc-200 font-medium">{value}</div>
                        </div>
                      ))}
                    </div>
                    {research.robotSpecs.sensors && research.robotSpecs.sensors.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Sensors: </span>
                        <span className="text-[12px] text-zinc-300">{research.robotSpecs.sensors.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Use Cases */}
                {research.useCases.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={11} className="text-zinc-400" />
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Use Cases</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {research.useCases.map(uc => (
                        <span key={uc} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700/60">
                          {uc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Competitive Context */}
                {research.competitiveContext && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star size={11} className="text-zinc-400" />
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Competitive Context</span>
                    </div>
                    <p className="text-[12px] text-zinc-300 leading-relaxed">{research.competitiveContext}</p>
                  </div>
                )}

                {/* Decision Makers */}
                {research.decisionMakers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={11} className="text-zinc-400" />
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Decision Makers</span>
                    </div>
                    <div className="space-y-2">
                      {research.decisionMakers.map((dm, i) => (
                        <div key={i} className="bg-zinc-800/60 rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-zinc-200">{dm.name}</div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">{dm.title}{dm.department ? ` · ${dm.department}` : ""}</div>
                            {dm.email && (
                              <a href={`mailto:${dm.email}`} className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline mt-1">
                                <Mail size={9} />
                                {dm.email}
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {dm.emailConfidence && (
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${confidenceColor[dm.emailConfidence] ?? "text-zinc-500"}`}>
                                {dm.emailConfidence}
                              </span>
                            )}
                            {dm.linkedIn && (
                              <a href={dm.linkedIn} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300">
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10">
                <Sparkles size={24} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-[13px] font-semibold text-zinc-400">No research data yet</p>
                <p className="text-[12px] text-zinc-600 mt-1 mb-4">The nightly research agent will populate this automatically, or you can trigger it now.</p>
                <button
                  onClick={() => triggerResearch.mutate({ prospectId: prospect.id })}
                  disabled={triggerResearch.isPending}
                  className="flex items-center gap-2 mx-auto text-[12px] font-semibold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-2.5 transition-colors"
                >
                  {triggerResearch.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Run Research Now
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── EMAIL TAB ── */}
        {activeTab === "email" && (
          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Subject</label>
              <input
                type="text"
                value={draftSubject}
                onChange={e => setDraftSubject(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                placeholder="Email subject…"
              />
            </div>

            {/* Tone + Regenerate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-500">Tone:</span>
                {(["professional", "friendly", "concise", "bold"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors capitalize ${
                      tone === t
                        ? "border-zinc-400 text-zinc-200 bg-zinc-700"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={() => regenerateDraftMutation.mutate({ id: prospect.id, tone })}
                disabled={regenerating}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 border border-amber-800/60 hover:border-amber-600 rounded px-2.5 py-1.5 transition-colors disabled:opacity-40"
              >
                {regenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                Regenerate
              </button>
            </div>

            {/* Draft body */}
            <div className="relative">
              {regenerating && (
                <div className="absolute inset-0 bg-zinc-900/80 rounded-lg flex items-center justify-center z-10">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-[12px] font-semibold">Rewriting draft…</span>
                  </div>
                </div>
              )}
              {briefLoading && !draftMessage ? (
                <div className="space-y-2 p-3 bg-zinc-800/60 rounded-lg border border-zinc-700 min-h-[180px]">
                  <div className="h-3 bg-zinc-700 rounded animate-pulse w-full" />
                  <div className="h-3 bg-zinc-700 rounded animate-pulse w-4/5" />
                  <div className="h-3 bg-zinc-700 rounded animate-pulse w-full" />
                  <div className="h-3 bg-zinc-700 rounded animate-pulse w-3/5" />
                  <div className="h-3 bg-zinc-700 rounded animate-pulse w-full" />
                </div>
              ) : (
                <textarea
                  value={draftMessage}
                  onChange={e => { setDraftMessage(e.target.value); setDraftEdited(true); }}
                  rows={10}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-3 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-y leading-relaxed font-sans"
                  placeholder="AI draft will appear here… or write your own message."
                />
              )}
            </div>

            {draftEdited && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <FileText size={10} />
                Draft edited — your changes will be sent
              </div>
            )}

            {/* Registration CTA note */}
            <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3 text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-300">Registration link:</span> The email should include{" "}
              <a href="/get-started" target="_blank" className="text-blue-400 hover:underline">onstage.bot/get-started</a>
              {" "}for prospects to register for StageGate services.
            </div>

            {/* Send button */}
            <button
              onClick={handleSendDraft}
              disabled={sendDraftWithWorkflow.isPending || !draftMessage.trim() || sendSuccess}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 text-[13px] font-bold transition-all duration-300 disabled:cursor-not-allowed ${
                sendSuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-40"
              }`}
            >
              {sendDraftWithWorkflow.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : sendSuccess ? (
                <Check size={14} />
              ) : (
                <Send size={14} />
              )}
              {sendSuccess ? "Email Sent!" : "Send Email + Start Workflow"}
            </button>
            <p className="text-[11px] text-zinc-600 text-center">
              Sends email · advances to Contacted · schedules 3-day follow-up · logs activity
            </p>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === "activity" && (
          <div>
            {activitiesLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-zinc-800/60 rounded animate-pulse" />)}
              </div>
            ) : activitiesData && (activitiesData as unknown[]).length > 0 ? (
              <div className="space-y-0">
                {(activitiesData as Array<{id: number; type: string; title: string; description?: string | null; createdAt: string | Date}>).map(act => {
                  const iconMap: Record<string, React.ReactNode> = {
                    email_sent:           <Send size={10} className="text-blue-400" />,
                    stage_changed:        <ArrowRight size={10} className="text-emerald-400" />,
                    follow_up_scheduled:  <Clock size={10} className="text-amber-400" />,
                    note_added:           <FileText size={10} className="text-zinc-400" />,
                    call_scheduled:       <Phone size={10} className="text-violet-400" />,
                    replied:              <CheckCircle2 size={10} className="text-emerald-400" />,
                  };
                  const dotColor: Record<string, string> = {
                    email_sent:           "bg-blue-500",
                    stage_changed:        "bg-emerald-500",
                    follow_up_scheduled:  "bg-amber-500",
                    note_added:           "bg-zinc-500",
                    call_scheduled:       "bg-violet-500",
                    replied:              "bg-emerald-500",
                  };
                  return (
                    <div key={act.id} className="flex gap-3 py-3 border-b border-zinc-800/60 last:border-0">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor[act.type] ?? "bg-zinc-600"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {iconMap[act.type]}
                            <span className="text-[12px] font-semibold text-zinc-200">{act.title}</span>
                          </div>
                          <span className="text-[10px] text-zinc-600 shrink-0 font-mono">
                            {new Date(act.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{act.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <Activity size={24} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-[13px] font-semibold text-zinc-400">No activity yet</p>
                <p className="text-[12px] text-zinc-600 mt-1">Sending emails, stage changes, and follow-ups will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {nextStage && (
            <button
              onClick={handleAdvanceStage}
              disabled={updateStatus.isPending}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded px-3 py-1.5 transition-colors"
            >
              <ChevronRight size={11} />
              Advance to {nextStage.label}
            </button>
          )}
          <Link href="/admin/pipeline">
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded px-3 py-1.5 transition-colors">
              <ExternalLink size={10} />
              View in Pipeline
            </button>
          </Link>
        </div>
        <button
          onClick={() => { setActiveTab("email"); }}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Send size={10} />
          Compose Email
        </button>
      </div>
    </div>
  );
}
