import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft, Package, Building2, Bot, Calendar, MapPin,
  Phone, Mail, Loader2, CheckCircle2, Clock, AlertCircle,
  ExternalLink, RefreshCw, Plus, Trash2, Pencil, Check, X,
  Truck, Zap, AlertTriangle, PlayCircle, BarChart3,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: "Pending",     color: "bg-zinc-800 text-zinc-300 border-zinc-700",          icon: <Clock size={12} /> },
  confirmed:   { label: "Confirmed",   color: "bg-blue-900/60 text-blue-300 border-blue-700/40",    icon: <CheckCircle2 size={12} /> },
  in_progress: { label: "In Progress", color: "bg-amber-900/60 text-amber-300 border-amber-700/40", icon: <RefreshCw size={12} /> },
  completed:   { label: "Completed",   color: "bg-emerald-900/60 text-emerald-300 border-emerald-700/40", icon: <CheckCircle2 size={12} /> },
  cancelled:   { label: "Cancelled",   color: "bg-red-900/60 text-red-300 border-red-700/40",       icon: <AlertCircle size={12} /> },
};

const BOOKING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:       { label: "New",       color: "bg-zinc-800 text-zinc-300" },
  reviewed:  { label: "Reviewed",  color: "bg-blue-900/60 text-blue-300" },
  quoted:    { label: "Quoted",    color: "bg-amber-900/60 text-amber-300" },
  confirmed: { label: "Confirmed", color: "bg-emerald-900/60 text-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-red-900/60 text-red-300" },
  converted: { label: "Converted", color: "bg-violet-900/60 text-violet-300" },
};

