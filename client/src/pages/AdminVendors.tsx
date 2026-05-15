/**
 * AdminVendors.tsx
 *
 * Vendor directory management page.
 * Shows all logistics vendors (freight, AV, rigging, warehouse, etc.)
 * with ability to add, edit, and rate vendors.
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
import { Plus, Globe, Phone, Mail, Star, Truck, Zap, Wrench, Package, Building2, MapPin, Search } from "lucide-react";

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

export default function AdminVendors() {
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
          <h1 className="text-2xl font-bold tracking-tight">Vendor Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Las Vegas logistics partners for robot trade show operations
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </div>

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
                ? "No vendors yet — add your first vendor or run the vendor scraper from the Sales Agent page."
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
