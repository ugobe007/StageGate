/**
 * client/src/pages/AdminSalesAgent.tsx
 *
 * Frank's Mission Control — pipeline board + conversation detail + manual send
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bot, Mail, Clock, MessageSquare,
  Zap, Send, RefreshCw, Eye, Users,
  TrendingUp, Calendar, Star
} from "lucide-react";

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

export default function AdminSalesAgent() {
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [filterStage, setFilterStage] = useState<string>("all");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const {
    data: conversations = [],
    isLoading: convsLoading,
    refetch: refetchConvs
  } = trpc.salesAgent.getConversations.useQuery();

  const { data: runs = [] } = trpc.salesAgent.getRuns.useQuery();

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

  return (
    <div className="flex h-full bg-zinc-950 text-white overflow-hidden">
      {/* Left panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800">
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
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
              onClick={() => refetchConvs()}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
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
            const count = conversations.filter(c => c.conv.state === s.id).length;
            if (count === 0) return null;
            return (
              <button
                key={s.id}
                onClick={() => setFilterStage(s.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${filterStage === s.id ? `${s.color} ring-1 ring-current` : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {s.label} ({count})
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
              {filtered.map(({ conv, prospect }) => {
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
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          {prospect.contactName && <span className="truncate">{prospect.contactName}</span>}
                          {prospect.contactName && prospect.robotType && <span>·</span>}
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
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-3 h-3" />
                    <span>{selectedConv.prospect.robotType}</span>
                    {selectedConv.prospect.robotName && (
                      <span className="text-zinc-600">— {selectedConv.prospect.robotName}</span>
                    )}
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
  );
}
