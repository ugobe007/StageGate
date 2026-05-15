/**
 * client/src/pages/AdminSalesAgent.tsx
 *
 * Admin dashboard for the autonomous Sales Agent.
 * Shows: conversation states, email threads, agent run history.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bot, Mail, Clock, CheckCircle, MessageSquare,
  TrendingUp, Users, Zap, ChevronRight
} from "lucide-react";

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  discovery: { label: "Discovered", color: "bg-zinc-700 text-zinc-300" },
  awaiting_reply: { label: "Awaiting Reply", color: "bg-amber-500/20 text-amber-400" },
  in_conversation: { label: "In Conversation", color: "bg-blue-500/20 text-blue-400" },
  scheduling_sent: { label: "Scheduling Sent", color: "bg-purple-500/20 text-purple-400" },
  meeting_booked: { label: "Meeting Booked", color: "bg-emerald-500/20 text-emerald-400" },
  converted: { label: "Converted", color: "bg-emerald-600/20 text-emerald-300" },
  closed: { label: "Closed", color: "bg-zinc-600 text-zinc-400" },
};

export default function AdminSalesAgent() {
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);

  const { data: conversations = [], isLoading: convsLoading } =
    trpc.salesAgent.getConversations.useQuery();

  const { data: runs = [], isLoading: runsLoading } =
    trpc.salesAgent.getRuns.useQuery();

  const { data: thread = [], isLoading: threadLoading } =
    trpc.salesAgent.getEmailThread.useQuery(
      { prospectId: selectedProspectId! },
      { enabled: selectedProspectId !== null }
    );

  // Stats
  const totalConvs = conversations.length;
  const awaitingReply = conversations.filter(c => c.conv.state === "awaiting_reply").length;
  const inConversation = conversations.filter(c => c.conv.state === "in_conversation").length;
  const meetingBooked = conversations.filter(c => c.conv.state === "meeting_booked").length;

  const lastRun = runs[0];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-amber-400" />
            Sales Agent
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Autonomous prospect discovery, outreach, and conversation management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRun && (
            <span className="text-zinc-500 text-xs">
              Last run: {new Date(lastRun.startedAt).toLocaleString()}
            </span>
          )}
          <Badge
            variant="outline"
            className="border-emerald-500 text-emerald-400 gap-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </Badge>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total prospects", value: totalConvs, icon: Users, color: "text-zinc-300" },
          { label: "Awaiting reply", value: awaitingReply, icon: Clock, color: "text-amber-400" },
          { label: "In conversation", value: inConversation, icon: MessageSquare, color: "text-blue-400" },
          { label: "Meetings booked", value: meetingBooked, icon: CheckCircle, color: "text-emerald-400" },
        ].map(stat => (
          <Card key={stat.label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-xs">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon className={`w-5 h-5 ${stat.color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations list */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                Active Conversations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {convsLoading && (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-zinc-800 rounded animate-pulse" />
                  ))}
                </div>
              )}
              {!convsLoading && conversations.length === 0 && (
                <div className="p-8 text-center text-zinc-500">
                  <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No conversations yet. The agent will start outreach on the next nightly run.</p>
                </div>
              )}
              <div className="divide-y divide-zinc-800">
                {conversations.map(({ conv, prospect }) => {
                  const stateInfo = STATE_LABELS[conv.state ?? "discovery"] ?? STATE_LABELS.discovery;
                  const isSelected = selectedProspectId === prospect.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedProspectId(isSelected ? null : prospect.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-800/50 transition-colors ${
                        isSelected ? "bg-zinc-800" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm truncate">
                              {prospect.company}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${stateInfo.color}`}>
                              {stateInfo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-zinc-500 text-xs truncate">
                              {prospect.contactEmail}
                            </span>
                            {conv.followUpCount && conv.followUpCount > 0 && (
                              <span className="text-zinc-600 text-xs">
                                {conv.followUpCount} email{conv.followUpCount !== 1 ? "s" : ""} sent
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {conv.lastActivityAt && (
                            <span className="text-zinc-600 text-xs whitespace-nowrap">
                              {new Date(conv.lastActivityAt).toLocaleDateString()}
                            </span>
                          )}
                          <ChevronRight className={`w-4 h-4 text-zinc-600 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                        </div>
                      </div>

                      {/* Expanded thread */}
                      {isSelected && (
                        <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                          {threadLoading && (
                            <div className="h-10 bg-zinc-700 rounded animate-pulse" />
                          )}
                          {!threadLoading && thread.length === 0 && (
                            <p className="text-zinc-600 text-xs italic">No emails sent yet</p>
                          )}
                          {thread.map(email => (
                            <div
                              key={email.id}
                              className={`rounded-lg p-3 text-xs ${
                                email.direction === "outbound"
                                  ? "bg-zinc-700/50 border border-zinc-700"
                                  : "bg-blue-900/20 border border-blue-800/40"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`font-medium ${
                                  email.direction === "outbound" ? "text-zinc-300" : "text-blue-300"
                                }`}>
                                  {email.direction === "outbound" ? "StageGate → Prospect" : "Prospect → StageGate"}
                                </span>
                                <span className="text-zinc-600">
                                  {new Date(email.receivedAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-zinc-400 font-medium">{email.subject}</p>
                              <p className="text-zinc-500 mt-1 line-clamp-2">{email.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent run history */}
        <div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Agent Run History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {runsLoading && (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
                  ))}
                </div>
              )}
              {!runsLoading && runs.length === 0 && (
                <div className="p-6 text-center text-zinc-500">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No runs yet. First run scheduled for tonight.</p>
                </div>
              )}
              <div className="divide-y divide-zinc-800">
                {runs.slice(0, 20).map(run => (
                  <div key={run.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        run.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : run.status === "failed"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {run.status}
                      </span>
                      <span className="text-zinc-600 text-xs">
                        {new Date(run.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1">
                      <span className="text-zinc-500 text-xs">
                        {run.prospectsFound ?? 0} found
                      </span>
                      <span className="text-zinc-500 text-xs">
                        {run.prospectsCreated ?? 0} new
                      </span>
                      {run.emailsSent && run.emailsSent > 0 && (
                        <span className="text-zinc-500 text-xs">
                          {run.emailsSent} emails
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="bg-zinc-900 border-zinc-800 mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">How the agent works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { step: "1", text: "Nightly: discovers robot companies at trade shows online" },
                { step: "2", text: "Builds a custom outreach strategy per company" },
                { step: "3", text: "Sends first email from hello@onstage.bot" },
                { step: "4", text: "Replies to responses naturally, answers questions" },
                { step: "5", text: "Sends scheduling link when prospect is ready" },
                { step: "6", text: "Notifies robot team when a call is booked" },
              ].map(item => (
                <div key={item.step} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-500 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <p className="text-zinc-400 text-xs leading-relaxed">{item.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
