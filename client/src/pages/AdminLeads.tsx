import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Users, ArrowLeft, Loader2, Zap, Mail, CheckCircle, MessageSquare,
  Trash2, Plus, ChevronDown, ChevronUp, Bot, Edit
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-secondary text-muted-foreground border-border" },
  emailed: { label: "Emailed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  responded: { label: "Responded", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  registered: { label: "Registered", color: "bg-primary/20 text-primary border-primary/30" },
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
    onSuccess: () => { toast.success("Lead added"); utils.leads.all.invalidate(); setAddLeadOpen(false); setNewLead({ companyName: "", website: "", contactEmail: "", contactName: "", notes: "" }); },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Admin access required.</p></div>;
  }

  const filteredLeads = (allLeads || []).filter(l => {
    if (selectedShowId && l.showId !== selectedShowId) return false;
    if (filterStatus !== "all" && l.outreachStatus !== filterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pt-24 pb-16">
        <div className="container">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <Link href="/admin"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5"><ArrowLeft size={14} /> Admin</Button></Link>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                <Users size={20} className="text-primary" /> Lead Discovery & Outreach
              </h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* AI Discover */}
              <Dialog open={discoveryOpen} onOpenChange={setDiscoveryOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2">
                    <Bot size={16} /> AI Discover
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2"><Bot size={18} className="text-primary" /> AI Lead Discovery</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label className="text-sm mb-1.5 block">Target Show</Label>
                      <Select value={selectedShowId?.toString() || ""} onValueChange={(v) => setSelectedShowId(parseInt(v))}>
                        <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select a show..." /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {(shows || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Paste Exhibitor List Text</Label>
                      <p className="text-xs text-muted-foreground mb-2">Copy and paste the exhibitor list from the trade show website. The AI will identify robotics companies automatically.</p>
                      <Textarea
                        value={discoveryText}
                        onChange={e => setDiscoveryText(e.target.value)}
                        placeholder="Paste exhibitor names, descriptions, booth numbers, etc. here..."
                        className="bg-input border-border resize-none"
                        rows={8}
                      />
                    </div>
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2"
                      onClick={() => {
                        if (!selectedShowId) { toast.error("Select a show first"); return; }
                        if (!discoveryText.trim()) { toast.error("Paste exhibitor list text"); return; }
                        discover.mutate({ showId: selectedShowId, exhibitorListText: discoveryText });
                      }}
                      disabled={discover.isPending}
                    >
                      {discover.isPending ? <><Loader2 size={16} className="animate-spin" /> Analyzing with AI...</> : <><Bot size={16} /> Discover Robotics Companies</>}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Add Lead Manually */}
              <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-border gap-2"><Plus size={16} /> Add Lead</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="font-display">Add Lead Manually</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label className="text-sm mb-1.5 block">Show</Label>
                      <Select value={selectedShowId?.toString() || ""} onValueChange={(v) => setSelectedShowId(parseInt(v))}>
                        <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Select a show..." /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {(shows || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Company Name *</Label>
                      <Input value={newLead.companyName} onChange={e => setNewLead({...newLead, companyName: e.target.value})} placeholder="Acme Robotics" className="bg-input border-border" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm mb-1.5 block">Website</Label>
                        <Input value={newLead.website} onChange={e => setNewLead({...newLead, website: e.target.value})} placeholder="https://..." className="bg-input border-border" />
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">Contact Email</Label>
                        <Input value={newLead.contactEmail} onChange={e => setNewLead({...newLead, contactEmail: e.target.value})} placeholder="ceo@..." className="bg-input border-border" />
                      </div>
                    </div>
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                      onClick={() => {
                        if (!selectedShowId) { toast.error("Select a show"); return; }
                        if (!newLead.companyName) { toast.error("Company name required"); return; }
                        createLead.mutate({ showId: selectedShowId, ...newLead });
                      }}
                      disabled={createLead.isPending}
                    >
                      {createLead.isPending ? <Loader2 size={16} className="animate-spin" /> : "Add Lead"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Select value={selectedShowId?.toString() || "all"} onValueChange={(v) => setSelectedShowId(v === "all" ? null : parseInt(v))}>
              <SelectTrigger className="bg-input border-border w-48"><SelectValue placeholder="All Shows" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Shows</SelectItem>
                {(shows || []).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 flex-wrap">
              {["all", "new", "emailed", "responded", "registered"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${filterStatus === s ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-secondary text-muted-foreground border-border hover:border-primary/50"}`}
                >
                  {s === "all" ? "All" : STATUS_CONFIG[s]?.label}
                  {s !== "all" && (
                    <span className="ml-1.5 opacity-70">
                      {(allLeads || []).filter(l => l.outreachStatus === s && (!selectedShowId || l.showId === selectedShowId)).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Leads List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-20">
              <Users size={48} className="text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No leads found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Use AI Discover to find robotics companies from a trade show exhibitor list.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => {
                const show = (shows || []).find(s => s.id === lead.showId);
                const status = STATUS_CONFIG[lead.outreachStatus] || STATUS_CONFIG.new;
                const isExpanded = expandedLead === lead.id;
                return (
                  <div key={lead.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground text-sm">{lead.companyName}</h3>
                          <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
                          {show && <span className="text-xs text-muted-foreground">{show.name}</span>}
                        </div>
                        {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-0.5 block">{lead.website}</a>}
                        {lead.contactEmail && <div className="text-xs text-muted-foreground mt-0.5">{lead.contactEmail}</div>}
                        {lead.aiSummary && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{lead.aiSummary}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {/* Action buttons based on status */}
                        {lead.outreachStatus === "new" && (
                          <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 text-xs gap-1"
                            onClick={() => generateEmail.mutate({ leadId: lead.id })}
                            disabled={generateEmail.isPending}>
                            {generateEmail.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                            Draft Email
                          </Button>
                        )}
                        {(lead.outreachStatus === "new" || lead.outreachStatus === "emailed") && lead.emailDraft && (
                          <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs gap-1"
                            onClick={() => markEmailed.mutate({ leadId: lead.id })}
                            disabled={markEmailed.isPending}>
                            <Mail size={12} /> Mark Emailed
                          </Button>
                        )}
                        {lead.outreachStatus === "emailed" && (
                          <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-xs gap-1"
                            onClick={() => markResponded.mutate({ leadId: lead.id })}
                            disabled={markResponded.isPending}>
                            <MessageSquare size={12} /> Mark Responded
                          </Button>
                        )}
                        {lead.outreachStatus === "responded" && (
                          <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 text-xs gap-1"
                            onClick={() => updateStatus.mutate({ id: lead.id, outreachStatus: "registered" })}
                            disabled={updateStatus.isPending}>
                            <CheckCircle size={12} /> Mark Registered
                          </Button>
                        )}
                        <button onClick={() => setExpandedLead(isExpanded ? null : lead.id)} className="text-muted-foreground hover:text-foreground p-1">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button onClick={() => { if (confirm("Delete this lead?")) deleteLead.mutate({ id: lead.id }); }} className="text-destructive/60 hover:text-destructive p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border p-4 bg-secondary/20">
                        {lead.aiSummary && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Summary</p>
                            <p className="text-sm text-foreground">{lead.aiSummary}</p>
                          </div>
                        )}
                        {lead.emailDraft && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Email Draft</p>
                            <div className="p-4 rounded-lg bg-card border border-border text-sm text-foreground whitespace-pre-wrap font-mono text-xs leading-relaxed">
                              {lead.emailDraft}
                            </div>
                          </div>
                        )}
                        {!lead.emailDraft && lead.outreachStatus === "new" && (
                          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2"
                            onClick={() => generateEmail.mutate({ leadId: lead.id })}
                            disabled={generateEmail.isPending}>
                            {generateEmail.isPending ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Bot size={14} /> Generate Outreach Email</>}
                          </Button>
                        )}
                        {lead.notes && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                            <p className="text-sm text-muted-foreground">{lead.notes}</p>
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