export default function AdminOrderDetail() {
  const { user, loading: authLoading } = useAuth();
  const [, params] = useRoute("/admin/orders/:id");
  const orderId = params?.id ? parseInt(params.id, 10) : null;

  const ctx = trpc.useUtils();
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Line-item editor state
  const [addingItem, setAddingItem] = useState(false);
  const [newServiceId, setNewServiceId] = useState<number | "">("");
  const [newQty, setNewQty] = useState(1);
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editUnitPrice, setEditUnitPrice] = useState("");

  const { data, isLoading, error } = trpc.orders.getDetail.useQuery(
    { id: orderId! },
    { enabled: !!orderId && !isNaN(orderId!) }
  );

  // Fetch services catalog for the add-item dropdown
  const { data: servicesData } = trpc.orders.getAllServices.useQuery(
    undefined,
    { enabled: !!orderId }
  );
  const services = servicesData ?? [];

  const invalidateDetail = () => ctx.orders.getDetail.invalidate({ id: orderId! });

  const addLineItem = trpc.orders.addLineItem.useMutation({
    onSuccess: () => {
      invalidateDetail();
      setAddingItem(false);
      setNewServiceId("");
      setNewQty(1);
      setNewUnitPrice("");
      toast.success("Line item added");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeLineItem = trpc.orders.removeLineItem.useMutation({
    onSuccess: () => { invalidateDetail(); toast.success("Line item removed"); },
    onError: (e) => toast.error(e.message),
  });

  const updateLineItem = trpc.orders.updateLineItem.useMutation({
    onSuccess: () => { invalidateDetail(); setEditingItemId(null); toast.success("Line item updated"); },
    onError: (e) => toast.error(e.message),
  });

  // Logistics state
  const [showMeetingHandoff, setShowMeetingHandoff] = useState(false);
  const [meetingNotesInput, setMeetingNotesInput] = useState("");
  const [showWorkflowForm, setShowWorkflowForm] = useState(false);
  const [workflowShowName, setWorkflowShowName] = useState("");
  const [workflowShowDate, setWorkflowShowDate] = useState("");
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(null);
  const [problemDesc, setProblemDesc] = useState("");
  const [problemSeverity, setProblemSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [selectedBayId, setSelectedBayId] = useState<string>("");  // v23: bay assignment

  // v23: fetch bays for assignment dropdown
  const { data: baysData } = trpc.warehouse.listBays.useQuery(undefined, { enabled: !!orderId });
  const bays = baysData ?? [];

  const assignBay = trpc.logistics.assignBay.useMutation({
    onSuccess: () => { refetchWorkflow(); toast.success("Bay assigned"); setSelectedBayId(""); },
    onError: (e) => toast.error(e.message),
  });

  const { data: workflowData, refetch: refetchWorkflow } = trpc.logistics.getWorkflowByOrder.useQuery(
    { orderId: orderId! },
    { enabled: !!orderId && !isNaN(orderId!) }
  );

  const createWorkflow = trpc.logistics.createWorkflow.useMutation({
    onSuccess: () => { refetchWorkflow(); setShowWorkflowForm(false); toast.success("Logistics workflow created with 13 checkpoints"); },
    onError: (e) => toast.error(e.message),
  });

  const updateCheckpoint = trpc.logistics.updateCheckpoint.useMutation({
    onSuccess: () => { refetchWorkflow(); toast.success("Checkpoint updated"); },
    onError: (e) => toast.error(e.message),
  });

  const reportProblem = trpc.logistics.reportProblem.useMutation({
    onSuccess: () => { refetchWorkflow(); setProblemDesc(""); setSelectedCheckpoint(null); toast.success("Problem reported and email sent to robot company"); },
    onError: (e) => toast.error(e.message),
  });

  const summarizeMeeting = trpc.logistics.summarizeMeetingAndHandoff.useMutation({
    onSuccess: (res) => {
      setShowMeetingHandoff(false);
      setMeetingNotesInput("");
      toast.success(`Meeting summarized. Next steps: ${res.nextSteps.slice(0, 2).join("; ")}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.orders.updateStatus.useMutation({
    onMutate: () => setUpdatingStatus(true),
    onSuccess: () => {
      setUpdatingStatus(false);
      ctx.orders.getDetail.invalidate({ id: orderId! });
      ctx.orders.allOrders.invalidate();
      toast.success("Order status updated");
    },
    onError: (e) => {
      setUpdatingStatus(false);
      toast.error(e.message);
    },
  });

  if (authLoading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-zinc-500" />
        </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle size={32} className="text-red-500" />
          <p className="text-zinc-300 font-semibold">Admin access required</p>
        </div>
    );
  }

  if (!orderId || isNaN(orderId)) {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle size={32} className="text-zinc-600" />
          <p className="text-zinc-400">Invalid order ID</p>
          <Link href="/admin/orders">
            <button className="text-[12px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
              <ArrowLeft size={12} /> Back to Orders
            </button>
          </Link>
        </div>
    );
  }

  return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Back nav */}
        <Link href="/admin/orders">
          <button className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2">
            <ArrowLeft size={13} />
            Back to Orders
          </button>
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-zinc-900 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle size={32} className="text-red-500" />
            <p className="text-zinc-300 font-semibold">Order not found</p>
            <p className="text-[12px] text-zinc-600">{error.message}</p>
          </div>
        ) : data ? (
          <>
            {/* ── Order Header ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Package size={18} className="text-zinc-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Order #{data.order.id}</h1>
                    <p className="text-[12px] text-zinc-500 mt-0.5">
                      Created {new Date(data.order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {/* Status badge + selector */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = STATUS_CONFIG[data.order.status] ?? STATUS_CONFIG.pending;
                    return (
                      <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Status update controls */}
              <div className="mt-5 pt-5 border-t border-zinc-800">
                <p className="text-[11px] text-zinc-500 mb-2 font-medium uppercase tracking-wider">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      disabled={updatingStatus || data.order.status === key}
                      onClick={() => updateStatus.mutate({ id: data.order.id, status: key as "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" })}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all
                        ${data.order.status === key
                          ? "border-zinc-600 text-zinc-300 bg-zinc-800 cursor-default"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 bg-transparent cursor-pointer"
                        }`}
                    >
                      {updatingStatus && data.order.status !== key ? <Loader2 size={10} className="animate-spin" /> : cfg.icon}
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total amount */}
              {data.order.totalAmount && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[12px] text-zinc-500">Total:</span>
                  <span className="text-[14px] font-bold text-emerald-400">${parseFloat(data.order.totalAmount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            {data.order.notes && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-[13px] font-semibold text-zinc-300 mb-3">Order Notes</h2>
                <pre className="text-[12px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                  {data.order.notes}
                </pre>
              </div>
            )}

            {/* ── Originating Booking Reference ── */}
            {data.booking ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[13px] font-semibold text-zinc-300 flex items-center gap-2">
                    <Building2 size={14} className="text-zinc-500" />
                    Originating Booking
                  </h2>
                  <Link href="/admin/bookings">
                    <button className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                      <ExternalLink size={10} />
                      View in Bookings
                    </button>
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {/* Booking ID + status */}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Booking ID</p>
                    <p className="text-[13px] font-semibold text-zinc-200">#{data.booking.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Booking Status</p>
                    {(() => {
                      const cfg = BOOKING_STATUS_CONFIG[data.booking.status] ?? BOOKING_STATUS_CONFIG.new;
                      return (
                        <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Company */}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Company</p>
                    <p className="text-[13px] text-zinc-200 font-medium">{data.booking.company}</p>
                  </div>

                  {/* Robot */}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Robot</p>
                    <div className="flex items-center gap-1.5">
                      <Bot size={11} className="text-zinc-500" />
                      <p className="text-[13px] text-zinc-200">{data.booking.robotName ?? "TBD"} ({data.booking.robotType ?? "unknown"})</p>
                    </div>
                  </div>

                  {/* Show */}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Show</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-zinc-500" />
                      <p className="text-[13px] text-zinc-200">{data.booking.showName ?? "TBD"}</p>
                    </div>
                  </div>

                  {/* Booth */}
                  {data.booking.boothNumber && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Booth</p>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} className="text-zinc-500" />
                        <p className="text-[13px] text-zinc-200">{data.booking.boothNumber}</p>
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Contact</p>
                    <p className="text-[13px] text-zinc-200">{data.booking.contactName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Email</p>
                    <a href={`mailto:${data.booking.contactEmail}`} className="flex items-center gap-1 text-[12px] text-blue-400 hover:underline">
                      <Mail size={10} />
                      {data.booking.contactEmail}
                    </a>
                  </div>

                  {data.booking.contactPhone && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Phone</p>
                      <div className="flex items-center gap-1.5">
                        <Phone size={11} className="text-zinc-500" />
                        <p className="text-[13px] text-zinc-200">{data.booking.contactPhone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Services requested */}
                {data.booking.services && (data.booking.services as string[]).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Services Requested</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(data.booking.services as string[]).map((svc, i) => (
                        <span key={i} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Booking submitted date */}
                <div className="mt-3">
                  <p className="text-[10px] text-zinc-600">
                    Submitted {new Date(data.booking.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-[13px] font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                  <Building2 size={14} className="text-zinc-500" />
                  Originating Booking
                </h2>
                <p className="text-[12px] text-zinc-600">This order was not created from a booking intake form.</p>
              </div>
            )}

            {/* ── Line Items Editor ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-semibold text-zinc-300">Line Items</h2>
                {!addingItem && (
                  <button
                    onClick={() => setAddingItem(true)}
                    className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Plus size={12} /> Add Item
                  </button>
                )}
              </div>

              {/* Existing items */}
              {data.items && data.items.length > 0 ? (
                <div className="space-y-1 mb-4">
                  {data.items.map((item: { id: number; serviceId: number; quantity: number; unitPrice?: string | null }) => {
                    const svc = services.find(s => s.id === item.serviceId);
                    const isEditing = editingItemId === item.id;
                    const lineTotal = item.unitPrice
                      ? parseFloat(item.unitPrice) * item.quantity
                      : svc?.basePrice ? parseFloat(svc.basePrice) * item.quantity : null;
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                        {isEditing ? (
                          <>
                            <div className="flex-1 flex items-center gap-2">
                              <span className="text-[12px] text-zinc-300 flex-1">{svc?.name ?? `Service #${item.serviceId}`}</span>
                              <input
                                type="number" min={1} value={editQty}
                                onChange={e => setEditQty(parseInt(e.target.value) || 1)}
                                className="w-14 text-[12px] bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-zinc-200 outline-none"
                              />
                              <input
                                type="text" placeholder="Unit price" value={editUnitPrice}
                                onChange={e => setEditUnitPrice(e.target.value)}
                                className="w-24 text-[12px] bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-zinc-200 outline-none"
                              />
                            </div>
                            <button
                              onClick={() => updateLineItem.mutate({ itemId: item.id, quantity: editQty, unitPrice: editUnitPrice || undefined })}
                              className="text-emerald-400 hover:text-emerald-300 p-1"
                              title="Save"
                            >
                              <Check size={13} />
                            </button>
                            <button onClick={() => setEditingItemId(null)} className="text-zinc-500 hover:text-zinc-300 p-1" title="Cancel">
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="text-[12px] text-zinc-200">{svc?.name ?? `Service #${item.serviceId}`}</p>
                              <p className="text-[11px] text-zinc-500">Qty {item.quantity}{item.unitPrice ? ` · $${parseFloat(item.unitPrice).toFixed(2)}/unit` : svc?.basePrice ? ` · $${parseFloat(svc.basePrice).toFixed(2)}/unit` : ""}</p>
                            </div>
                            {lineTotal !== null && (
                              <p className="text-[13px] font-semibold text-zinc-200">${lineTotal.toFixed(2)}</p>
                            )}
                            <button
                              onClick={() => { setEditingItemId(item.id); setEditQty(item.quantity); setEditUnitPrice(item.unitPrice ?? ""); }}
                              className="text-zinc-500 hover:text-amber-400 p-1 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => { if (confirm("Remove this line item?")) removeLineItem.mutate({ itemId: item.id, orderId: orderId! }); }}
                              className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                              title="Remove"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {/* Total row */}
                  {(() => {
                    const total = (data.items as { id: number; serviceId: number; quantity: number; unitPrice?: string | null }[]).reduce((sum, item) => {
                      const svc = services.find(s => s.id === item.serviceId);
                      const price = item.unitPrice ? parseFloat(item.unitPrice) : svc?.basePrice ? parseFloat(svc.basePrice) : 0;
                      return sum + price * item.quantity;
                    }, 0);
                    if (total === 0) return null;
                    return (
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-700">
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Total</span>
                        <span className="text-[14px] font-bold text-amber-400">${total.toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-[12px] text-zinc-600 mb-4">No line items yet. Add services to build the order.</p>
              )}

              {/* Add item form */}
              {addingItem && (
                <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
                  <select
                    value={newServiceId}
                    onChange={e => {
                      const id = parseInt(e.target.value);
                      setNewServiceId(id || "");
                      const svc = services.find(s => s.id === id);
                      if (svc?.basePrice) setNewUnitPrice(svc.basePrice);
                    }}
                    className="flex-1 text-[12px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none"
                  >
                    <option value="">Select service…</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.basePrice ? ` — $${parseFloat(s.basePrice).toFixed(2)}` : ""}</option>
                    ))}
                  </select>
                  <input
                    type="number" min={1} value={newQty}
                    onChange={e => setNewQty(parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                    className="w-14 text-[12px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none"
                  />
                  <input
                    type="text" value={newUnitPrice}
                    onChange={e => setNewUnitPrice(e.target.value)}
                    placeholder="Unit price"
                    className="w-24 text-[12px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none"
                  />
                  <button
                    onClick={() => {
                      if (!newServiceId) return toast.error("Select a service");
                      addLineItem.mutate({ orderId: orderId!, serviceId: newServiceId as number, quantity: newQty, unitPrice: newUnitPrice || undefined });
                    }}
                    disabled={addLineItem.isPending}
                    className="flex items-center gap-1 text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    {addLineItem.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add
                  </button>
                  <button onClick={() => setAddingItem(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* ─── Logistics Workflow Panel ─────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-amber-400" />
              <h2 className="text-[14px] font-semibold text-zinc-100">Logistics Workflow</h2>
            </div>
            {!workflowData && (
              <button
                onClick={() => setShowWorkflowForm(v => !v)}
                className="flex items-center gap-1.5 text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded transition-colors"
              >
                <Plus size={11} /> Create Workflow
              </button>
            )}
          </div>

          {showWorkflowForm && (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 mb-4 space-y-3">
              <p className="text-[12px] text-zinc-400">Creates a 13-checkpoint logistics workflow for this order.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Show Name</label>
                  <input value={workflowShowName} onChange={e => setWorkflowShowName(e.target.value)}
                    placeholder="e.g. CES 2026" className="w-full text-[12px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Show Start Date</label>
                  <input type="date" value={workflowShowDate} onChange={e => setWorkflowShowDate(e.target.value)}
                    className="w-full text-[12px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createWorkflow.mutate({
                    orderId: orderId!,
                    prospectId: data?.booking?.prospectId ?? undefined,
                    robotCompany: data?.booking?.company ?? "Robot Company",
                    robotName: data?.booking?.robotType ?? undefined,
                    showName: workflowShowName || undefined,
                    showStartDate: workflowShowDate || undefined,
                  })}
                  disabled={createWorkflow.isPending}
                  className="flex items-center gap-1 text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {createWorkflow.isPending ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={11} />} Create
                </button>
                <button onClick={() => setShowWorkflowForm(false)} className="text-[11px] text-zinc-500 hover:text-zinc-300 px-2">Cancel</button>
              </div>
            </div>
          )}

          {workflowData ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-3 text-[12px] text-zinc-400">
                <span className="flex items-center gap-1"><BarChart3 size={12} /> {workflowData.checkpoints.filter(c => c.status === "completed").length} / {workflowData.checkpoints.length} completed</span>
                {workflowData.workflow.showName && <span className="flex items-center gap-1"><Calendar size={12} /> {workflowData.workflow.showName}</span>}
              </div>

              {/* v23: Warehouse Bay Assignment */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Warehouse Bay</span>
                    {workflowData.workflow.warehouseBayId ? (
                      <span className="text-[11px] bg-amber-900/50 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded-full">
                        {bays.find(b => b.id === workflowData.workflow.warehouseBayId)?.name ?? `Bay #${workflowData.workflow.warehouseBayId}`}
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-600 italic">Not assigned</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedBayId}
                      onChange={e => setSelectedBayId(e.target.value)}
                      className="text-[11px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 outline-none"
                    >
                      <option value="">Select bay…</option>
                      {bays.map(b => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name} ({b.sqft} sqft) {b.isAvailable ? "✓" : "✗"}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (!selectedBayId) return;
                        assignBay.mutate({ workflowId: workflowData.workflow.id, warehouseBayId: Number(selectedBayId) });
                      }}
                      disabled={!selectedBayId || assignBay.isPending}
                      className="text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-semibold px-2.5 py-1 rounded transition-colors disabled:opacity-40"
                    >
                      {assignBay.isPending ? "…" : "Assign"}
                    </button>
                    {workflowData.workflow.warehouseBayId && (
                      <button
                        onClick={() => assignBay.mutate({ workflowId: workflowData.workflow.id, warehouseBayId: null })}
                        disabled={assignBay.isPending}
                        className="text-[11px] text-zinc-500 hover:text-red-400 px-2 py-1 rounded transition-colors"
                      >
                        Release
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {workflowData.checkpoints.map((cp) => {
                const statusColors: Record<string, string> = {
                  pending:     "bg-zinc-800 text-zinc-400 border-zinc-700",
                  in_progress: "bg-amber-900/60 text-amber-300 border-amber-700/40",
                  completed:   "bg-emerald-900/60 text-emerald-300 border-emerald-700/40",
                  blocked:     "bg-red-900/60 text-red-300 border-red-700/40",
                  escalated:   "bg-red-900/80 text-red-200 border-red-600",
                };
                return (
                  <div key={cp.id} className="flex items-start gap-3 p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium text-zinc-200">{cp.title}</span>
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${statusColors[cp.status] ?? statusColors.pending}`}>{cp.status.replace("_", " ")}</span>
                        {cp.dueAt && <span className="text-[10px] text-zinc-500">{new Date(cp.dueAt).toLocaleDateString()}</span>}
                      </div>
                      {cp.problemDescription && (
                        <p className="text-[11px] text-red-400 mt-1">⚠ {cp.problemDescription}</p>
                      )}
                      {cp.trackingNumber && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">Tracking: {cp.trackingNumber} {cp.carrierName && `(${cp.carrierName})`}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cp.status !== "completed" && (
                        <button
                          onClick={() => updateCheckpoint.mutate({ checkpointId: cp.id, status: "completed" })}
                          className="text-[10px] bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-300 border border-emerald-700/40 px-2 py-1 rounded transition-colors"
                        >
                          <Check size={10} />
                        </button>
                      )}
                      {cp.status !== "escalated" && (cp.type === "activation_test" || cp.type === "staging") && (
                        <button
                          onClick={() => setSelectedCheckpoint(selectedCheckpoint === cp.id ? null : cp.id)}
                          className="text-[10px] bg-red-900/60 hover:bg-red-800/60 text-red-300 border border-red-700/40 px-2 py-1 rounded transition-colors flex items-center gap-1"
                        >
                          <AlertTriangle size={10} /> Problem
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Problem report form */}
              {selectedCheckpoint !== null && (
                <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4 space-y-3">
                  <p className="text-[12px] font-semibold text-red-300 flex items-center gap-1.5"><AlertTriangle size={12} /> Report Robot Problem</p>
                  <textarea
                    value={problemDesc}
                    onChange={e => setProblemDesc(e.target.value)}
                    placeholder="Describe the problem found during staging/activation…"
                    rows={3}
                    className="w-full text-[12px] bg-zinc-900 border border-red-800/40 rounded px-3 py-2 text-zinc-200 outline-none resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <select value={problemSeverity} onChange={e => setProblemSeverity(e.target.value as typeof problemSeverity)}
                      className="text-[12px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <button
                      onClick={() => {
                        if (!problemDesc.trim() || problemDesc.trim().length < 10) return toast.error("Describe the problem (min 10 chars)");
                        const order = data?.order;
                        if (!order) return;
                        reportProblem.mutate({
                          checkpointId: selectedCheckpoint,
                          workflowId: workflowData.workflow.id,
                          problemDescription: problemDesc,
                          problemSeverity: problemSeverity,
                          robotCompanyEmail: data?.booking?.contactEmail ?? "",
                          robotCompanyName: data?.booking?.company ?? "Robot Company",
                        });
                      }}
                      disabled={reportProblem.isPending}
                      className="flex items-center gap-1 text-[11px] bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      {reportProblem.isPending ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Send Report
                    </button>
                    <button onClick={() => setSelectedCheckpoint(null)} className="text-[11px] text-zinc-500 hover:text-zinc-300">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-500">No logistics workflow yet. Create one after converting this booking to activate the 13-checkpoint pipeline.</p>
          )}
        </div>

        {/* ─── Meeting Handoff Panel ─────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <h2 className="text-[14px] font-semibold text-zinc-100">Meeting Handoff</h2>
            </div>
            <button
              onClick={() => setShowMeetingHandoff(v => !v)}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded transition-colors"
            >
              {showMeetingHandoff ? "Cancel" : "Log Meeting Notes"}
            </button>
          </div>
          {showMeetingHandoff ? (
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-400">Paste your raw meeting notes. The AI will summarize them, extract next steps, and mark this prospect as committed.</p>
              <textarea
                value={meetingNotesInput}
                onChange={e => setMeetingNotesInput(e.target.value)}
                placeholder="e.g. Spoke with Sarah at Agility Robotics. She is interested in CES 2026. Robot is Digit v4. Main concern is customs clearance timeline. Budget approved. Ready to move forward…"
                rows={6}
                className="w-full text-[12px] bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 outline-none resize-none"
              />
              <button
                onClick={() => {
                  if (!meetingNotesInput.trim() || meetingNotesInput.trim().length < 10) return toast.error("Add meeting notes (min 10 chars)");
                  summarizeMeeting.mutate({
                    prospectId: data?.booking?.prospectId ?? 0,
                    meetingNotes: meetingNotesInput,
                    orderId: orderId ?? undefined,
                  });
                }}
                disabled={summarizeMeeting.isPending}
                className="flex items-center gap-1.5 text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                {summarizeMeeting.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {summarizeMeeting.isPending ? "Summarizing…" : "Summarize & Mark Committed"}
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-zinc-500">After your call with the robot company, log meeting notes here. The AI will summarize them, extract next steps, and hand off to the Logistics Agent.</p>
          )}
        </div>
      </div>
  );
}
