import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Plus, Trash2, Edit, ArrowLeft, Loader2, Globe, Bell, ChevronDown, ChevronUp } from "lucide-react";
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

const STATUS_COLORS: Record<string, string> = {
  upcoming: "#f59e0b",
  active: "#00ff87",
  completed: "rgba(255,255,255,0.30)",
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
      <div style={{ minHeight: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#64748b" }}>Admin access required.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "72rem", margin: "0 auto", color: "#ececec" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <Link href="/admin">
          <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0" }}>
            <ArrowLeft size={14} /> Admin
          </button>
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={18} style={{ color: "#00ff87" }} /> Trade Shows
          </h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(EMPTY_FORM); } }}>
          <DialogTrigger asChild>
            <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1rem", border: "1px solid #00ff87", background: "transparent", color: "#00ff87", borderRadius: "0.375rem", cursor: "pointer" }}>
              <Plus size={14} /> Add Show
            </button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Show" : "Add Trade Show"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label className="text-sm mb-1.5 block">Show Name *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="CES 2027" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1.5 block">City</Label>
                  <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Las Vegas" />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Status</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm({...form, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Venue</Label>
                <Input value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} placeholder="Las Vegas Convention Center" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1.5 block">Start Date</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">End Date</Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Show Website</Label>
                <Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://ces.tech" />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Exhibitor List URL</Label>
                <Input value={form.exhibitorListUrl} onChange={e => setForm({...form, exhibitorListUrl: e.target.value})} placeholder="https://ces.tech/exhibitors" />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
                <button type="submit" disabled={createShow.isPending || updateShow.isPending}
                  style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1rem", border: "1px solid #00ff87", background: "transparent", color: "#00ff87", borderRadius: "0.375rem", cursor: "pointer" }}>
                  {(createShow.isPending || updateShow.isPending) ? <Loader2 size={14} className="animate-spin" /> : editId ? "Update Show" : "Create Show"}
                </button>
                <button type="button" onClick={() => { setOpen(false); setEditId(null); setForm(EMPTY_FORM); }}
                  style={{ fontSize: "0.875rem", padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.12)", background: "#0b0b0b", color: "#cbd5e1", borderRadius: "0.375rem", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "5rem 0" }}>
          <Loader2 size={28} style={{ color: "#00ff87", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {(shows || []).map((show) => {
            const statusColor = STATUS_COLORS[show.status] ?? "rgba(255,255,255,0.30)";
            const notifCount = (allNotifs || []).filter((n: any) => n.showId === show.id).length;
            const showingNotifs = selectedShowForNotifs === show.id;

            return (
              <div key={show.id} style={{ padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)", background: "#111111" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec", lineHeight: 1.3, margin: 0 }}>{show.name}</h3>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: statusColor, flexShrink: 0 }}>{show.status}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8125rem", color: "#64748b", marginBottom: "1rem" }}>
                  {show.venue && <div>📍 {show.venue}</div>}
                  {show.city && <div>🏙 {show.city}</div>}
                  {show.startDate && (
                    <div>📅 {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {show.endDate && ` – ${new Date(show.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </div>
                  )}
                  {show.website && (
                    <a href={show.website} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#00ff87", textDecoration: "none" }}>
                      <Globe size={11} /> Website
                    </a>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => openEdit(show)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.625rem", border: "1px solid rgba(255,255,255,0.12)", background: "#0b0b0b", color: "#cbd5e1", borderRadius: "0.25rem", cursor: "pointer" }}>
                    <Edit size={12} /> Edit
                  </button>
                  <Link href={`/admin/leads?showId=${show.id}`} style={{ flex: 1 }}>
                    <button style={{ width: "100%", fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.625rem", border: "1px solid rgba(62,207,142,0.45)", background: "#0b0b0b", color: "#00ff87", borderRadius: "0.25rem", cursor: "pointer" }}>
                      Leads
                    </button>
                  </Link>
                  <button onClick={() => { if (confirm("Delete this show?")) deleteShow.mutate({ id: show.id }); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.375rem 0.625rem", border: "1px solid rgba(239,68,68,0.45)", background: "#0b0b0b", color: "#f87171", borderRadius: "0.25rem", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Notification count */}
                {notifCount > 0 && (
                  <button
                    onClick={() => setSelectedShowForNotifs(showingNotifs ? null : show.id)}
                    style={{ marginTop: "0.625rem", width: "100%", display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.625rem", borderRadius: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, border: "1px solid rgba(62,207,142,0.3)", color: "#00ff87", background: "rgba(62,207,142,0.04)", cursor: "pointer" }}
                  >
                    <Bell size={12} />
                    {notifCount} notification request{notifCount !== 1 ? "s" : ""}
                    <span style={{ marginLeft: "auto" }}>{showingNotifs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                  </button>
                )}

                {/* Notification list */}
                {showingNotifs && (
                  <div style={{ marginTop: "0.5rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem", overflow: "hidden" }}>
                    <div style={{ padding: "0.375rem 0.75rem", background: "#080808", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                      Notification Requests
                    </div>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {(showNotifs || []).map((n: any) => (
                        <li key={n.id} style={{ padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", borderTop: "1px solid #1a1a1a" }}>
                          <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.email}</span>
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", flexShrink: 0 }}>
                            {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </li>
                      ))}
                    </ul>
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
