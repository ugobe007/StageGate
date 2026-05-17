/**
 * AdminVendors.tsx
 *
 * Vendor directory management page.
 * Shows all logistics vendors (freight, AV, rigging, warehouse, etc.)
 * with ability to add, edit, and rate vendors.
 *
 * v20: Added "Warehouse" tab with bay CRUD and Space Matcher tool.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Globe, Phone, Mail, Star, Truck, Zap, Wrench, Package,
  Building2, MapPin, Search, Warehouse, Pencil, Trash2, Calculator,
  CheckCircle2, XCircle, Bot, RefreshCw,
} from "lucide-react";

const VENDOR_TYPES = [
  { value: "freight", label: "Freight", icon: Truck, color: "text-blue-500" },
  { value: "customs_broker", label: "Customs Broker", icon: Package, color: "text-purple-500" },
  { value: "av", label: "AV / Production", icon: Zap, color: "text-yellow-500" },
  { value: "rigging", label: "Rigging", icon: Wrench, color: "text-orange-500" },
  { value: "warehouse", label: "Warehouse", icon: Building2, color: "text-green-500" },
  { value: "transport", label: "Transport / Drayage", icon: Truck, color: "text-cyan-500" },
  { value: "tech_support", label: "Tech Support", icon: Wrench, color: "text-red-500" },
  { value: "other", label: "Other", icon: Package, color: "text-gray-500" },
];

function getTypeConfig(type: string) {
  return VENDOR_TYPES.find(t => t.value === type) ?? VENDOR_TYPES[VENDOR_TYPES.length - 1];
}

// ─── Warehouse Bays Tab ───────────────────────────────────────────────────────

type Bay = {
  id: number;
  name: string;
  sqft: number;
  pricePerSqftPerDay: string;
  isAvailable: boolean;
  notes: string | null;
};

const EMPTY_BAY_FORM = {
  name: "",
  sqft: 200,
  pricePerSqftPerDay: "0.45",
  isAvailable: true,
  notes: "",
};

function WarehouseTab() {
  const utils = trpc.useUtils();
  const { data: bays = [], isLoading, refetch: refetchBays } = trpc.warehouse.listBays.useQuery();

  // Fetch active workflows to build occupancy board
  const { data: workflowsData = [], refetch: refetchWorkflows } = trpc.logistics.getAllWorkflows.useQuery();

  function refreshAll() {
    refetchBays();
    refetchWorkflows();
  }

  // Build map: bayId → workflow info
  const occupancyMap = useMemo(() => {
    const map = new Map<number, { robotCompany: string; showName: string | null | undefined; workflowId: number }>();
    workflowsData.forEach(({ workflow }) => {
      if (workflow.warehouseBayId && workflow.status === "active") {
        map.set(workflow.warehouseBayId, {
          robotCompany: workflow.robotCompany ?? "Unknown",
          showName: workflow.showName,
          workflowId: workflow.id,
        });
      }
    });
    return map;
  }, [workflowsData]);

  const releaseBayMutation = trpc.logistics.assignBay.useMutation({
    onSuccess: () => {
      refreshAll();
      toast.success("Bay released");
    },
    onError: (err) => toast.error(err.message),
  });

  const upsertMutation = trpc.warehouse.upsertBay.useMutation({
    onSuccess: () => {
      toast.success(editingBay?.id ? "Bay updated" : "Bay added");
      utils.warehouse.listBays.invalidate();
      setEditingBay(null);
      setShowBayDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.warehouse.deleteBay.useMutation({
    onSuccess: () => {
      toast.success("Bay deleted");
      utils.warehouse.listBays.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [showBayDialog, setShowBayDialog] = useState(false);
  const [editingBay, setEditingBay] = useState<Bay | null>(null);
  const [bayForm, setBayForm] = useState(EMPTY_BAY_FORM);

  // Space Matcher
  const [matcherSqft, setMatcherSqft] = useState<number>(150);
  const [matcherDays, setMatcherDays] = useState<number>(5);
  const [runMatcher, setRunMatcher] = useState(false);
  const { data: matchResult, isFetching: matchFetching } = trpc.warehouse.matchSpace.useQuery(
    { robotSqft: matcherSqft, days: matcherDays },
    { enabled: runMatcher, staleTime: 0 }
  );

  function openAdd() {
    setEditingBay(null);
    setBayForm(EMPTY_BAY_FORM);
    setShowBayDialog(true);
  }

  function openEdit(bay: Bay) {
    setEditingBay(bay);
    setBayForm({
      name: bay.name,
      sqft: bay.sqft,
      pricePerSqftPerDay: bay.pricePerSqftPerDay,
      isAvailable: bay.isAvailable,
      notes: bay.notes ?? "",
    });
    setShowBayDialog(true);
  }

  function handleSave() {
    if (!bayForm.name) { toast.error("Bay name is required"); return; }
    upsertMutation.mutate({
      id: editingBay?.id,
      name: bayForm.name,
      sqft: bayForm.sqft,
      pricePerSqftPerDay: bayForm.pricePerSqftPerDay,
      isAvailable: bayForm.isAvailable,
      notes: bayForm.notes || undefined,
    });
  }

  const totalCapacity = bays.reduce((s, b) => s + b.sqft, 0);
  const availableCapacity = bays.filter(b => b.isAvailable).reduce((s, b) => s + b.sqft, 0);
  const occupiedCount = bays.filter(b => !b.isAvailable).length;

  return (
    <div className="space-y-6">
      {/* ── Live Occupancy Board ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-amber-500" />
              Live Occupancy Board
            </CardTitle>
            <button
              onClick={refreshAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {occupiedCount} of {bays.length} bays occupied · {bays.filter(b => b.isAvailable).length} available
          </p>
        </CardHeader>
        <CardContent>
          {bays.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No bays configured yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bays.map(bay => {
                const occupant = occupancyMap.get(bay.id);
                const isOccupied = !!occupant || !bay.isAvailable;
                return (
                  <div
                    key={bay.id}
                    className={`rounded-xl border p-4 space-y-2 transition-colors ${
                      isOccupied
                        ? "border-amber-500/40"
                        : "border-emerald-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{bay.name}</span>
                      <Badge
                        variant="outline"
                        className={isOccupied
                          ? "text-amber-500 border-amber-500/40 text-xs"
                          : "text-emerald-500 border-emerald-500/40 text-xs"}
                      >
                        {isOccupied ? "Occupied" : "Available"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{bay.sqft.toLocaleString()} sqft · ${parseFloat(bay.pricePerSqftPerDay).toFixed(2)}/sqft/day</p>
                    {occupant ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                          <Bot className="h-3 w-3" />
                          {occupant.robotCompany}
                        </div>
                        {occupant.showName && (
                          <p className="text-xs text-muted-foreground">Show: {occupant.showName}</p>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Release bay "${bay.name}" from ${occupant.robotCompany}?`)) {
                              releaseBayMutation.mutate({ workflowId: occupant.workflowId, warehouseBayId: null });
                            }
                          }}
                          disabled={releaseBayMutation.isPending}
                          className="mt-1 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          Release Bay
                        </button>
                      </div>
                    ) : isOccupied ? (
                      <p className="text-xs text-muted-foreground italic">Marked occupied (no active workflow)</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Ready for robot check-in</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Bays</p>
            <p className="text-2xl font-bold">{bays.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-green-500">{bays.filter(b => b.isAvailable).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Capacity (sqft)</p>
            <p className="text-2xl font-bold">
              {availableCapacity.toLocaleString()}
              <span className="text-sm text-muted-foreground font-normal"> / {totalCapacity.toLocaleString()}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bays table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-amber-500" />
              Warehouse Bays
            </CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add Bay
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading bays…</div>
          ) : bays.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No bays configured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Bay</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sqft</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">$/sqft/day</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bays.map(bay => (
                    <tr key={bay.id} className="border-b border-border/50 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{bay.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{bay.sqft.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-500">
                        ${parseFloat(bay.pricePerSqftPerDay).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {bay.isAvailable ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/40 gap-1">
                            <CheckCircle2 className="h-3 w-3" />Available
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            <XCircle className="h-3 w-3" />Occupied
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                        {bay.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(bay)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete bay "${bay.name}"?`)) {
                                deleteMutation.mutate({ id: bay.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Space Matcher */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-amber-500" />
            Space Matcher
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Enter robot footprint and storage duration to find the best available bay and get a price estimate.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Robot footprint (sqft)</label>
              <Input
                type="number"
                min={1}
                value={matcherSqft}
                onChange={e => { setMatcherSqft(Number(e.target.value)); setRunMatcher(false); }}
                className="w-36"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Days in warehouse</label>
              <Input
                type="number"
                min={1}
                value={matcherDays}
                onChange={e => { setMatcherDays(Number(e.target.value)); setRunMatcher(false); }}
                className="w-36"
              />
            </div>
            <Button
              onClick={() => setRunMatcher(true)}
              disabled={matchFetching}
            >
              {matchFetching ? "Matching…" : "Find Bay"}
            </Button>
          </div>

          {runMatcher && matchResult && (
            <div className={`rounded-lg border p-4 ${matchResult.match ? "border-amber-500/40" : "border-destructive/40"}`}>
              {matchResult.match ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">Recommended: Bay {matchResult.match.name}</span>
                    <Badge variant="outline" className="text-amber-500 border-amber-500/40">
                      {matchResult.match.sqft} sqft
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{matchResult.message}</p>
                  <div className="text-2xl font-bold text-amber-500">
                    ${matchResult.estimatedTotal}
                    <span className="text-sm font-normal text-muted-foreground ml-2">estimated total</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">{matchResult.message}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Bay Dialog */}
      <Dialog open={showBayDialog} onOpenChange={open => { setShowBayDialog(open); if (!open) setEditingBay(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBay ? "Edit Bay" : "Add Warehouse Bay"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bay name *</label>
              <Input
                value={bayForm.name}
                onChange={e => setBayForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Bay A1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Size (sqft) *</label>
                <Input
                  type="number"
                  min={1}
                  value={bayForm.sqft}
                  onChange={e => setBayForm(f => ({ ...f, sqft: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Price / sqft / day ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={bayForm.pricePerSqftPerDay}
                  onChange={e => setBayForm(f => ({ ...f, pricePerSqftPerDay: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bayAvailable"
                checked={bayForm.isAvailable}
                onChange={e => setBayForm(f => ({ ...f, isAvailable: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="bayAvailable" className="text-sm">Available for booking</label>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={bayForm.notes}
                onChange={e => setBayForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Climate controlled, near loading dock…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBayDialog(false); setEditingBay(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Saving…" : editingBay ? "Update Bay" : "Add Bay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "vendors" | "warehouse";

export default function AdminVendors() {
  const [activeTab, setActiveTab] = useState<Tab>("vendors");
  const { data: allVendors = [], refetch } = trpc.vendors.getAll.useQuery();
  const createMutation = trpc.vendors.create.useMutation({
    onSuccess: () => {
      toast.success("Vendor added");
      refetch();
      setShowAddDialog(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.vendors.update.useMutation({
    onSuccess: () => {
      toast.success("Vendor updated");
      refetch();
      setEditingVendor(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<typeof allVendors[0] | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "", type: "freight" as const, website: "", contactName: "",
    contactEmail: "", contactPhone: "", address: "", city: "Las Vegas",
    state: "NV", country: "US", notes: "",
  });

  function resetForm() {
    setForm({
      name: "", type: "freight", website: "", contactName: "",
      contactEmail: "", contactPhone: "", address: "", city: "Las Vegas",
      state: "NV", country: "US", notes: "",
    });
  }

  const filtered = useMemo(() => {
    let v = allVendors;
    if (filterType !== "all") v = v.filter(x => x.type === filterType);
    if (search) {
      const q = search.toLowerCase();
      v = v.filter(x =>
        x.name.toLowerCase().includes(q) ||
        (x.notes ?? "").toLowerCase().includes(q) ||
        (x.city ?? "").toLowerCase().includes(q)
      );
    }
    return v;
  }, [allVendors, filterType, search]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allVendors.forEach(v => { counts[v.type] = (counts[v.type] ?? 0) + 1; });
    return counts;
  }, [allVendors]);

  function handleCreate() {
    if (!form.name) { toast.error("Vendor name is required"); return; }
    createMutation.mutate(form);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors & Warehouse</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Las Vegas logistics partners and warehouse bay management
          </p>
        </div>
        {activeTab === "vendors" && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("vendors")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "vendors"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Vendors
            <Badge variant="outline" className="text-xs">{allVendors.length}</Badge>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("warehouse")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "warehouse"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            Warehouse Bays
          </span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "warehouse" ? (
        <WarehouseTab />
      ) : (
        <>
          {/* Type filter pills */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
            >
              All ({allVendors.length})
            </Button>
            {VENDOR_TYPES.map(t => {
              const cnt = typeCounts[t.value] ?? 0;
              if (cnt === 0) return null;
              return (
                <Button
                  key={t.value}
                  variant={filterType === t.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(t.value)}
                >
                  {t.label} ({cnt})
                </Button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search vendors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Vendor grid */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  {allVendors.length === 0
                    ? "No vendors yet — add your first vendor or run the vendor scraper from Cal's page."
                    : "No vendors match your filter."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(vendor => {
                const typeConf = getTypeConfig(vendor.type);
                const TypeIcon = typeConf.icon;
                return (
                  <Card key={vendor.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <TypeIcon className={`h-4 w-4 shrink-0 ${typeConf.color}`} />
                          <CardTitle className="text-sm font-semibold truncate">{vendor.name}</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {typeConf.label}
                        </Badge>
                      </div>
                      {vendor.city && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {vendor.city}, {vendor.state}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {vendor.contactName && (
                        <div className="text-xs text-muted-foreground">Contact: {vendor.contactName}</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {vendor.website && (
                          <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-amber-500 hover:underline">
                            <Globe className="h-3 w-3" />Website
                          </a>
                        )}
                        {vendor.contactEmail && (
                          <a href={`mailto:${vendor.contactEmail}`}
                            className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <Mail className="h-3 w-3" />Email
                          </a>
                        )}
                        {vendor.contactPhone && (
                          <a href={`tel:${vendor.contactPhone}`}
                            className="flex items-center gap-1 text-xs text-green-500 hover:underline">
                            <Phone className="h-3 w-3" />Phone
                          </a>
                        )}
                      </div>
                      {vendor.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{vendor.notes}</p>
                      )}
                      {vendor.rating && (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < (vendor.rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setEditingVendor(vendor)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            const rating = vendor.rating === 5 ? 1 : (vendor.rating ?? 0) + 1;
                            updateMutation.mutate({ id: vendor.id, rating });
                          }}
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add Vendor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={open => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <label className="text-sm font-medium">Company name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Freeman Company" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as typeof form.type }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VENDOR_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact name</label>
                <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact email</label>
                <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="702-" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Website</label>
                <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-sm font-medium">Address</label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">City</label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">State</label>
                <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Why this vendor is relevant for robot logistics..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog open={!!editingVendor} onOpenChange={open => !open && setEditingVendor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          {editingVendor && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={editingVendor.notes ?? ""}
                  onChange={e => setEditingVendor(v => v ? { ...v, notes: e.target.value } : null)}
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Rating (1–5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button
                      key={r}
                      onClick={() => setEditingVendor(v => v ? { ...v, rating: r } : null)}
                      className="p-1"
                    >
                      <Star className={`h-5 w-5 ${r <= (editingVendor.rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingVendor.isActive ?? true}
                  onChange={e => setEditingVendor(v => v ? { ...v, isActive: e.target.checked } : null)}
                />
                <label htmlFor="isActive" className="text-sm">Active vendor</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVendor(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingVendor) {
                  updateMutation.mutate({
                    id: editingVendor.id,
                    notes: editingVendor.notes ?? undefined,
                    rating: editingVendor.rating ?? undefined,
                    isActive: editingVendor.isActive ?? undefined,
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
