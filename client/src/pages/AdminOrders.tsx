import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Package, ArrowLeft, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "#f59e0b" },
  confirmed:   { label: "Confirmed",   color: "#3b82f6" },
  in_progress: { label: "In Progress", color: "#8b5cf6" },
  completed:   { label: "Completed",   color: "#00E87A" },
  cancelled:   { label: "Cancelled",   color: "#ef4444" },
};

function parseServiceIds(value: unknown): number[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
}

export default function AdminOrders() {
  const { user, isAuthenticated } = useAuth();
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: allOrders, isLoading } = trpc.orders.allOrders.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const { data: shows } = trpc.shows.list.useQuery();
  const { data: services } = trpc.services.list.useQuery();

  const updateOrderStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => { toast.success("Order status updated"); utils.orders.allOrders.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div style={{ minHeight: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#64748b" }}>Admin access required.</p>
      </div>
    );
  }

  const filteredOrders = (allOrders || []).filter(o =>
    filterStatus === "all" || o.status === filterStatus
  );

  return (
    <div style={{ padding: "2rem", maxWidth: "56rem", margin: "0 auto", color: "#ececec" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <Link href="/admin">
          <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0" }}>
            <ArrowLeft size={14} /> Admin
          </button>
        </Link>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Package size={18} style={{ color: "#00E87A" }} /> Service Orders
        </h1>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.5rem" }}>
        {["all", "pending", "confirmed", "in_progress", "completed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: "0.5rem 0.875rem", fontSize: "0.875rem", fontWeight: 500,
              background: "none", border: "none",
              borderBottom: `2px solid ${filterStatus === s ? "#00E87A" : "transparent"}`,
              color: filterStatus === s ? "#ececec" : "#64748b",
              cursor: "pointer", marginBottom: "-1px",
            }}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s]?.label}
            {s !== "all" && (
              <span style={{ marginLeft: "0.375rem", fontSize: "0.75rem", background: "#1a1a1a", color: "#64748b", padding: "0.0625rem 0.3125rem", borderRadius: "0.1875rem" }}>
                {(allOrders || []).filter(o => o.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 0" }}>
          <Loader2 size={24} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <Package size={40} style={{ color: "#cbd5e1", margin: "0 auto 1rem" }} />
          <p style={{ color: "rgba(255,255,255,0.30)", fontWeight: 500 }}>No orders found</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filteredOrders.map((order) => {
            const show = (shows || []).find(s => s.id === order.showId);
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedOrder === order.id;

            return (
              <div key={order.id} style={{ border: `1px solid ${isExpanded ? "#00E87A" : "rgba(255,255,255,0.08)"}`, borderRadius: "0.5rem", background: "#111111", overflow: "hidden", transition: "border-color 0.1s" }}>
                <div style={{ padding: "0.875rem 1rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      <Link href={`/admin/orders/${order.id}`} onClick={e => e.stopPropagation()}>
                        <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                          Order #{order.id} <ExternalLink size={11} style={{ color: "rgba(255,255,255,0.30)" }} />
                        </span>
                      </Link>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: status.color }}>{status.label}</span>
                      {show && <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>{show.name}</span>}
                      {(order as any).bookingId && (
                        <Link href="/admin/bookings" onClick={e => e.stopPropagation()}>
                          <span style={{ fontSize: "0.75rem", color: "#f59e0b", cursor: "pointer" }}>
                            From booking #{(order as any).bookingId}
                          </span>
                        </Link>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)" }}>
                      Placed {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    {order.notes && (
                      <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.notes}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                    {order.totalAmount && (
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec" }}>${parseFloat(order.totalAmount).toLocaleString()}</span>
                    )}
                    <Select
                      value={order.status}
                      onValueChange={(v) => updateOrderStatus.mutate({ id: order.id, status: v as any })}
                    >
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                          <SelectItem key={val} value={val} className="text-xs">{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: "0.25rem", display: "flex", alignItems: "center" }}
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "1rem", background: "#1C1E22" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.30)", marginBottom: "0.5rem" }}>Show Details</p>
                        {show ? (
                          <div style={{ fontSize: "0.875rem" }}>
                            <div style={{ fontWeight: 500, color: "#ececec" }}>{show.name}</div>
                            {show.venue && <div style={{ color: "#64748b", fontSize: "0.8125rem", marginTop: "0.125rem" }}>{show.venue}, {show.city}</div>}
                            {show.startDate && (
                              <div style={{ fontSize: "0.8125rem", color: "#00E87A", marginTop: "0.25rem" }}>
                                {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.30)" }}>Show #{order.showId}</p>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.30)", marginBottom: "0.5rem" }}>Services Ordered</p>
                        {parseServiceIds((order as any).serviceIds).length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                            {parseServiceIds((order as any).serviceIds).map((svcId: number) => {
                              const svc = (services || []).find(s => s.id === svcId);
                              return svc ? (
                                <span key={svcId} style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.55)", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.25rem", padding: "0.125rem 0.5rem" }}>
                                  {svc.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.30)" }}>No services listed</p>
                        )}
                      </div>
                    </div>
                    {order.notes && (
                      <div style={{ marginTop: "1rem" }}>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.30)", marginBottom: "0.5rem" }}>Notes</p>
                        <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)" }}>{order.notes}</p>
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
  );
}
