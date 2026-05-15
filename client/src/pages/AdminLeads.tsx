import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Users, ArrowLeft, Loader2, Mail, CheckCircle, MessageSquare,
  Trash2, Plus, ChevronDown, ChevronUp, Bot,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:        { label: "New",        color: "#94a3b8" },
  emailed:    { label: "Emailed",    color: "#3b82f6" },
  responded:  { label: "Responded",  color: "#f59e0b" },
  registered: { label: "Registered", color: "#3ecf8e" },
};

export default function AdminLeads() {
  const { user, isAuthenticated } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedShowId = params.get("showId") ? parseInt(params.get("showId")!) : null;

  const [selectedShowId, setSelectedShowId] = useState<number | null>(preselectedShowId);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedLead, setExpandedLead] = useState<number | null>(null);
  const [discoveryText, setDiscoveryText] = useState("");
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [newLead, setNewLead] = useState({ companyName: "", website: "", contactEmail: "", contactName: "", notes: "" });

  const utils = trpc.useUtils();
  const { data: shows } = trpc.shows.list.useQuery();
  const { data: allLeads, isLoading } = trpc.leads.all.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });

  const discover = trpc.leads.discover.useMutation({
    onSuccess: (data) => {
      toast.success(`Discovered ${data.count} robotics companies`);
      utils.leads.all.invalidate();
      setDiscoveryOpen(false);
      setDiscoveryText("");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateEmail = trpc.leads.generateEmail.useMutation({
    onSuccess: () => { toast.success("Email draft generated"); utils.leads.all.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const markEmailed = trpc.leads.markEmailed.useMutation({
    onSuccess: () => { toast.success("Marked as emailed"); utils.leads.all.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const markResponded = trpc.leads.markResponded.useMutation({
    onSuccess: () => { toast.success("Marked as responded"); utils.leads.all.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); utils.leads.all.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => { toast.success("Lead deleted"); utils.leads.all.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead added");
      utils.leads.all.invalidate();
      setAddLeadOpen(false);
      setNewLead({ companyName: "", website: "", contactEmail: "", contactName: "", notes: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return <div style={{ minHeight: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#64748b" }}>Admin access required.</p></div>;
  }

  const filteredLeads = (allLeads || []).filter(l => {
    if (selectedShowId && l.showId !== selectedShowId) return false;
    if (filterStatus !== "all" && l.outreachStatus !== filterStatus) return false;
    return true;
  });

  return (
    <div style={{ padding: "2rem", maxWidth: "56rem", margin: "0 auto", color: "#0f172a" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <Link href="/admin">
          <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0" }}>
            <ArrowLeft size={14} /> Admin
          </button>
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Users size={18} style={{ color: "#3ecf8e" }} /> Lead Discovery & Outreach
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {/* AI Discover */}
          <Dialog open={discoveryOpen} onOpenChange={setDiscoveryOpen}>
            <DialogTrigger asChild>
              <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1rem", border: "none", background: "#3ecf8e", color: "#fff", borderRadius: "0.375rem", cursor: "pointer" }}>
                <Bot size={14} /> AI Discover
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-2xl">
              <DialogHeader>
                <DialogTitle>AI Lead Discovery</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-sm mb-1.5 block">Target Show</Label>
                  <Select value={selectedShowId?.toString() || ""} onValueChange={(v) => setSelectedShowId(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Select a show..." /></SelectTrigger>
                    <SelectContent>
                      {(shows || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Paste Exhibitor List Text</Label>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.5rem" }}>Copy and paste the exhibitor list from the trade show website. The AI will identify robotics companies automatically.</p>
                  <Textarea
                    value={discoveryText}
                    onChange={e => setDiscoveryText(e.target.value)}
                    placeholder="Paste exhibitor names, descriptions, booth numbers, etc. here..."
                    rows={8}
                  />
                </div>
                <button
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.625rem 1rem", border: "none", background: "#3ecf8e", color: "#fff", borderRadius: "0.375rem", cursor: "pointer" }}
                  onClick={() => {
                    if (!selectedShowId) { toast.error("Select a show first"); return; }
                    if (!discoveryText.trim()) { toast.error("Paste exhibitor list text"); return; }
                    discover.mutate({ showId: selectedShowId, exhibitorListText: discoveryText });
                  }}
                  disabled={discover.isPending}
                >
                  {discover.isPending ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Analyzing with AI…</> : <><Bot size={14} /> Discover Robotics Companies</>}
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Lead Manually */}
          <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
            <DialogTrigger asChild>
              <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", fontWeight: 500, padding: "0.5rem 1rem", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: "0.375rem", cursor: "pointer" }}>
                <Plus size={14} /> Add Lead
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Lead Manually</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-sm mb-1.5 block">Show</Label>
                  <Select value={selectedShowId?.toString() || ""} onValueChange={(v) => setSelectedShowId(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Select a show..." /></SelectTrigger>
                    <SelectContent>
                      {(shows || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Company Name *</Label>
                  <Input value={newLead.companyName} onChange={e => setNewLead({...newLead, companyName: e.target.value})} placeholder="Acme Robotics" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <Label className="text-sm mb-1.5 block">Website</Label>
                    <Input value={newLead.website} onChange={e => setNewLead({...newLead, website: e.target.value})} placeholder="https://..." />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Contact Email</Label>
                    <Input value={newLead.contactEmail} onChange={e => setNewLead({...newLead, contactEmail: e.target.value})} placeholder="ceo@..." />
                  </div>
                </div>
                <button
                  style={{ width: "100%", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1rem", border: "none", background: "#3ecf8e", color: "#fff", borderRadius: "0.375rem", cursor: "pointer" }}
                  onClick={() => {
                    if (!selectedShowId) { toast.error("Select a show"); return; }
                    if (!newLead.companyName) { toast.error("Company name required"); return; }
                    createLead.mutate({ showId: selectedShowId, ...newLead });
                  }}
                  disabled={createLead.isPending}
                >
                  {createLead.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Add Lead"}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Select value={selectedShowId?.toString() || "all"} onValueChange={(v) => setSelectedShowId(v === "all" ? null : parseInt(v))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Shows" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shows</SelectItem>
            {(shows || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {["all", "new", "emailed", "responded", "registered"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: "0.3125rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500,
                border: `1px solid ${filterStatus === s ? "#3ecf8e" : "#e2e8f0"}`,
                background: filterStatus === s ? "rgba(62,207,142,0.08)" : "#fff",
                color: filterStatus === s ? "#3ecf8e" : "#64748b",
                borderRadius: "0.25rem", cursor: "pointer",
              }}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label}
              {s !== "all" && (
                <span style={{ marginLeft: "0.375rem", fontSize: "0.75rem", background: "#f1f5f9", color: "#64748b", padding: "0.0625rem 0.3125rem", borderRadius: "0.1875rem" }}>
                  {(allLeads || []).filter(l => l.outreachStatus === s && (!selectedShowId || l.showId === selectedShowId)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 0" }}>
          <Loader2 size={24} style={{ color: "#94a3b8", animation: "spin 1s linear infinite" }} />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <Users size={40} style={{ color: "#cbd5e1", margin: "0 auto 1rem" }} />
          <p style={{ color: "#94a3b8", fontWeight: 500 }}>No leads found</p>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginTop: "0.25rem" }}>Use AI Discover to find robotics companies from a trade show exhibitor list.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filteredLeads.map((lead) => {
            const show = (shows || []).find(s => s.id === lead.showId);
            const status = STATUS_CONFIG[lead.outreachStatus] || STATUS_CONFIG.new;
            const isExpanded = expandedLead === lead.id;
            return (
              <div key={lead.id} style={{ border: `1px solid ${isExpanded ? "#3ecf8e" : "#e2e8f0"}`, borderRadius: "0.5rem", background: "#ffffff", overflow: "hidden", transition: "border-color 0.1s" }}>
                <div style={{ padding: "0.875rem 1rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <h3 style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#0f172a", margin: 0 }}>{lead.companyName}</h3>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: status.color }}>{status.label}</span>
                      {show && <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>{show.name}</span>}
                    </div>
                    {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8125rem", color: "#3ecf8e", textDecoration: "none", display: "block", marginTop: "0.125rem" }}>{lead.website}</a>}
                    {lead.contactEmail && <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.125rem" }}>{lead.contactEmail}</div>}
                    {lead.aiSummary && <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.375rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{lead.aiSummary}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {lead.outreachStatus === "new" && (
                      <button
                        onClick={() => generateEmail.mutate({ leadId: lead.id })}
                        disabled={generateEmail.isPending}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.25rem 0.625rem", border: "1px solid rgba(62,207,142,0.4)", color: "#3ecf8e", background: "#fff", borderRadius: "0.25rem", cursor: "pointer" }}
                      >
                        {generateEmail.isPending ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={11} />}
                        Draft Email
                      </button>
                    )}
                    {(lead.outreachStatus === "new" || lead.outreachStatus === "emailed") && lead.emailDraft && (
                      <button
                        onClick={() => markEmailed.mutate({ leadId: lead.id })}
                        disabled={markEmailed.isPending}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.25rem 0.625rem", border: "1px solid rgba(59,130,246,0.4)", color: "#3b82f6", background: "#fff", borderRadius: "0.25rem", cursor: "pointer" }}
                      >
                        <Mail size={11} /> Mark Emailed
                      </button>
                    )}
                    {lead.outreachStatus === "emailed" && (
                      <button
                        onClick={() => markResponded.mutate({ leadId: lead.id })}
                        disabled={markResponded.isPending}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.25rem 0.625rem", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b", background: "#fff", borderRadius: "0.25rem", cursor: "pointer" }}
                      >
                        <MessageSquare size={11} /> Mark Responded
                      </button>
                    )}
                    {lead.outreachStatus === "responded" && (
                      <button
                        onClick={() => updateStatus.mutate({ id: lead.id, outreachStatus: "registered" })}
                        disabled={updateStatus.isPending}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.25rem 0.625rem", border: "1px solid rgba(62,207,142,0.4)", color: "#3ecf8e", background: "#fff", borderRadius: "0.25rem", cursor: "pointer" }}
                      >
                        <CheckCircle size={11} /> Mark Registered
                      </button>
                    )}
                    <button onClick={() => setExpandedLead(isExpanded ? null : lead.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0.25rem", display: "flex", alignItems: "center" }}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button onClick={() => { if (confirm("Delete this lead?")) deleteLead.mutate({ id: lead.id }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "0.25rem", display: "flex", alignItems: "center", opacity: 0.6 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #e2e8f0", padding: "1rem", background: "#f8fafc", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {lead.aiSummary && (
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.5rem" }}>AI Summary</p>
                        <p style={{ fontSize: "0.875rem", color: "#475569" }}>{lead.aiSummary}</p>
                      </div>
                    )}
                    {lead.emailDraft && (
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.5rem" }}>Email Draft</p>
                        <pre style={{ fontSize: "0.8125rem", whiteSpace: "pre-wrap", fontFamily: "monospace", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0.375rem", padding: "0.875rem", lineHeight: 1.6, color: "#0f172a", margin: 0 }}>
                          {lead.emailDraft}
                        </pre>
                      </div>
                    )}
                    {!lead.emailDraft && lead.outreachStatus === "new" && (
                      <button
                        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1rem", border: "none", background: "#3ecf8e", color: "#fff", borderRadius: "0.375rem", cursor: "pointer" }}
                        onClick={() => generateEmail.mutate({ leadId: lead.id })}
                        disabled={generateEmail.isPending}
                      >
                        {generateEmail.isPending ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Bot size={14} /> Generate Outreach Email</>}
                      </button>
                    )}
                    {lead.notes && (
                      <div>
                        <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.5rem" }}>Notes</p>
                        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>{lead.notes}</p>
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
