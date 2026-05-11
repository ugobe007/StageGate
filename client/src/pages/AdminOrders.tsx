import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { Package, ArrowLeft, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  in_progress: { label: "In Progress", color: "bg-primary/20 text-primary border-primary/30" },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelled", color: "bg-destructive/20 text-destructive border-destructive/30" },
};

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const filteredOrders = (allOrders || []).filter(o =>
    filterStatus === "all" || o.status === filterStatus
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                <ArrowLeft size={14} /> Admin
              </Button>
            </Link>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Package size={20} className="text-primary" /> Service Orders
            </h1>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap mb-6">
            {["all", "pending", "confirmed", "in_progress", "completed", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${filterStatus === s ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-secondary text-muted-foreground border-border hover:border-primary/50"}`}
              >
                {s === "all" ? "All Orders" : STATUS_CONFIG[s]?.label}
                {s !== "all" && (
                  <span className="ml-1.5 opacity-70">
                    {(allOrders || []).filter(o => o.status === s).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-20">
              <Package size={48} className="text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const show = (shows || []).find(s => s.id === order.showId);
                const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const isExpanded = expandedOrder === order.id;

                return (
                  <div key={order.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground text-sm">Order #{order.id}</span>
                          <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
                          {show && <span className="text-xs text-muted-foreground">{show.name}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Placed {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        {order.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{order.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {order.totalAmount && (
                          <span className="font-semibold text-foreground">${parseFloat(order.totalAmount).toLocaleString()}</span>
                        )}
                        {/* Status update */}
                        <Select
                          value={order.status}
                          onValueChange={(v) => updateOrderStatus.mutate({ id: order.id, status: v as any })}
                        >
                          <SelectTrigger className="bg-input border-border h-8 text-xs w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                              <SelectItem key={val} value={val} className="text-xs">{cfg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border p-4 bg-secondary/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Show Details</p>
                            {show ? (
                              <div className="text-sm text-foreground">
                                <div className="font-medium">{show.name}</div>
                                {show.venue && <div className="text-muted-foreground text-xs mt-0.5">{show.venue}, {show.city}</div>}
                                {show.startDate && (
                                  <div className="text-xs text-primary mt-1">
                                    {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Show #{order.showId}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Services Ordered</p>
                            {(order as any).serviceIds ? (
                              <div className="flex flex-wrap gap-1.5">
                                {JSON.parse((order as any).serviceIds).map((svcId: number) => {
                                  const svc = (services || []).find(s => s.id === svcId);
                                  return svc ? (
                                    <Badge key={svcId} className="bg-secondary text-muted-foreground border-border text-xs">
                                      {svc.name}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No services listed</p>
                            )}
                          </div>
                        </div>
                        {order.notes && (
                          <div className="mt-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                            <p className="text-sm text-foreground">{order.notes}</p>
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
      </div>
    </div>
  );
}
