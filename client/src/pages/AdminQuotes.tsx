import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  FileText, ArrowLeft, Bot, Calendar, Wrench, Mail,
  Phone, Building2, ChevronDown, ChevronUp, CheckCircle2,
  Clock, Eye, DollarSign, XCircle, Loader2
} from "lucide-react";

const STATUS_CONFIG = {
  new:       { label: "New",       color: "oklch(0.55 0.18 145)", bg: "oklch(0.55 0.18 145 / 0.10)" },
  reviewing: { label: "Reviewing", color: "oklch(0.65 0.18 60)",  bg: "oklch(0.65 0.18 60 / 0.10)"  },
  quoted:    { label: "Quoted",    color: "oklch(0.55 0.18 240)", bg: "oklch(0.55 0.18 240 / 0.10)" },
  converted: { label: "Converted", color: "oklch(0.55 0.18 145)", bg: "oklch(0.55 0.18 145 / 0.10)" },
  closed:    { label: "Closed",    color: "oklch(0.45 0.008 240)", bg: "oklch(0.45 0.008 240 / 0.10)" },
} as const;

const SERVICE_NAMES: Record<number, string> = {
  1: "Inbound Logistics",
  2: "Warehousing",
  3: "Staging & Activation",
  4: "Live Technical Support",
  5: "StageHand™ 24/7",
  6: "StagePro™ Training",
  7: "Showroom & Demo",
  8: "Robot Sales & Marketing",
};

