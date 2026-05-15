import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import {
  Package, Calendar, CheckCircle, Clock, AlertCircle, XCircle,
  ArrowRight, Loader2, User, Building2, Globe, Phone, Mail,
  Bot, Zap, Truck, Wrench, Plus, ChevronDown, ChevronUp,
  Star, FileText, Send
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  new:         { label: "New",         color: "bg-blue-500/20 text-blue-400 border-blue-500/30",       icon: Clock },
  reviewing:   { label: "Reviewing",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertCircle },
  quoted:      { label: "Quoted",      color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: FileText },
  approved:    { label: "Approved",    color: "bg-primary/20 text-primary border-primary/30",           icon: CheckCircle },
  in_progress: { label: "In Progress", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Zap },
  completed:   { label: "Completed",   color: "bg-green-500/20 text-green-400 border-green-500/30",    icon: CheckCircle },
  cancelled:   { label: "Cancelled",   color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
};

const REQUEST_TYPES = [
  "Robot Receiving", "Unpacking & Inspection", "Staging & Setup",
  "Show Floor Activation", "Booth Delivery", "Warehousing",
  "Customs & Freight", "Technical Support", "General Inquiry"
];

const URGENCY_OPTIONS = [
  { value: "low",    label: "Low — no rush" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High — upcoming show" },
  { value: "urgent", label: "Urgent — ASAP" },
];

export default function ClientDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestType, setRequestType] = useState("");
  const [showName, setShowName] = useState("");
  const [showDate, setShowDate] = useState("");
  const [robotName, setRobotName] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: profile, isLoading: profileLoading } = trpc.company.getMyProfile.useQuery(undefined, { enabled: isAuthenticated });
  const { data: serviceReqs, isLoading: reqsLoading } = trpc.company.getMyServiceRequests.useQuery(undefined, { enabled: isAuthenticated });
  const { data: shows } = trpc.shows.list.useQuery();

  const submitRequest = trpc.company.submitServiceRequest.useMutation({
    onSuccess: () => {
      utils.company.getMyServiceRequests.invalidate();
      setShowRequestForm(false);
      setRequestType(""); setShowName(""); setShowDate("");
      setRobotName(""); setDetails(""); setUrgency("normal");
    },
  });

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16 container max-w-lg mx-auto text-center">
          <div className="p-12 rounded-2xl border border-primary/30 bg-primary/5">
            <h1 className="text-3xl font-display font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-8">Please sign in to access your dashboard.</p>
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full gap-2">
                Sign In <ArrowRight size={16} />
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !profile.onboardingComplete) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16 container max-w-lg mx-auto text-center">
          <div className="p-12 rounded-2xl border border-primary/30 bg-primary/5">
            <Bot size={48} className="text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-display font-bold mb-4">Set Up Your Profile</h1>
            <p className="text-muted-foreground mb-8">
              Complete your company profile so StageGate can prepare the right logistics for your robots.
            </p>
            <Link href="/onboarding">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full gap-2">
                Start Setup <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const robots = profile.robots ? JSON.parse(profile.robots) as Array<{ name: string; type: string; weight: string; dimensions: string; powerReq: string; notes: string }> : [];
  const showsAttending = profile.showsAttending ? JSON.parse(profile.showsAttending) as Array<{ showName: string; boothNumber: string; year: string }> : [];
  const servicesNeeded = profile.servicesNeeded ? JSON.parse(profile.servicesNeeded) as string[] : [];
  const upcomingShows = (shows || []).filter(s => s.status === "upcoming");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-20 pb-16">
        <div className="container max-w-4xl mx-auto px-4">

          {/* Welcome header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold mb-1">
                Welcome back, {profile.contactName?.split(" ")[0] ?? user?.name ?? "there"} 👋
              </h1>
              <p className="text-muted-foreground">{profile.companyName} · StageGate Client Portal</p>
            </div>
            <Link href="/onboarding">
              <Button variant="outline" size="sm" className="gap-2 text-xs">
                <User size={12} /> Edit Profile
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left column */}
            <div className="lg:col-span-1 space-y-4">

              {/* Company card */}
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{profile.companyName}</div>
                    <div className="text-xs text-muted-foreground">{profile.country ?? "—"}</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {profile.contactEmail && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail size={12} /> <span className="truncate">{profile.contactEmail}</span>
                    </div>
                  )}
                  {profile.contactPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone size={12} /> {profile.contactPhone}
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe size={12} />
                      <a href={profile.website} target="_blank" rel="noreferrer" className="truncate hover:text-primary transition-colors">
                        {profile.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Robots */}
              {robots.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot size={14} className="text-primary" />
                    <span className="text-sm font-semibold">Your Robots</span>
                  </div>
                  <div className="space-y-2">
                    {robots.map((r, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background border border-border/40">
                        <div className="font-medium text-sm">{r.name || "Unnamed Robot"}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.type && <Badge variant="secondary" className="text-xs">{r.type}</Badge>}
                          {r.weight && <span className="text-xs text-muted-foreground">{r.weight}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shows */}
              {showsAttending.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} className="text-primary" />
                    <span className="text-sm font-semibold">Upcoming Shows</span>
                  </div>
                  <div className="space-y-2">
                    {showsAttending.map((s, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{s.showName}</div>
                          {s.boothNumber && <div className="text-xs text-muted-foreground">{s.boothNumber}</div>}
                        </div>
                        <Badge variant="outline" className="text-xs">{s.year}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services needed */}
              {servicesNeeded.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={14} className="text-primary" />
                    <span className="text-sm font-semibold">Services Requested</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {servicesNeeded.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — Service Requests */}
            <div className="lg:col-span-2 space-y-4">

              {/* Submit new request */}
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <button
                  onClick={() => setShowRequestForm(v => !v)}
                  className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                      <Plus size={16} className="text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-sm">Submit a Service Request</div>
                      <div className="text-xs text-muted-foreground">Request logistics, staging, or support for your next show</div>
                    </div>
                  </div>
                  {showRequestForm ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </button>

                {showRequestForm && (
                  <div className="px-5 pb-5 border-t border-border/40 pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Service Type *</label>
                        <select value={requestType} onChange={e => setRequestType(e.target.value)}
                          className="w-full h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground">
                          <option value="">Select service...</option>
                          {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Show Name</label>
                        <Input value={showName} onChange={e => setShowName(e.target.value)}
                          placeholder="e.g. CES 2026" className="bg-background border-border/60 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Show Date</label>
                        <Input value={showDate} onChange={e => setShowDate(e.target.value)}
                          placeholder="e.g. Jan 7–10, 2026" className="bg-background border-border/60 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Robot Name</label>
                        <Input value={robotName} onChange={e => setRobotName(e.target.value)}
                          placeholder="e.g. Spot" className="bg-background border-border/60 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Urgency</label>
                        <select value={urgency} onChange={e => setUrgency(e.target.value as "low" | "normal" | "high" | "urgent")}
                          className="w-full h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground">
                          {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Details</label>
                        <Textarea value={details} onChange={e => setDetails(e.target.value)}
                          placeholder="Describe what you need, timeline, any special requirements..."
                          className="bg-background border-border/60 resize-none text-sm" rows={3} />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" size="sm" onClick={() => setShowRequestForm(false)}>Cancel</Button>
                      <Button size="sm"
                        disabled={!requestType || submitRequest.isPending}
                        onClick={() => submitRequest.mutate({ requestType, showName: showName || undefined, showDate: showDate || undefined, robotName: robotName || undefined, details: details || undefined, urgency })}
                        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                        {submitRequest.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Submit Request
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Service request list */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText size={14} /> Your Service Requests
                  {serviceReqs && serviceReqs.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{serviceReqs.length}</Badge>
                  )}
                </h2>

                {reqsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-muted-foreground" size={20} />
                  </div>
                ) : !serviceReqs || serviceReqs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
                    <Package size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No service requests yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Submit your first request above to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serviceReqs.map(req => {
                      const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.new;
                      const Icon = cfg.icon;
                      const isExpanded = expandedRequest === req.id;
                      return (
                        <div key={req.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                          <button
                            onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                                <Icon size={14} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{req.requestType}</div>
                                <div className="text-xs text-muted-foreground">
                                  {req.showName && <span>{req.showName} · </span>}
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
                              {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-2 text-sm">
                              {req.robotName && <div><span className="text-muted-foreground">Robot:</span> {req.robotName}</div>}
                              {req.showDate && <div><span className="text-muted-foreground">Date:</span> {req.showDate}</div>}
                              {req.urgency && req.urgency !== "normal" && (
                                <div><span className="text-muted-foreground">Urgency:</span> <span className="capitalize">{req.urgency}</span></div>
                              )}
                              {req.details && <div className="text-muted-foreground">{req.details}</div>}
                              {req.quotedPrice && (
                                <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                                  <div className="text-xs text-muted-foreground mb-1">Quoted Price</div>
                                  <div className="font-semibold text-primary">{req.quotedPrice}</div>
                                </div>
                              )}
                              {req.adminNotes && (
                                <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                                  <div className="text-xs text-muted-foreground mb-1">StageGate Note</div>
                                  <div className="text-sm">{req.adminNotes}</div>
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
        </div>
      </div>
    </div>
  );
}
