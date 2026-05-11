import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Plus, Trash2, Edit, Loader2, Globe, Phone, Mail, Building2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  { value: "customs", label: "Customs & Freight Forwarding", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "transporter", label: "Equipment Transporter", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "insurance", label: "Insurance & Bonding", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "parts", label: "Spare Parts Supplier", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "general", label: "Other", color: "bg-secondary text-muted-foreground border-border" },
];

type PartnerForm = {
  name: string;
  serviceType: "customs" | "transporter" | "insurance" | "parts" | "general";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  city: string;
  notes: string;
};

const EMPTY_FORM: PartnerForm = {
  name: "", serviceType: "customs" as const, contactName: "", contactEmail: "",
  contactPhone: "", website: "", city: "", notes: "",
};

export default function AdminPartners() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState("all");

  const utils = trpc.useUtils();
  const { data: partners, isLoading } = trpc.partners.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const createPartner = trpc.partners.create.useMutation({
    onSuccess: () => { toast.success("Partner added"); utils.partners.list.invalidate(); setOpen(false); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });

  const updatePartner = trpc.partners.update.useMutation({
    onSuccess: () => { toast.success("Partner updated"); utils.partners.list.invalidate(); setOpen(false); setEditId(null); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });

  const deletePartner = trpc.partners.delete.useMutation({
    onSuccess: () => { toast.success("Partner deleted"); utils.partners.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error("Partner name required"); return; }
    if (editId) {
      updatePartner.mutate({ id: editId, ...form });
    } else {
      createPartner.mutate(form);
    }
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name || "", serviceType: (p.serviceType || "customs") as PartnerForm["serviceType"],
      contactName: p.contactName || "", contactEmail: p.contactEmail || "",
      contactPhone: p.contactPhone || "", website: p.website || "",
      city: p.city || "", notes: p.notes || "",
    });
    setOpen(true);
  };

  if (!isAuthenticated || user?.role !== "admin") {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Admin access required.</p></div>;
  }

  const filteredPartners = (partners || []).filter(p =>
    filterCategory === "all" || p.serviceType === filterCategory
  );

  const getCategoryConfig = (svcType: string) => CATEGORIES.find(c => c.value === svcType) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container">
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                <ArrowLeft size={14} /> Admin
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                <TrendingUp size={20} className="text-primary" /> Logistics Partner Directory
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Customs agents, transporters, insurance brokers, and parts suppliers.</p>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(EMPTY_FORM); } }}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2">
                  <Plus size={16} /> Add Partner
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-display">{editId ? "Edit Partner" : "Add Logistics Partner"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                  <div>
                    <Label className="text-sm mb-1.5 block">Company Name *</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Global Freight Co." className="bg-input border-border" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Category</Label>
                    <Select value={form.serviceType} onValueChange={(v) => setForm({...form, serviceType: v as PartnerForm["serviceType"]})}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm mb-1.5 block">Contact Name</Label>
                      <Input value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} placeholder="John Doe" className="bg-input border-border" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Contact Email</Label>
                      <Input value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} placeholder="john@..." className="bg-input border-border" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Phone</Label>
                      <Input value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} placeholder="+1 (555) 000-0000" className="bg-input border-border" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Website</Label>
                      <Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://..." className="bg-input border-border" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">City</Label>
                      <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Las Vegas" className="bg-input border-border" />
                    </div>

                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Internal Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Rates, specialties, relationship notes..." className="bg-input border-border resize-none" rows={3} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" disabled={createPartner.isPending || updatePartner.isPending}>
                      {(createPartner.isPending || updatePartner.isPending) ? <Loader2 size={16} className="animate-spin" /> : editId ? "Update Partner" : "Add Partner"}
                    </Button>
                    <Button type="button" variant="outline" className="border-border" onClick={() => { setOpen(false); setEditId(null); setForm(EMPTY_FORM); }}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${filterCategory === "all" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-secondary text-muted-foreground border-border hover:border-primary/50"}`}
            >
              All Partners ({(partners || []).length})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${filterCategory === cat.value ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-secondary text-muted-foreground border-border hover:border-primary/50"}`}
              >
                {`${cat.label} (${(partners || []).filter(p => p.serviceType === cat.value).length})`}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-20">
              <Building2 size={48} className="text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No partners in this category yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Add customs agents, transporters, insurance brokers, and parts suppliers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPartners.map((partner) => {
                    const cat = getCategoryConfig(partner.serviceType);
                return (
                  <div key={partner.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-display font-bold text-foreground text-sm leading-tight">{partner.name}</h3>
                      <Badge className={`text-xs shrink-0 ${cat.color}`}>{cat.label}</Badge>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                      {partner.contactName && (
                        <div className="flex items-center gap-1.5">
                          <Building2 size={10} /> {partner.contactName}
                        </div>
                      )}
                      {partner.contactEmail && (
                        <a href={`mailto:${partner.contactEmail}`} className="flex items-center gap-1.5 hover:text-primary">
                          <Mail size={10} /> {partner.contactEmail}
                        </a>
                      )}
                      {partner.contactPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={10} /> {partner.contactPhone}
                        </div>
                      )}
                      {partner.website && (
                        <a href={partner.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                          <Globe size={10} /> Website
                        </a>
                      )}
                      {partner.city && (
                        <div>📍 {partner.city}</div>
                      )}
                    </div>
                    {partner.notes && (
                      <p className="text-xs text-muted-foreground/70 mb-4 line-clamp-2 italic">{partner.notes}</p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 border-border text-xs gap-1" onClick={() => openEdit(partner)}>
                        <Edit size={12} /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                        onClick={() => { if (confirm("Delete this partner?")) deletePartner.mutate({ id: partner.id }); }}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
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
