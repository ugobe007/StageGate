import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Plus, Trash2, Edit, ArrowLeft, Loader2, Globe, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ShowForm = {
  name: string;
  location: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  website: string;
  exhibitorListUrl: string;
  status: "upcoming" | "active" | "completed";
};

const EMPTY_FORM: ShowForm = {
  name: "", location: "", venue: "", city: "",
  startDate: "", endDate: "", website: "", exhibitorListUrl: "", status: "upcoming",
};

export default function AdminShows() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ShowForm>(EMPTY_FORM);

  const [selectedShowForNotifs, setSelectedShowForNotifs] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: shows, isLoading } = trpc.shows.list.useQuery();
  const { data: allNotifs } = trpc.shows.getNotifications.useQuery({ showId: undefined });
  const { data: showNotifs } = trpc.shows.getNotifications.useQuery(
    { showId: selectedShowForNotifs ?? undefined },
    { enabled: selectedShowForNotifs !== null }
  );

  const createShow = trpc.shows.create.useMutation({
    onSuccess: () => { toast.success("Show created"); utils.shows.list.invalidate(); setOpen(false); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });

  const updateShow = trpc.shows.update.useMutation({
    onSuccess: () => { toast.success("Show updated"); utils.shows.list.invalidate(); setOpen(false); setEditId(null); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });

  const deleteShow = trpc.shows.delete.useMutation({
    onSuccess: () => { toast.success("Show deleted"); utils.shows.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error("Show name required"); return; }
    if (editId) {
      updateShow.mutate({ id: editId, ...form });
    } else {
      createShow.mutate(form);
    }
  };

  const openEdit = (show: any) => {
    setEditId(show.id);
    setForm({
      name: show.name || "",
      location: show.location || "",
      venue: show.venue || "",
      city: show.city || "",
      startDate: show.startDate ? new Date(show.startDate).toISOString().slice(0, 10) : "",
      endDate: show.endDate ? new Date(show.endDate).toISOString().slice(0, 10) : "",
      website: show.website || "",
      exhibitorListUrl: show.exhibitorListUrl || "",
      status: show.status || "upcoming",
    });
    setOpen(true);
  };

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    upcoming: "bg-primary/20 text-primary border-primary/30",
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    completed: "bg-secondary text-muted-foreground border-border",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pt-24 pb-16">
        <div className="container">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                <ArrowLeft size={14} /> Admin
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                <Calendar size={20} className="text-primary" /> Trade Shows
              </h1>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(EMPTY_FORM); } }}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2">
                  <Plus size={16} /> Add Show
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-display">{editId ? "Edit Show" : "Add Trade Show"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                  <div>
                    <Label className="text-sm mb-1.5 block">Show Name *</Label>
                    <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="CES 2027" className="bg-input border-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm mb-1.5 block">City</Label>
                      <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Las Vegas" className="bg-input border-border" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Status</Label>
                      <Select value={form.status} onValueChange={(v: any) => setForm({...form, status: v})}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Venue</Label>
                    <Input value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} placeholder="Las Vegas Convention Center" className="bg-input border-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm mb-1.5 block">Start Date</Label>
                      <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="bg-input border-border" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">End Date</Label>
                      <Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="bg-input border-border" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Show Website</Label>
                    <Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://ces.tech" className="bg-input border-border" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Exhibitor List URL</Label>
                    <Input value={form.exhibitorListUrl} onChange={e => setForm({...form, exhibitorListUrl: e.target.value})} placeholder="https://ces.tech/exhibitors" className="bg-input border-border" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" disabled={createShow.isPending || updateShow.isPending}>
                      {(createShow.isPending || updateShow.isPending) ? <Loader2 size={16} className="animate-spin" /> : editId ? "Update Show" : "Create Show"}
                    </Button>
                    <Button type="button" variant="outline" className="border-border" onClick={() => { setOpen(false); setEditId(null); setForm(EMPTY_FORM); }}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(shows || []).map((show) => (
                <div key={show.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-display font-bold text-foreground text-sm leading-tight">{show.name}</h3>
                    <Badge className={`text-xs shrink-0 ${statusColors[show.status] || ""}`}>{show.status}</Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                    {show.venue && <div>📍 {show.venue}</div>}
                    {show.city && <div>🏙 {show.city}</div>}
                    {show.startDate && (
                      <div>📅 {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {show.endDate && ` – ${new Date(show.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </div>
                    )}
                    {show.website && (
                      <a href={show.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <Globe size={10} /> Website
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 border-border text-xs gap-1" onClick={() => openEdit(show)}>
                      <Edit size={12} /> Edit
                    </Button>
                    <Link href={`/admin/leads?showId=${show.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10 text-xs gap-1">
                        Leads
                      </Button>
                    </Link>
                    <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                      onClick={() => { if (confirm("Delete this show?")) deleteShow.mutate({ id: show.id }); }}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                  {/* Notification count */}
                  {(() => {
                    const count = (allNotifs || []).filter((n: any) => n.showId === show.id).length;
                    return count > 0 ? (
                      <button
                        onClick={() => setSelectedShowForNotifs(selectedShowForNotifs === show.id ? null : show.id)}
                        className="mt-2 w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-all"
                        style={{ borderColor: "oklch(0.55 0.18 145 / 0.30)", color: "oklch(0.55 0.18 145)", background: "oklch(0.55 0.18 145 / 0.06)" }}
                      >
                        <Bell size={11} />
                        {count} notification request{count !== 1 ? "s" : ""}
                        <span className="ml-auto text-[10px] opacity-60">{selectedShowForNotifs === show.id ? "▲ hide" : "▼ show"}</span>
                      </button>
                    ) : null;
                  })()}
                  {/* Notification list drawer */}
                  {selectedShowForNotifs === show.id && (
                    <div className="mt-2 rounded-lg border overflow-hidden" style={{ borderColor: "oklch(0.55 0.18 145 / 0.20)" }}>
                      <div className="px-3 py-2 text-[10px] font-mono tracking-widest uppercase" style={{ background: "oklch(0.55 0.18 145 / 0.08)", color: "oklch(0.55 0.18 145)" }}>
                        Notification Requests
                      </div>
                      <ul className="divide-y" style={{ borderColor: "oklch(0.55 0.18 145 / 0.10)" }}>
                        {(showNotifs || []).map((n: any) => (
                          <li key={n.id} className="px-3 py-2 flex items-center justify-between gap-2">
                            <span className="text-xs truncate" style={{ color: "oklch(0.80 0.004 240)" }}>{n.email}</span>
                            <span className="text-[10px] flex-shrink-0" style={{ color: "oklch(0.40 0.008 240)" }}>
                              {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
