import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  ChevronDown, ChevronUp, Search, Bot, Calendar, Zap, Paperclip
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new:         { label: "New",         color: "bg-blue-500/10 text-blue-400 border-blue-500/30",    icon: Clock },
  reviewing:   { label: "Reviewing",   color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Loader2 },
  quoted:      { label: "Quoted",      color: "bg-purple-500/10 text-purple-400 border-purple-500/30", icon: Zap },
  approved:    { label: "Approved",    color: "bg-green-500/10 text-green-400 border-green-500/30", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",   icon: Loader2 },
  completed:   { label: "Completed",   color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",   color: "bg-red-500/10 text-red-400 border-red-500/30",      icon: XCircle },
};

const URGENCY_COLORS: Record<string, string> = {
  low:    "bg-slate-500/10 text-slate-400",
  normal: "bg-blue-500/10 text-blue-400",
  high:   "bg-amber-500/10 text-amber-400",
  urgent: "bg-red-500/10 text-red-400",
};

type ServiceRequest = {
  id: number;
  requestType: string;
  status: string;
  urgency: string | null;
  showName: string | null;
  showDate: string | null;
  robotName: string | null;
  details: string | null;
  quotedPrice: string | null;
  adminNotes: string | null;
  attachmentUrl: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  createdAt: Date;
  userId: number;
};

export default function AdminServiceRequests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editQuote, setEditQuote] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.company.getAllServiceRequests.useQuery();

  const updateStatus = trpc.company.updateServiceRequestStatus.useMutation({
    onSuccess: () => {
      utils.company.getAllServiceRequests.invalidate();
      setEditingId(null);
    },
  });

  const filtered = (requests ?? []).filter((r: ServiceRequest) => {
    const matchSearch = !search ||
      r.requestType.toLowerCase().includes(search.toLowerCase()) ||
      (r.showName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.robotName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = (requests ?? []).reduce((acc: Record<string, number>, r: ServiceRequest) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Bot size={22} className="text-primary" />
            Service Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Incoming requests from robot companies — review, quote, and update status.
          </p>
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {["all", "new", "reviewing", "quoted", "approved", "in_progress", "completed", "cancelled"].map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = s === "all" ? (requests?.length ?? 0) : (counts[s] ?? 0);
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {cfg?.label ?? "All"} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by service type, show, or robot…"
            className="pl-9 bg-background border-border/60 text-sm"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No service requests match your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req: ServiceRequest) => {
              const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.new;
              const Icon = cfg.icon;
              const isExpanded = expandedId === req.id;
              const isEditing = editingId === req.id;

              return (
                <div key={req.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${cfg.color}`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{req.requestType}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {req.showName && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} /> {req.showName}
                            </span>
                          )}
                          {req.robotName && (
                            <span className="flex items-center gap-1">
                              <Bot size={10} /> {req.robotName}
                            </span>
                          )}
                          <span>#{req.id} · {new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {req.urgency && req.urgency !== "normal" && (
                        <Badge className={`text-xs ${URGENCY_COLORS[req.urgency] ?? ""}`}>
                          {req.urgency}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/40 pt-4 space-y-4">
                      {/* Details */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {req.showDate && (
                          <div><span className="text-muted-foreground text-xs">Show Date</span><div>{req.showDate}</div></div>
                        )}
                        {req.urgency && (
                          <div><span className="text-muted-foreground text-xs">Urgency</span><div className="capitalize">{req.urgency}</div></div>
                        )}
                        {req.quotedPrice && (
                          <div><span className="text-muted-foreground text-xs">Quoted Price</span><div className="text-primary font-semibold">{req.quotedPrice}</div></div>
                        )}
                      </div>
                      {req.details && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-sm text-muted-foreground">
                          {req.details}
                        </div>
                      )}
                      {req.attachmentUrl && (
                        <div className="flex items-center gap-2 text-sm">
                          <Paperclip size={13} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">Attachment:</span>
                          <a
                            href={req.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline truncate max-w-xs text-xs"
                          >
                            {req.attachmentName ?? "Download file"}
                          </a>
                        </div>
                      )}
                      {req.adminNotes && !isEditing && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                          <div className="text-xs text-muted-foreground mb-1">Admin Note</div>
                          {req.adminNotes}
                        </div>
                      )}

                      {/* Edit form */}
                      {isEditing ? (
                        <div className="space-y-3 pt-2 border-t border-border/40">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                              <select
                                value={editStatus}
                                onChange={e => setEditStatus(e.target.value)}
                                className="w-full h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground"
                              >
                                {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                                  <option key={v} value={v}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Quoted Price</label>
                              <Input
                                value={editQuote}
                                onChange={e => setEditQuote(e.target.value)}
                                placeholder="e.g. $2,500"
                                className="bg-background border-border/60 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Admin Notes</label>
                            <textarea
                              value={editNotes}
                              onChange={e => setEditNotes(e.target.value)}
                              rows={3}
                              placeholder="Notes visible to the client…"
                              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({
                                id: req.id,
                                status: editStatus as ServiceRequest["status"],
                                quotedPrice: editQuote || undefined,
                                adminNotes: editNotes || undefined,
                              })}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                            >
                              {updateStatus.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(req.id);
                            setEditStatus(req.status);
                            setEditQuote(req.quotedPrice ?? "");
                            setEditNotes(req.adminNotes ?? "");
                          }}
                          className="border-primary/30 text-primary hover:bg-primary/10"
                        >
                          Update Status / Add Quote
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