export default function AdminQuotes() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  const { data: quotes, isLoading, refetch } = trpc.quotes.list.useQuery();
  const updateStatus = trpc.quotes.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-0 flex items-center justify-center" style={{ background: "#1C1E22" }}>
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const filtered = (quotes || []).filter((q) =>
    statusFilter === "all" || q.status === statusFilter
  );

  const counts = (quotes || []).reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function getServiceNames(serviceIdsJson: string | null): string[] {
    if (!serviceIdsJson) return [];
    try {
      const ids: number[] = JSON.parse(serviceIdsJson);
      return ids.map((id) => SERVICE_NAMES[id] || `Service #${id}`);
    } catch {
      return [];
    }
  }

  return (
    <div className="min-h-0" style={{ background: "#1C1E22", color: "#ececec" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.10 0.006 240)" }}>
        <div className="container py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <button className="p-2 rounded-lg transition-colors" style={{ color: "oklch(0.55 0.008 240)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "oklch(0.88 0.008 240)")}
                onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.55 0.008 240)")}
              >
                <ArrowLeft size={18} />
              </button>
            </Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.55 0.18 145 / 0.15)" }}>
              <FileText size={16} style={{ color: "oklch(0.72 0.21 145)" }} />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg">Quote Requests</h1>
              <p className="text-xs" style={{ color: "oklch(0.50 0.008 240)" }}>
                {quotes?.length || 0} total requests
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Status filter + counts */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All", count: quotes?.length || 0 },
            ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
              key, label: cfg.label, count: counts[key] || 0,
            })),
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className="px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5"
              style={{
                borderColor: statusFilter === key ? "oklch(0.72 0.21 145)" : "oklch(0.20 0.008 240)",
                background: statusFilter === key ? "oklch(0.72 0.21 145 / 0.10)" : "transparent",
                color: statusFilter === key ? "oklch(0.72 0.21 145)" : "oklch(0.55 0.008 240)",
              }}
            >
              {label}
              <span
                className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{ background: "oklch(0.15 0.006 240)", color: "oklch(0.60 0.008 240)" }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Quote list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: "oklch(0.55 0.008 240)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "oklch(0.16 0.010 240)", background: "oklch(0.10 0.006 240)" }}>
            <FileText size={32} className="mx-auto mb-3" style={{ color: "oklch(0.30 0.008 240)" }} />
            <p className="font-medium" style={{ color: "oklch(0.55 0.008 240)" }}>No quote requests yet</p>
            <p className="text-sm mt-1" style={{ color: "oklch(0.40 0.006 240)" }}>
              Requests submitted via the "Get a Quote" form will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => {
              const cfg = STATUS_CONFIG[q.status as keyof typeof STATUS_CONFIG];
              const isExpanded = expandedId === q.id;
              const serviceNames = getServiceNames(q.serviceIds);
              return (
                <div
                  key={q.id}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{ borderColor: isExpanded ? "oklch(0.72 0.21 145 / 0.30)" : "oklch(0.16 0.010 240)", background: "oklch(0.10 0.006 240)" }}
                >
                  {/* Row header */}
                  <button
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.55 0.18 240 / 0.10)" }}>
                      <Bot size={16} style={{ color: "oklch(0.55 0.18 240)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{q.company}</span>
                        <span className="text-xs" style={{ color: "oklch(0.50 0.008 240)" }}>·</span>
                        <span className="text-sm" style={{ color: "oklch(0.60 0.008 240)" }}>{q.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.50 0.008 240)" }}>
                          <Bot size={10} /> {q.robotType} × {q.robotCount}
                        </span>
                        {q.showName && (
                          <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.50 0.008 240)" }}>
                            <Calendar size={10} /> {q.showName}
                          </span>
                        )}
                        {serviceNames.length > 0 && (
                          <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.50 0.008 240)" }}>
                            <Wrench size={10} /> {serviceNames.length} service{serviceNames.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs" style={{ color: "oklch(0.40 0.006 240)" }}>
                        {new Date(q.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {isExpanded ? <ChevronUp size={14} style={{ color: "oklch(0.45 0.008 240)" }} /> : <ChevronDown size={14} style={{ color: "oklch(0.45 0.008 240)" }} />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t space-y-4" style={{ borderColor: "oklch(0.14 0.008 240)" }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        {/* Contact */}
                        <div className="space-y-2">
                          <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Contact</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail size={13} style={{ color: "oklch(0.50 0.008 240)" }} />
                              <a href={`mailto:${q.email}`} className="hover:underline" style={{ color: "oklch(0.72 0.21 145)" }}>{q.email}</a>
                            </div>
                            {q.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone size={13} style={{ color: "oklch(0.50 0.008 240)" }} />
                                <span>{q.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 size={13} style={{ color: "oklch(0.50 0.008 240)" }} />
                              <span>{q.company}</span>
                            </div>
                          </div>
                        </div>
                        {/* Robot details */}
                        <div className="space-y-2">
                          <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Robot Details</p>
                          <div className="space-y-1 text-sm">
                            <p><span style={{ color: "oklch(0.55 0.008 240)" }}>Type:</span> {q.robotType}</p>
                            <p><span style={{ color: "oklch(0.55 0.008 240)" }}>Count:</span> {q.robotCount} unit{q.robotCount !== 1 ? "s" : ""}</p>
                            {q.robotDimensions && <p><span style={{ color: "oklch(0.55 0.008 240)" }}>Dimensions:</span> {q.robotDimensions}</p>}
                            {q.robotWeight && <p><span style={{ color: "oklch(0.55 0.008 240)" }}>Weight:</span> {q.robotWeight}</p>}
                          </div>
                        </div>
                        {/* Services */}
                        {serviceNames.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Requested Services</p>
                            <div className="flex flex-wrap gap-1.5">
                              {serviceNames.map((name) => (
                                <span key={name} className="px-2 py-1 rounded text-xs border" style={{ borderColor: "oklch(0.22 0.008 240)", color: "oklch(0.70 0.008 240)" }}>
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Notes */}
                        {q.notes && (
                          <div className="space-y-2">
                            <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Client Notes</p>
                            <p className="text-sm" style={{ color: "oklch(0.65 0.008 240)" }}>{q.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Admin actions */}
                      <div className="pt-3 border-t space-y-3" style={{ borderColor: "oklch(0.14 0.008 240)" }}>
                        <p className="text-xs font-mono tracking-wide uppercase" style={{ color: "oklch(0.45 0.008 240)" }}>Admin Actions</p>
                        <div className="flex flex-wrap gap-2">
                          {(["new", "reviewing", "quoted", "converted", "closed"] as const).map((s) => {
                            const c = STATUS_CONFIG[s];
                            const isCurrentStatus = q.status === s;
                            return (
                              <button
                                key={s}
                                disabled={isCurrentStatus || updateStatus.isPending}
                                onClick={() => updateStatus.mutate({ id: q.id, status: s, adminNotes: editingNotes[q.id] })}
                                className="px-3 py-1.5 rounded-lg text-xs border transition-all disabled:opacity-40 flex items-center gap-1.5"
                                style={{
                                  borderColor: isCurrentStatus ? c.color : "oklch(0.22 0.008 240)",
                                  background: isCurrentStatus ? c.bg : "transparent",
                                  color: isCurrentStatus ? c.color : "oklch(0.55 0.008 240)",
                                }}
                              >
                                {s === "new" && <Clock size={11} />}
                                {s === "reviewing" && <Eye size={11} />}
                                {s === "quoted" && <DollarSign size={11} />}
                                {s === "converted" && <CheckCircle2 size={11} />}
                                {s === "closed" && <XCircle size={11} />}
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                        <div>
                          <textarea
                            rows={2}
                            placeholder="Add internal notes..."
                            value={editingNotes[q.id] ?? (q.adminNotes || "")}
                            onChange={(e) => setEditingNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-sm border resize-none focus:outline-none focus:ring-1"
                            style={{
                              background: "oklch(0.12 0.006 240)",
                              borderColor: "oklch(0.20 0.008 240)",
                              color: "oklch(0.80 0.005 240)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
